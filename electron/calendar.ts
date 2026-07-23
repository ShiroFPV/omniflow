import ICAL from 'ical.js'
import { getDb, newId, type CalendarEvent, type IcsSubscription } from './db'

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

export async function importIcsFromText(icsText: string, sourceName: string) {
  const db = await getDb()
  const parsed = parseIcsToEvents(icsText, sourceName)
  db.data.events = db.data.events.filter((e: CalendarEvent) => e.sourceName !== sourceName)
  db.data.events.push(...parsed)
  await db.write()
  return parsed.length
}

export async function addIcsSubscription(name: string, url: string) {
  const db = await getDb()
  const sub = { id: newId(), name, url, lastSynced: null }
  db.data.icsSubscriptions.push(sub)
  await db.write()
  await syncIcsSubscription(sub.id)
  return sub
}

export async function removeIcsSubscription(id: string) {
  const db = await getDb()
  const sub = db.data.icsSubscriptions.find((s: IcsSubscription) => s.id === id)
  db.data.icsSubscriptions = db.data.icsSubscriptions.filter((s: IcsSubscription) => s.id !== id)
  if (sub) db.data.events = db.data.events.filter((e: CalendarEvent) => e.sourceName !== sub.name)
  await db.write()
}

export async function listIcsSubscriptions() {
  const db = await getDb()
  return db.data.icsSubscriptions
}

export async function syncIcsSubscription(id: string) {
  const db = await getDb()
  const sub = db.data.icsSubscriptions.find((s: IcsSubscription) => s.id === id)
  if (!sub) return 0
  const fetchUrl = sub.url.replace(/^webcal:\/\//i, 'https://')
  const res = await fetch(fetchUrl)
  if (!res.ok) throw new Error(`Failed to fetch calendar: ${res.status}`)
  const text = await res.text()
  const count = await importIcsFromText(text, sub.name)
  sub.lastSynced = new Date().toISOString()
  await db.write()
  return count
}

export async function syncAllIcsSubscriptions() {
  const db = await getDb()
  for (const sub of db.data.icsSubscriptions) {
    try {
      await syncIcsSubscription(sub.id)
    } catch {
      // leave stale data for this subscription if a sync fails; user can retry manually
    }
  }
}
