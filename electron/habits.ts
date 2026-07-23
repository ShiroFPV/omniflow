import { getDb, newId, type Habit } from './db'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function listHabits(): Promise<Habit[]> {
  const db = await getDb()
  return db.data.habits
}

export async function addHabit(name: string): Promise<Habit> {
  const db = await getDb()
  const habit: Habit = { id: newId(), name, createdAt: new Date().toISOString(), completedDates: [] }
  db.data.habits.push(habit)
  await db.write()
  return habit
}

export async function toggleHabitToday(id: string): Promise<Habit | undefined> {
  const db = await getDb()
  const habit = db.data.habits.find((h) => h.id === id)
  if (!habit) return undefined
  const key = todayKey()
  habit.completedDates = habit.completedDates.includes(key)
    ? habit.completedDates.filter((d) => d !== key)
    : [...habit.completedDates, key]
  await db.write()
  return habit
}

export async function deleteHabit(id: string) {
  const db = await getDb()
  db.data.habits = db.data.habits.filter((h) => h.id !== id)
  await db.write()
}
