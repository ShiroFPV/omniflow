import { db } from './webStorage'
import { notifyChanged } from './events'
import type { Todo, Note, CalendarEvent } from '../types'

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
let reconnectTimer: number | null = null
let reconnectDelayMs = 1000
const outbox: OutboxItem[] = []

export function startWebSync() {
  const { cloudflareWorkerUrl, cloudflareSyncSecret } = db.data.settings
  if (!cloudflareWorkerUrl || !cloudflareSyncSecret) return
  connect(cloudflareWorkerUrl, cloudflareSyncSecret)
}

export function restartWebSync() {
  stopWebSync()
  startWebSync()
}

export function stopWebSync() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  reconnectDelayMs = 1000
  socket?.close()
  socket = null
}

export function isWebSyncConnected() {
  return socket?.readyState === WebSocket.OPEN
}

function connect(workerUrl: string, secret: string) {
  const wsUrl = workerUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
  socket = new WebSocket(`${wsUrl}/?token=${encodeURIComponent(secret)}`)

  socket.onopen = () => {
    reconnectDelayMs = 1000
    flushOutbox()
  }

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'snapshot') {
        applySnapshot(msg)
        notifyChanged()
      } else if (msg.type === 'change') {
        applyChange(msg.entity, msg.op, msg.data)
        notifyChanged()
      }
    } catch {
      // ignore malformed messages
    }
  }

  socket.onclose = scheduleReconnect
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    const { cloudflareWorkerUrl, cloudflareSyncSecret } = db.data.settings
    if (!cloudflareWorkerUrl || !cloudflareSyncSecret) return
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30_000)
    connect(cloudflareWorkerUrl, cloudflareSyncSecret)
  }, reconnectDelayMs)
}

function flushOutbox() {
  while (outbox.length && socket?.readyState === WebSocket.OPEN) {
    const item = outbox.shift()
    if (item) socket.send(JSON.stringify({ type: 'mutate', ...item }))
  }
}

export function pushWebChange(entity: Entity, op: Op, data: SyncPayload) {
  const item: OutboxItem = { entity, op, data, clientMsgId: `${Date.now()}-${Math.random().toString(36).slice(2)}` }
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'mutate', ...item }))
  } else {
    outbox.push(item)
  }
}

export function mergeByLastWriteWins<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map(local.map((item) => [item.id, item]))
  for (const remoteItem of remote) {
    const localItem = byId.get(remoteItem.id)
    if (!localItem || remoteItem.updatedAt > localItem.updatedAt) {
      byId.set(remoteItem.id, remoteItem)
    }
  }
  return [...byId.values()]
}

function applySnapshot(msg: { todos: Todo[]; notes: Note[]; events: CalendarEvent[] }) {
  db.data.todos = mergeByLastWriteWins(db.data.todos, msg.todos)
  db.data.notes = mergeByLastWriteWins(db.data.notes, msg.notes)
  db.data.events = mergeByLastWriteWins(db.data.events, msg.events)
  db.write()
}

function applyChange(entity: Entity, op: Op, data: (Todo | Note | CalendarEvent) & { id: string; updatedAt: string }) {
  if (entity === 'todo') {
    db.data.todos = op === 'delete' ? db.data.todos.filter((t) => t.id !== data.id) : mergeByLastWriteWins(db.data.todos, [data as Todo])
  } else if (entity === 'note') {
    db.data.notes = op === 'delete' ? db.data.notes.filter((n) => n.id !== data.id) : mergeByLastWriteWins(db.data.notes, [data as Note])
  } else if (entity === 'event') {
    db.data.events =
      op === 'delete' ? db.data.events.filter((e) => e.id !== data.id) : mergeByLastWriteWins(db.data.events, [data as CalendarEvent])
  }
  db.write()
}
