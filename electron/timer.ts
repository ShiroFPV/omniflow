import { getDb, type TimerSettings } from './db'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function getTimerSettings(): Promise<TimerSettings> {
  const db = await getDb()
  return db.data.settings.timer
}

export async function saveTimerSettings(settings: TimerSettings) {
  const db = await getDb()
  db.data.settings.timer = settings
  await db.write()
}

export async function logStudyMinutes(minutes: number) {
  const db = await getDb()
  const key = todayKey()
  const existing = db.data.studySessions.find((s) => s.date === key)
  if (existing) existing.minutes += minutes
  else db.data.studySessions.push({ date: key, minutes })
  await db.write()
}

export async function getStudyHistory() {
  const db = await getDb()
  const days: { date: string; minutes: number }[] = []
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
