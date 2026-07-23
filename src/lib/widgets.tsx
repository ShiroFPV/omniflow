import { createContext, useContext, useState, type ReactNode } from 'react'

export interface DashboardWidgets {
  calendar: boolean
  tasks: boolean
  timer: boolean
  spotify: boolean
  notes: boolean
  habits: boolean
}

export type CardWidgetKey = 'calendar' | 'tasks' | 'timer' | 'spotify' | 'habits'

const STORAGE_KEY = 'omniflow-dashboard-widgets'
const ORDER_KEY = 'omniflow-dashboard-order'

// New widgets default to off - existing users shouldn't see their layout
// change out from under them just because a feature shipped.
const defaults: DashboardWidgets = { calendar: true, tasks: true, timer: true, spotify: true, notes: true, habits: false }
const defaultOrder: CardWidgetKey[] = ['calendar', 'tasks', 'timer', 'spotify', 'habits']

function getStored(): DashboardWidgets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch {
    return defaults
  }
}

function getStoredOrder(): CardWidgetKey[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (!raw) return defaultOrder
    const parsed: CardWidgetKey[] = JSON.parse(raw)
    // guard against a stale order missing/duplicating keys after a code update
    const valid = parsed.filter((k) => defaultOrder.includes(k))
    const missing = defaultOrder.filter((k) => !valid.includes(k))
    return [...valid, ...missing]
  } catch {
    return defaultOrder
  }
}

interface WidgetsContextValue {
  widgets: DashboardWidgets
  setWidget: (key: keyof DashboardWidgets, enabled: boolean) => void
  order: CardWidgetKey[]
  moveWidget: (from: CardWidgetKey, to: CardWidgetKey) => void
}

const WidgetsContext = createContext<WidgetsContextValue | null>(null)

export function WidgetsProvider({ children }: { children: ReactNode }) {
  const [widgets, setWidgets] = useState<DashboardWidgets>(getStored())
  const [order, setOrder] = useState<CardWidgetKey[]>(getStoredOrder())

  function setWidget(key: keyof DashboardWidgets, enabled: boolean) {
    const next = { ...widgets, [key]: enabled }
    setWidgets(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function moveWidget(from: CardWidgetKey, to: CardWidgetKey) {
    if (from === to) return
    const next = [...order]
    const fromIndex = next.indexOf(from)
    const toIndex = next.indexOf(to)
    if (fromIndex === -1 || toIndex === -1) return
    next.splice(fromIndex, 1)
    next.splice(toIndex, 0, from)
    setOrder(next)
    localStorage.setItem(ORDER_KEY, JSON.stringify(next))
  }

  return <WidgetsContext.Provider value={{ widgets, setWidget, order, moveWidget }}>{children}</WidgetsContext.Provider>
}

export function useWidgets() {
  const ctx = useContext(WidgetsContext)
  if (!ctx) throw new Error('useWidgets must be used within WidgetsProvider')
  return ctx
}
