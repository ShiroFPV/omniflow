import { useState } from 'react'
import { format, parseISO, isToday } from 'date-fns'
import type { StudyDay } from '../types'

export default function StudyBarChart({ days }: { days: StudyDay[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...days.map((d) => d.minutes), 1)
  const activeIndex = hovered ?? days.findLastIndex((d) => isToday(parseISO(d.date)))
  const active = days[activeIndex] ?? days[days.length - 1]

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[11px]" style={{ color: 'var(--text-faint)' }}>
        <span>{active ? format(parseISO(active.date), 'EEEE') : ''}</span>
        <span className="font-medium" style={{ color: 'var(--text)' }}>
          {active ? `${Math.floor(active.minutes / 60)}h ${active.minutes % 60}m` : ''}
        </span>
      </div>
      <div className="flex h-14 items-end gap-1">
        {days.map((day, i) => {
          const today = isToday(parseISO(day.date))
          const heightPct = Math.max((day.minutes / max) * 100, 4)
          return (
            <button
              key={day.date}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              aria-label={`${format(parseISO(day.date), 'EEEE, MMM d')}: ${day.minutes} minutes studied`}
              className="flex flex-1 flex-col items-center gap-1 rounded-sm"
              style={{ maxWidth: 24 }}
            >
              <div
                className="w-full rounded-t-[4px] transition-all"
                style={{
                  height: `${heightPct}%`,
                  minHeight: 3,
                  background: 'var(--accent)',
                  opacity: today || i === hovered ? 1 : 0.4,
                }}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex gap-1 text-center text-[10px]" style={{ color: 'var(--text-faint)' }}>
        {days.map((day) => (
          <span key={day.date} className="flex-1" style={{ maxWidth: 24 }}>
            {format(parseISO(day.date), 'EEEEE')}
          </span>
        ))}
      </div>
    </div>
  )
}
