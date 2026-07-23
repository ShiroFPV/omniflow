import ICAL from 'ical.js'
import type { Api, Todo, Note, CalendarEvent, IcsSubscription, TimerSettings, BackupSnapshot, Habit } from '../types'
import { db, newId, todayKey, getStudyHistory } from './webStorage'
import { onChanged, notifyChanged } from './events'
import { startWebSync, restartWebSync, stopWebSync, isWebSyncConnected, pushWebChange, mergeByLastWriteWins } from './webSync'
import {
  startWebSpotifyLogin,
  completeWebSpotifyLoginIfRedirected,
  webSpotifyStatus,
  disconnectWebSpotify,
  getWebNowPlaying,
  webSpotifyControl,
} from './webSpotify'

function parseIcsToEvents(icsText: string, sourceName: string): CalendarEvent[] {
  const jcalData = ICAL.parse(icsText)
  const comp = new ICAL.Component(jcalData)
  const vevents = comp.getAllSubcomponents('vevent')
  return vevents.map((vevent) => {
    const event = new ICAL.Event(vevent)
    return {
      id: newId(),
      title: event.summary || '(untitled)',
      start: event.startDate?.toJSDate().toISOString() ?? new Date().toISOString(),
      end: event.endDate?.toJSDate().toISOString() ?? null,
      allDay: event.startDate?.isDate ?? false,
      location: event.location || null,
      source: 'ics' as const,
      sourceName,
      updatedAt: new Date().toISOString(),
    }
  })
}

function importIcsText(icsText: string, sourceName: string) {
  const parsed = parseIcsToEvents(icsText, sourceName)
  db.data.events = db.data.events.filter((e) => e.sourceName !== sourceName)
  db.data.events.push(...parsed)
  db.write()
  return parsed.length
}

async function fetchIcsViaProxy(url: string) {
  const { cloudflareWorkerUrl, cloudflareSyncSecret } = db.data.settings
  if (!cloudflareWorkerUrl || !cloudflareSyncSecret) {
    throw new Error('Connect cloud sync first - calendar subscriptions need it to fetch ICS feeds around browser CORS limits.')
  }
  const res = await fetch(
    `${cloudflareWorkerUrl}/proxy-ics?url=${encodeURIComponent(url)}`,
    { headers: { Authorization: `Bearer ${cloudflareSyncSecret}` } },
  )
  if (!res.ok) throw new Error(`Failed to fetch calendar: ${res.status}`)
  return res.text()
}

export const webApi: Api = {
  todos: {
    async list() {
      return db.data.todos
    },
    async add(title, dueDate) {
      const now = new Date().toISOString()
      const todo: Todo = { id: newId(), title, done: false, dueDate, createdAt: now, updatedAt: now }
      db.data.todos.unshift(todo)
      await db.write()
      pushWebChange('todo', 'upsert', todo)
      notifyChanged()
      return todo
    },
    async toggle(id) {
      const todo = db.data.todos.find((t) => t.id === id)
      if (todo) {
        todo.done = !todo.done
        todo.updatedAt = new Date().toISOString()
        await db.write()
        pushWebChange('todo', 'upsert', todo)
        notifyChanged()
      }
      return todo
    },
    async delete(id) {
      db.data.todos = db.data.todos.filter((t) => t.id !== id)
      await db.write()
      pushWebChange('todo', 'delete', { id, updatedAt: new Date().toISOString() })
      notifyChanged()
    },
  },
  notes: {
    async list() {
      return db.data.notes
    },
    async add() {
      const note: Note = { id: newId(), title: 'Untitled note', content: '', updatedAt: new Date().toISOString() }
      db.data.notes.unshift(note)
      await db.write()
      pushWebChange('note', 'upsert', note)
      notifyChanged()
      return note
    },
    async update(id, title, content) {
      const note = db.data.notes.find((n) => n.id === id)
      if (note) {
        note.title = title
        note.content = content
        note.updatedAt = new Date().toISOString()
        await db.write()
        pushWebChange('note', 'upsert', note)
        notifyChanged()
      }
      return note
    },
    async delete(id) {
      db.data.notes = db.data.notes.filter((n) => n.id !== id)
      await db.write()
      pushWebChange('note', 'delete', { id, updatedAt: new Date().toISOString() })
      notifyChanged()
    },
  },
  events: {
    async list() {
      return db.data.events
    },
    async add(partial) {
      const event: CalendarEvent = {
        id: newId(),
        title: partial.title ?? '(untitled)',
        start: partial.start ?? new Date().toISOString(),
        end: partial.end ?? null,
        allDay: partial.allDay ?? false,
        location: partial.location ?? null,
        source: 'local',
        sourceName: null,
        updatedAt: new Date().toISOString(),
      }
      db.data.events.push(event)
      await db.write()
      pushWebChange('event', 'upsert', event)
      notifyChanged()
      return event
    },
    async delete(id) {
      db.data.events = db.data.events.filter((e) => e.id !== id)
      await db.write()
      pushWebChange('event', 'delete', { id, updatedAt: new Date().toISOString() })
      notifyChanged()
    },
    async importIcsFile() {
      const file = await pickFile('.ics')
      if (!file) return 0
      const text = await file.text()
      const count = importIcsText(text, file.name)
      notifyChanged()
      return count
    },
    subscriptions: {
      async list() {
        return db.data.icsSubscriptions
      },
      async add(name, url) {
        const sub: IcsSubscription = { id: newId(), name, url, lastSynced: null }
        db.data.icsSubscriptions.push(sub)
        await db.write()
        await this.sync(sub.id)
        notifyChanged()
        return sub
      },
      async remove(id) {
        const sub = db.data.icsSubscriptions.find((s) => s.id === id)
        db.data.icsSubscriptions = db.data.icsSubscriptions.filter((s) => s.id !== id)
        if (sub) db.data.events = db.data.events.filter((e) => e.sourceName !== sub.name)
        await db.write()
        notifyChanged()
      },
      async sync(id) {
        const sub = db.data.icsSubscriptions.find((s) => s.id === id)
        if (!sub) return 0
        const text = await fetchIcsViaProxy(sub.url)
        const count = importIcsText(text, sub.name)
        sub.lastSynced = new Date().toISOString()
        await db.write()
        notifyChanged()
        return count
      },
    },
  },
  spotify: {
    login: startWebSpotifyLogin,
    status: webSpotifyStatus,
    disconnect: disconnectWebSpotify,
    nowPlaying: getWebNowPlaying,
    control: webSpotifyControl,
  },
  cloudflare: {
    async provision() {
      throw new Error(
        'The web version can\'t create a new Cloudflare backend itself (Cloudflare\'s API blocks direct browser calls). ' +
          'Use the desktop app to create one, then pair this browser with the resulting Worker URL and secret.',
      )
    },
    async redeploy() {
      throw new Error('The web version can\'t redeploy the Worker either, for the same CORS reason - use the desktop app.')
    },
    async pair(workerUrl, syncSecret) {
      db.data.settings.cloudflareWorkerUrl = workerUrl.replace(/\/+$/, '')
      db.data.settings.cloudflareSyncSecret = syncSecret
      await db.write()
      restartWebSync()
    },
    async disconnect() {
      stopWebSync()
      db.data.settings.cloudflareWorkerUrl = null
      db.data.settings.cloudflareSyncSecret = null
      await db.write()
    },
    async status() {
      const { cloudflareWorkerUrl, cloudflareSyncSecret } = db.data.settings
      return {
        configured: !!cloudflareWorkerUrl,
        connected: isWebSyncConnected(),
        workerUrl: cloudflareWorkerUrl,
        syncSecret: cloudflareSyncSecret,
      }
    },
  },
  timer: {
    async getSettings() {
      return db.data.settings.timer
    },
    async saveSettings(settings: TimerSettings) {
      db.data.settings.timer = settings
      await db.write()
    },
    async logSession(minutes) {
      const key = todayKey()
      const existing = db.data.studySessions.find((s) => s.date === key)
      if (existing) existing.minutes += minutes
      else db.data.studySessions.push({ date: key, minutes })
      await db.write()
    },
    async getHistory() {
      return getStudyHistory()
    },
  },
  data: {
    async exportAll() {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        todos: db.data.todos,
        notes: db.data.notes,
        events: db.data.events,
        icsSubscriptions: db.data.icsSubscriptions,
      }
    },
    async importAll(snapshot: BackupSnapshot) {
      db.data.todos = mergeByLastWriteWins(db.data.todos, snapshot.todos ?? [])
      db.data.notes = mergeByLastWriteWins(db.data.notes, snapshot.notes ?? [])
      db.data.events = mergeByLastWriteWins(db.data.events, snapshot.events ?? [])
      const existingSubIds = new Set(db.data.icsSubscriptions.map((s) => s.id))
      for (const sub of snapshot.icsSubscriptions ?? []) {
        if (!existingSubIds.has(sub.id)) db.data.icsSubscriptions.push(sub)
      }
      await db.write()
      for (const t of snapshot.todos ?? []) pushWebChange('todo', 'upsert', t)
      for (const n of snapshot.notes ?? []) pushWebChange('note', 'upsert', n)
      for (const e of snapshot.events ?? []) pushWebChange('event', 'upsert', e)
      notifyChanged()
      return { imported: (snapshot.todos?.length ?? 0) + (snapshot.notes?.length ?? 0) + (snapshot.events?.length ?? 0) }
    },
  },
  habits: {
    async list() {
      return db.data.habits
    },
    async add(name: string) {
      const habit: Habit = { id: newId(), name, createdAt: new Date().toISOString(), completedDates: [] }
      db.data.habits.push(habit)
      await db.write()
      notifyChanged()
      return habit
    },
    async toggleToday(id: string) {
      const habit = db.data.habits.find((h) => h.id === id)
      if (!habit) return undefined
      const key = todayKey()
      habit.completedDates = habit.completedDates.includes(key)
        ? habit.completedDates.filter((d) => d !== key)
        : [...habit.completedDates, key]
      await db.write()
      notifyChanged()
      return habit
    },
    async delete(id: string) {
      db.data.habits = db.data.habits.filter((h) => h.id !== id)
      await db.write()
      notifyChanged()
    },
  },
  onSyncChanged: onChanged,
  platform: 'web',
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

export async function bootstrapWebApi() {
  window.api = webApi
  await completeWebSpotifyLoginIfRedirected()
  startWebSync()
  // Keep local-only mutations (no cloud sync configured) visually consistent
  // with the Electron build's polling-refresh pattern.
  window.addEventListener('storage', notifyChanged)
}
