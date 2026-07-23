import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Flame, Plus, X } from 'lucide-react'
import type { Habit } from '../types'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function computeStreak(dates: string[]): number {
  const set = new Set(dates)
  const cursor = new Date()
  if (!set.has(todayKey())) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    if (!set.has(key)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export default function HabitsWidget() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [name, setName] = useState('')

  async function refresh() {
    setHabits(await window.api.habits.list())
  }

  useEffect(() => {
    refresh()
    return window.api.onSyncChanged(() => refresh())
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await window.api.habits.add(name.trim())
    setName('')
    refresh()
  }

  async function toggleToday(id: string) {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h
        const key = todayKey()
        const done = h.completedDates.includes(key)
        return { ...h, completedDates: done ? h.completedDates.filter((d) => d !== key) : [...h.completedDates, key] }
      }),
    )
    await window.api.habits.toggleToday(id)
  }

  async function remove(id: string) {
    setHabits((prev) => prev.filter((h) => h.id !== id))
    await window.api.habits.delete(id)
  }

  const today = todayKey()

  return (
    <div className="flex h-full flex-col rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
        Habits
      </h3>
      <form onSubmit={add} className="mb-2 flex gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a habit..."
          className="flex-1 rounded-lg border px-2.5 py-1.5 text-[12px]"
          style={{ background: 'var(--raised)', borderColor: 'var(--border)' }}
        />
        <button
          type="submit"
          className="flex items-center justify-center rounded-lg px-2 text-white transition-transform active:scale-[0.95]"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={13} strokeWidth={2.5} />
        </button>
      </form>
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        <AnimatePresence initial={false}>
          {habits.map((habit) => {
            const done = habit.completedDates.includes(today)
            const streak = computeStreak(habit.completedDates)
            return (
              <motion.div
                layout
                key={habit.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-[var(--surface-hover)]"
              >
                <button
                  onClick={() => toggleToday(habit.id)}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]"
                  style={{
                    borderColor: done ? 'var(--success)' : 'var(--border-strong)',
                    background: done ? 'var(--success)' : 'transparent',
                  }}
                >
                  {done && <Check size={10} strokeWidth={3} className="text-[#0b0b10]" />}
                </button>
                <span className="flex-1 truncate text-[12px]">{habit.name}</span>
                {streak > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px]" style={{ color: '#f0955f' }}>
                    <Flame size={11} />
                    {streak}
                  </span>
                )}
                <button onClick={() => remove(habit.id)} className="opacity-0 group-hover:opacity-100" style={{ color: 'var(--text-faint)' }}>
                  <X size={11} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {habits.length === 0 && (
          <p className="py-4 text-center text-[11px]" style={{ color: 'var(--text-faint)' }}>
            No habits yet - add one to start a streak.
          </p>
        )}
      </div>
    </div>
  )
}
