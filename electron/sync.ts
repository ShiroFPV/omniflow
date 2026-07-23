import WebSocket from 'ws'
import { BrowserWindow } from 'electron'
import { getDb, type Todo, type Note, type CalendarEvent } from './db'
import { getCloudflareSyncConfig } from './cloudflare'

type Entity = 'todo' | 'note' | 'event'
type Op = 'upsert' | 'delete'
type SyncPayload = Todo | Note | CalendarEvent | { id: string; updatedAt: string }

interface OutboxItem {
  entity: Entity
  op: Op
  data: SyncPayload
  clientMsgId: string
}

let socket: WebSocket | null = null
let reconnectTimer: NodeJS.Timeout | null = null
let reconnectDelayMs = 1000
const outbox: OutboxItem[] = []

export function notifyRenderer() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('sync:changed')
  }
}

export async function startSyncEngine() {
  const { workerUrl, syncSecret } = await getCloudflareSyncConfig()
  if (!workerUrl || !syncSecret) return
  connect(workerUrl, syncSecret)
}

export async function restartSyncEngine() {
  stopSyncEngine()
  await startSyncEngine()
}

export function stopSyncEngine() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  reconnectDelayMs = 1000
  socket?.removeAllListeners()
  socket?.close()
  socket = null
}

export function isSyncConnected() {
  return socket?.readyState === WebSocket.OPEN
}

function connect(workerUrl: string, syncSecret: string) {
  const wsUrl = workerUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
  socket = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${syncSecret}` } })

  socket.on('open', () => {
    reconnectDelayMs = 1000
    flushOutbox()
  })

  socket.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'snapshot') {
        await applySnapshot(msg)
        notifyRenderer()
      } else if (msg.type === 'change') {
        await applyChange(msg.entity, msg.op, msg.data)
        notifyRenderer()
      }
    } catch {
      // ignore malformed messages
    }
  })

  socket.on('close', scheduleReconnect)
  socket.on('error', () => {
    /* close event follows; reconnect handled there */
  })
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    const { workerUrl, syncSecret } = await getCloudflareSyncConfig()
    if (!workerUrl || !syncSecret) return
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30_000)
    connect(workerUrl, syncSecret)
  }, reconnectDelayMs)
}

function flushOutbox() {
  while (outbox.length && socket?.readyState === WebSocket.OPEN) {
    const item = outbox.shift()
    if (item) socket.send(JSON.stringify({ type: 'mutate', ...item }))
  }
}

export function pushChange(entity: Entity, op: Op, data: SyncPayload) {
  const item: OutboxItem = { entity, op, data, clientMsgId: `${Date.now()}-${Math.random().toString(36).slice(2)}` }
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'mutate', ...item }))
  } else {
    outbox.push(item)
  }
}

async function applySnapshot(msg: { todos: Todo[]; notes: Note[]; events: CalendarEvent[] }) {
  const db = await getDb()
  db.data.todos = mergeByLastWriteWins(db.data.todos, msg.todos)
  db.data.notes = mergeByLastWriteWins(db.data.notes, msg.notes)
  db.data.events = mergeByLastWriteWins(db.data.events, msg.events)
  await db.write()
}

function mergeByLastWriteWins<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map(local.map((item) => [item.id, item]))
  for (const remoteItem of remote) {
    const localItem = byId.get(remoteItem.id)
    if (!localItem || remoteItem.updatedAt > localItem.updatedAt) {
      byId.set(remoteItem.id, remoteItem)
    }
  }
  return [...byId.values()]
}

async function applyChange(entity: Entity, op: Op, data: Record<string, unknown> & { id: string; updatedAt: string }) {
  const db = await getDb()
  if (entity === 'todo') {
    if (op === 'delete') {
      db.data.todos = db.data.todos.filter((t) => t.id !== data.id)
    } else {
      db.data.todos = mergeByLastWriteWins(db.data.todos, [data as unknown as Todo])
    }
  } else if (entity === 'note') {
    if (op === 'delete') {
      db.data.notes = db.data.notes.filter((n) => n.id !== data.id)
    } else {
      db.data.notes = mergeByLastWriteWins(db.data.notes, [data as unknown as Note])
    }
  } else if (entity === 'event') {
    if (op === 'delete') {
      db.data.events = db.data.events.filter((e) => e.id !== data.id)
    } else {
      db.data.events = mergeByLastWriteWins(db.data.events, [data as unknown as CalendarEvent])
    }
  }
  await db.write()
}
