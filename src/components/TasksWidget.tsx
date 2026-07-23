import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Plus, X } from 'lucide-react'
import type { Todo } from '../types'

export default function TasksWidget() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')

  async function refresh() {
    setTodos(await window.api.todos.list())
  }

  useEffect(() => {
    refresh()
    return window.api.onSyncChanged(() => refresh())
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await window.api.todos.add(title.trim(), null)
    setTitle('')
    refresh()
  }

  async function toggle(id: string) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
    await window.api.todos.toggle(id)
  }

  async function remove(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id))
    await window.api.todos.delete(id)
  }

  const pending = todos.filter((t) => !t.done)

  return (
    <div className="flex h-full flex-col rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
        To-do
      </h3>
      <form onSubmit={add} className="mb-2 flex gap-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task..."
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
          {pending.map((t) => (
            <motion.div
              layout
              key={t.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-[var(--surface-hover)]"
            >
              <button
                onClick={() => toggle(t.id)}
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px]"
                style={{ borderColor: 'var(--border-strong)' }}
              >
                {t.done && <Check size={9} strokeWidth={3} />}
              </button>
              <span className="flex-1 truncate text-[12px]">{t.title}</span>
              <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100" style={{ color: 'var(--text-faint)' }}>
                <X size={11} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {pending.length === 0 && (
          <p className="py-4 text-center text-[11px]" style={{ color: 'var(--text-faint)' }}>
            All clear.
          </p>
        )}
      </div>
    </div>
  )
}
