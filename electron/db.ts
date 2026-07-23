import { app } from 'electron'
import { JSONFilePreset } from 'lowdb/node'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export interface Todo {
  id: string
  title: string
  done: boolean
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  location: string | null
  source: 'local' | 'ics'
  sourceName: string | null
  updatedAt: string
}

export interface IcsSubscription {
  id: string
  name: string
  url: string
  lastSynced: string | null
}

export interface TimerSettings {
  studyMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  cycles: number
}

export interface StudySession {
  date: string // YYYY-MM-DD, local
  minutes: number
}

export interface Habit {
  id: string
  name: string
  createdAt: string
  completedDates: string[] // YYYY-MM-DD, local
}

export interface Settings {
  spotifyClientId: string | null
  spotifyAccessToken: string | null
  spotifyRefreshToken: string | null
  spotifyTokenExpiresAt: number | null
  cloudflareWorkerUrl: string | null
  cloudflareSyncSecret: string | null
  timer: TimerSettings
}

interface Schema {
  todos: Todo[]
  notes: Note[]
  events: CalendarEvent[]
  icsSubscriptions: IcsSubscription[]
  studySessions: StudySession[]
  habits: Habit[]
  settings: Settings
}

const defaultData: Schema = {
  todos: [],
  notes: [],
  events: [],
  icsSubscriptions: [],
  studySessions: [],
  habits: [],
  settings: {
    spotifyClientId: null,
    spotifyAccessToken: null,
    spotifyRefreshToken: null,
    spotifyTokenExpiresAt: null,
    cloudflareWorkerUrl: null,
    cloudflareSyncSecret: null,
    timer: { studyMinutes: 30, breakMinutes: 5, longBreakMinutes: 15, cycles: 4 },
  },
}

let dbPromise: ReturnType<typeof JSONFilePreset<Schema>> | null = null

export function getDb() {
  if (!dbPromise) {
    const file = path.join(app.getPath('userData'), 'db.json')
    // JSONFilePreset only applies defaultData to a brand-new file - it does not
    // backfill fields added to the schema after a user's db.json already exists.
    // Each new persisted field needs an explicit backfill line here.
    dbPromise = JSONFilePreset<Schema>(file, defaultData).then(async (db) => {
      let changed = false
      if (!db.data.studySessions) {
        db.data.studySessions = []
        changed = true
      }
      if (!db.data.habits) {
        db.data.habits = []
        changed = true
      }
      if (!db.data.settings.timer) {
        db.data.settings.timer = defaultData.settings.timer
        changed = true
      }
      if (changed) await db.write()
      return db
    })
  }
  return dbPromise
}

export function newId() {
  return randomUUID()
}
