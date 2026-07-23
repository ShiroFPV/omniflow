// OmniFlow sync backend. Deployed by the desktop app into the user's own
// Cloudflare account via the REST API (see electron/cloudflare.ts). Each
// deployment belongs to exactly one person - there is no multi-tenant user
// system here, auth is just the shared secret bound as SYNC_SECRET.

const ENTITY_TABLES = {
  todo: 'todos',
  note: 'notes',
  event: 'events',
}

// Permissive by design: this Worker belongs to exactly one person (see auth
// note above), so there is no other origin's data to protect here - only
// the SYNC_SECRET check matters. This just lets the web build's browser tab
// call this Worker directly without CORS getting in the way.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

// ICS/webcal calendar servers (Outlook, iCloud, Google, ...) don't send CORS
// headers - they were never meant to be fetched from browser JS. The web
// build can't fetch them directly, so it routes through this Worker instead,
// which fetches server-side (no CORS enforcement there) and hands the raw
// ICS text back with permissive headers attached.
async function proxyIcs(url) {
  const target = url.searchParams.get('url')
  if (!target) return new Response('Missing url param', { status: 400, headers: CORS_HEADERS })
  let parsed
  try {
    parsed = new URL(target.replace(/^webcal:\/\//i, 'https://'))
  } catch {
    return new Response('Invalid url', { status: 400, headers: CORS_HEADERS })
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return new Response('Unsupported protocol', { status: 400, headers: CORS_HEADERS })
  }
  const upstream = await fetch(parsed.toString())
  if (!upstream.ok) {
    return new Response(`Upstream fetch failed: ${upstream.status}`, { status: 502, headers: CORS_HEADERS })
  }
  const text = await upstream.text()
  return new Response(text, { headers: { ...CORS_HEADERS, 'Content-Type': 'text/calendar' } })
}

export class SyncRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, title TEXT, done INTEGER, dueDate TEXT, createdAt TEXT, updatedAt TEXT, deleted INTEGER DEFAULT 0)',
      )
      this.ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, title TEXT, content TEXT, updatedAt TEXT, deleted INTEGER DEFAULT 0)',
      )
      this.ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT, start TEXT, end TEXT, allDay INTEGER, location TEXT, source TEXT, sourceName TEXT, updatedAt TEXT, deleted INTEGER DEFAULT 0)',
      )
    })
  }

  isAuthorized(request, url) {
    const expected = this.env.SYNC_SECRET
    const header = request.headers.get('Authorization') || ''
    const headerToken = header.replace(/^Bearer\s+/i, '')
    // Browsers can't set custom headers on a WebSocket upgrade request, so the
    // web build passes the secret as a query param instead. Electron uses the
    // header. Both are accepted.
    const queryToken = url.searchParams.get('token') || ''
    return !!expected && (headerToken === expected || queryToken === expected)
  }

  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (!this.isAuthorized(request, url)) {
      return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)
      server.send(JSON.stringify({ type: 'snapshot', ...this.snapshot() }))
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/health') {
      return new Response('ok', { headers: CORS_HEADERS })
    }

    if (url.pathname === '/proxy-ics') {
      return proxyIcs(url)
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS })
  }

  snapshot() {
    return {
      todos: this.rows('todos'),
      notes: this.rows('notes'),
      events: this.rows('events'),
    }
  }

  rows(table) {
    const raw = [...this.ctx.storage.sql.exec(`SELECT * FROM ${table} WHERE deleted = 0`)]
    return raw.map((r) => this.decode(table, r))
  }

  decode(table, row) {
    if (table === 'todos') return { ...row, done: !!row.done }
    if (table === 'events') return { ...row, allDay: !!row.allDay }
    return row
  }

  getRow(table, id) {
    const rows = [...this.ctx.storage.sql.exec(`SELECT * FROM ${table} WHERE id = ?`, id)]
    return rows[0] ?? null
  }

  async webSocketMessage(ws, message) {
    let msg
    try {
      msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message))
    } catch {
      return
    }
    if (msg.type !== 'mutate') return

    const table = ENTITY_TABLES[msg.entity]
    if (!table) return

    const existing = this.getRow(table, msg.data?.id)
    const incomingUpdatedAt = msg.data?.updatedAt ?? new Date(0).toISOString()
    const isNewer = !existing || incomingUpdatedAt > existing.updatedAt

    if (!isNewer) {
      // stale write - correct the sender with the canonical row instead of applying it
      if (existing) {
        ws.send(
          JSON.stringify({
            type: 'change',
            entity: msg.entity,
            op: existing.deleted ? 'delete' : 'upsert',
            data: this.decode(table, existing),
            clientMsgId: msg.clientMsgId,
          }),
        )
      }
      return
    }

    if (msg.op === 'delete') {
      this.ctx.storage.sql.exec(
        `INSERT INTO ${table} (id, updatedAt, deleted) VALUES (?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET updatedAt = excluded.updatedAt, deleted = 1`,
        msg.data.id,
        incomingUpdatedAt,
      )
      this.broadcast({ type: 'change', entity: msg.entity, op: 'delete', data: { id: msg.data.id, updatedAt: incomingUpdatedAt } })
      return
    }

    this.upsert(table, msg.entity, msg.data)
    const canonical = this.decode(table, this.getRow(table, msg.data.id))
    this.broadcast({ type: 'change', entity: msg.entity, op: 'upsert', data: canonical })
  }

  upsert(table, entity, data) {
    if (entity === 'todo') {
      this.ctx.storage.sql.exec(
        `INSERT INTO todos (id, title, done, dueDate, createdAt, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, done=excluded.done, dueDate=excluded.dueDate, updatedAt=excluded.updatedAt, deleted=0`,
        data.id, data.title, data.done ? 1 : 0, data.dueDate ?? null, data.createdAt, data.updatedAt,
      )
    } else if (entity === 'note') {
      this.ctx.storage.sql.exec(
        `INSERT INTO notes (id, title, content, updatedAt, deleted) VALUES (?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, updatedAt=excluded.updatedAt, deleted=0`,
        data.id, data.title, data.content, data.updatedAt,
      )
    } else if (entity === 'event') {
      this.ctx.storage.sql.exec(
        `INSERT INTO events (id, title, start, end, allDay, location, source, sourceName, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, start=excluded.start, end=excluded.end, allDay=excluded.allDay, location=excluded.location, source=excluded.source, sourceName=excluded.sourceName, updatedAt=excluded.updatedAt, deleted=0`,
        data.id, data.title, data.start, data.end ?? null, data.allDay ? 1 : 0, data.location ?? null, data.source ?? 'local', data.sourceName ?? null, data.updatedAt,
      )
    }
  }

  broadcast(payload) {
    const body = JSON.stringify(payload)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(body)
      } catch {
        // dead socket, hibernation API will clean it up
      }
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    // nothing to persist - connection state lives only in memory
  }

  async webSocketError(ws, error) {}
}

export default {
  async fetch(request, env) {
    const id = env.SYNC_DO.idFromName('main')
    const stub = env.SYNC_DO.get(id)
    return stub.fetch(request)
  },
}
