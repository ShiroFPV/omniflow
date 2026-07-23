import { useEffect } from 'react'
import { notificationsEnabled, notify } from '../lib/notifications'

const NOTIFIED_KEY = 'omniflow-notified-tasks'

function getNotifiedToday(): Set<string> {
  const raw = localStorage.getItem(NOTIFIED_KEY)
  if (!raw) return new Set()
  try {
    const { date, ids } = JSON.parse(raw)
    return date === new Date().toISOString().slice(0, 10) ? new Set<string>(ids) : new Set()
  } catch {
    return new Set()
  }
}

function markNotified(ids: Set<string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10), ids: [...ids] }))
}

async function checkDueTasks() {
  if (!notificationsEnabled()) return
  const todos = await window.api.todos.list()
  const today = new Date().toISOString().slice(0, 10)
  const notified = getNotifiedToday()
  let changed = false
  for (const t of todos) {
    if (!t.done && t.dueDate && t.dueDate <= today && !notified.has(t.id)) {
      notify('Task due', t.title)
      notified.add(t.id)
      changed = true
    }
  }
  if (changed) markNotified(notified)
}

// Global, mounted once - independent of which widgets/pages happen to be visible.
export function useNotifications() {
  useEffect(() => {
    checkDueTasks()
    const interval = setInterval(checkDueTasks, 60_000)
    return () => clearInterval(interval)
  }, [])
}
