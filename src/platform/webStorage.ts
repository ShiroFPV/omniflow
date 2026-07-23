import type { Todo, Note, CalendarEvent, IcsSubscription, TimerSettings, StudyDay, Habit } from '../types'

export interface WebSettings {
  spotifyClientId: string | null
  spotifyAccessToken: string | null
  spotifyRefreshToken: string | null
  spotifyTokenExpiresAt: number | null
  spotifyCodeVerifier: string | null
  cloudflareWorkerUrl: string | null
  cloudflareSyncSecret: string | null
  timer: TimerSettings
}

interface StudySession {
  date: string
  minutes: number
}

interface WebSchema {
  todos: Todo[]
  notes: Note[]
  events: CalendarEvent[]
  icsSubscriptions: IcsSubscription[]
  studySessions: StudySession[]
  habits: Habit[]
  settings: WebSettings
}

const STORAGE_KEY = 'omniflow-data'

const defaultData: WebSchema = {
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
    spotifyCodeVerifier: null,
    cloudflareWorkerUrl: null,
    cloudflareSyncSecret: null,
    timer: { studyMinutes: 30, breakMinutes: 5, longBreakMinutes: 15, cycles: 4 },
  },
}

let cache: WebSchema | null = null

function load(): WebSchema {
  if (cache) return cache
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    cache = structuredClone(defaultData)
    return cache
  }
  try {
    const parsed = JSON.parse(raw)
    cache = { ...structuredClone(defaultData), ...parsed, settings: { ...defaultData.settings, ...parsed.settings } }
  } catch {
    cache = structuredClone(defaultData)
  }
  return cache!
}

function save() {
  if (cache) localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
}

export const db = {
  get data() {
    return load()
  },
  write: async () => save(),
}

export function newId() {
  return crypto.randomUUID()
}

export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getStudyHistory(): StudyDay[] {
  const days: StudyDay[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const entry = db.data.studySessions.find((s) => s.date === key)
    days.push({ date: key, minutes: entry?.minutes ?? 0 })
  }
  return days
}
