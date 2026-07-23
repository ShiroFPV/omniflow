import { useEffect, useState } from 'react'
import { format, parseISO, isToday, isFuture } from 'date-fns'
import { Plus, Link2, RefreshCw, X } from 'lucide-react'
import type { CalendarEvent, IcsSubscription } from '../types'

const DOT_COLORS = ['#8b6bf2', '#f0955f', '#5fb8f0', '#5fd68a']

export default function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [subs, setSubs] = useState<IcsSubscription[]>([])
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [showSubs, setShowSubs] = useState(false)
  const [subName, setSubName] = useState('')
  const [subUrl, setSubUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const [ev, sb] = await Promise.all([window.api.events.list(), window.api.events.subscriptions.list()])
    setEvents(ev)
    setSubs(sb)
  }

  useEffect(() => {
    refresh()
    return window.api.onSyncChanged(() => refresh())
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !start) return
    await window.api.events.add({ title: title.trim(), start: new Date(start).toISOString() })
    setTitle('')
    setStart('')
    refresh()
  }

  async function addSubscription(e: React.FormEvent) {
    e.preventDefault()
    if (!subName.trim() || !subUrl.trim()) return
    setBusy(true)
    try {
      await window.api.events.subscriptions.add(subName.trim(), subUrl.trim())
      setSubName('')
      setSubUrl('')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function syncSubscription(id: string) {
    setBusy(true)
    try {
      await window.api.events.subscriptions.sync(id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function removeSubscription(id: string) {
    await window.api.events.subscriptions.remove(id)
    refresh()
  }

  const upcoming = events
    .filter((ev) => isToday(parseISO(ev.start)) || isFuture(parseISO(ev.start)))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6)

  return (
    <div className="flex h-full flex-col rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
          Calendar
        </h3>
        <button
          onClick={() => setShowSubs(!showSubs)}
          title="Connect an Outlook/Apple/Google calendar via its ICS link"
          className="flex items-center gap-1 text-[10px]"
          style={{ color: showSubs ? 'var(--accent)' : 'var(--text-faint)' }}
        >
          <Link2 size={11} />
          {subs.length > 0 ? `${subs.length} connected` : 'Connect'}
        </button>
      </div>

      {showSubs && (
        <div className="mb-2 space-y-1.5 rounded-lg p-2" style={{ background: 'var(--raised)' }}>
          <form onSubmit={addSubscription} className="space-y-1">
            <input
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Name (e.g. Work Outlook)"
              className="w-full rounded-md border px-2 py-1 text-[11px]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
            <div className="flex gap-1">
              <input
                value={subUrl}
                onChange={(e) => setSubUrl(e.target.value)}
                placeholder="webcal:// or https:// ICS link"
                className="flex-1 rounded-md border px-2 py-1 text-[11px]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-md px-2 text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                <Plus size={12} />
              </button>
            </div>
          </form>
          {subs.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md px-1.5 py-1 text-[11px]" style={{ background: 'var(--surface)' }}>
              <span className="truncate">{s.name}</span>
              <div className="flex items-center gap-1.5 text-[var(--text-faint)]">
                <button onClick={() => syncSubscription(s.id)} disabled={busy} style={{ color: 'var(--accent)' }}>
                  <RefreshCw size={11} />
                </button>
                <button onClick={() => removeSubscription(s.id)}>
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="mb-2 space-y-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add event"
          className="w-full rounded-lg border px-2.5 py-1.5 text-[12px]"
          style={{ background: 'var(--raised)', borderColor: 'var(--border)' }}
        />
        <div className="flex gap-1.5">
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="flex-1 rounded-lg border px-2 py-1.5 text-[11px]"
            style={{ background: 'var(--raised)', borderColor: 'var(--border)' }}
          />
          <button
            type="submit"
            className="flex items-center justify-center rounded-lg px-2 text-white transition-transform active:scale-[0.95]"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={13} strokeWidth={2.5} />
          </button>
        </div>
      </form>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {upcoming.map((ev, i) => (
          <div key={ev.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-[var(--surface-hover)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px]">{ev.title}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                {format(parseISO(ev.start), 'MMM d, HH:mm')}
              </div>
            </div>
          </div>
        ))}
        {upcoming.length === 0 && (
          <p className="py-4 text-center text-[11px]" style={{ color: 'var(--text-faint)' }}>
            Nothing coming up.
          </p>
        )}
      </div>
    </div>
  )
}
