import { getDb, type Todo, type Note, type CalendarEvent, type IcsSubscription } from './db'
import { pushChange, notifyRenderer } from './sync'

export interface BackupSnapshot {
  version: 1
  exportedAt: string
  todos: Todo[]
  notes: Note[]
  events: CalendarEvent[]
  icsSubscriptions: IcsSubscription[]
}

export async function exportAllData(): Promise<BackupSnapshot> {
  const db = await getDb()
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos: db.data.todos,
    notes: db.data.notes,
    events: db.data.events,
    icsSubscriptions: db.data.icsSubscriptions,
  }
}

function mergeByLastWriteWins<T extends { id: string; updatedAt: string }>(local: T[], incoming: T[]): T[] {
  const byId = new Map(local.map((item) => [item.id, item]))
  for (const item of incoming) {
    const existing = byId.get(item.id)
    if (!existing || item.updatedAt > existing.updatedAt) byId.set(item.id, item)
  }
  return [...byId.values()]
}

export async function importAllData(snapshot: BackupSnapshot): Promise<{ imported: number }> {
  const db = await getDb()
  db.data.todos = mergeByLastWriteWins(db.data.todos, snapshot.todos ?? [])
  db.data.notes = mergeByLastWriteWins(db.data.notes, snapshot.notes ?? [])
  db.data.events = mergeByLastWriteWins(db.data.events, snapshot.events ?? [])
  const existingSubIds = new Set(db.data.icsSubscriptions.map((s) => s.id))
  for (const sub of snapshot.icsSubscriptions ?? []) {
    if (!existingSubIds.has(sub.id)) db.data.icsSubscriptions.push(sub)
  }
  await db.write()

  for (const t of snapshot.todos ?? []) pushChange('todo', 'upsert', t)
  for (const n of snapshot.notes ?? []) pushChange('note', 'upsert', n)
  for (const e of snapshot.events ?? []) pushChange('event', 'upsert', e)
  notifyRenderer()

  return { imported: (snapshot.todos?.length ?? 0) + (snapshot.notes?.length ?? 0) + (snapshot.events?.length ?? 0) }
}
