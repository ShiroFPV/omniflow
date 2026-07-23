import { useRef } from 'react'
import { motion, useDragControls, type PanInfo } from 'framer-motion'
import { GripVertical, LayoutGrid } from 'lucide-react'
import CalendarWidget from '../components/CalendarWidget'
import TasksWidget from '../components/TasksWidget'
import StudyTimerCard from '../components/StudyTimerCard'
import SpotifyWidget from '../components/SpotifyWidget'
import NotesWidget from '../components/NotesWidget'
import HabitsWidget from '../components/HabitsWidget'
import { useWidgets, type CardWidgetKey } from '../lib/widgets'

const CARD_COMPONENTS: Record<CardWidgetKey, React.ReactNode> = {
  calendar: <CalendarWidget />,
  tasks: <TasksWidget />,
  timer: <StudyTimerCard />,
  habits: <HabitsWidget />,
  spotify: (
    <div className="h-full rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
        Now playing
      </h3>
      <SpotifyWidget />
    </div>
  ),
}

const CARD_HEIGHTS: Record<CardWidgetKey, number | undefined> = {
  calendar: 260,
  tasks: 260,
  timer: undefined,
  spotify: 260,
  habits: 260,
}

export default function DashboardPage() {
  const { widgets, order, moveWidget } = useWidgets()
  const cardRefs = useRef(new Map<CardWidgetKey, HTMLDivElement>())

  const visibleOrder = order.filter((k) => widgets[k])
  const anyVisible = visibleOrder.length > 0 || widgets.notes

  function registerRef(key: CardWidgetKey, el: HTMLDivElement | null) {
    if (el) cardRefs.current.set(key, el)
    else cardRefs.current.delete(key)
  }

  function handleDrop(draggedKey: CardWidgetKey, point: { x: number; y: number }) {
    let closestKey: CardWidgetKey | null = null
    let closestDist = Infinity
    for (const [key, el] of cardRefs.current) {
      if (key === draggedKey) continue
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dist = Math.hypot(point.x - cx, point.y - cy)
      const inside = point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
      if (inside || dist < closestDist) {
        closestDist = inside ? -1 : dist
        closestKey = key
      }
    }
    if (closestKey) moveWidget(draggedKey, closestKey)
  }

  if (!anyVisible) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <LayoutGrid size={28} strokeWidth={1.5} style={{ color: 'var(--text-faint)' }} />
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
          All dashboard widgets are hidden - turn some back on in Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleOrder.map((key) => (
            <DraggableCard
              key={key}
              widgetKey={key}
              registerRef={registerRef}
              onDrop={handleDrop}
              height={CARD_HEIGHTS[key]}
            >
              {CARD_COMPONENTS[key]}
            </DraggableCard>
          ))}
        </div>
        {widgets.notes && <NotesWidget />}
      </div>
    </div>
  )
}

function DraggableCard({
  widgetKey,
  registerRef,
  onDrop,
  height,
  children,
}: {
  widgetKey: CardWidgetKey
  registerRef: (key: CardWidgetKey, el: HTMLDivElement | null) => void
  onDrop: (key: CardWidgetKey, point: { x: number; y: number }) => void
  height: number | undefined
  children: React.ReactNode
}) {
  const dragControls = useDragControls()

  function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    onDrop(widgetKey, info.point)
  }

  return (
    <motion.div
      layout
      drag
      dragListener={false}
      dragControls={dragControls}
      dragSnapToOrigin
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      whileDrag={{ zIndex: 20, boxShadow: '0 16px 32px rgba(0,0,0,0.3)' }}
      ref={(el) => registerRef(widgetKey, el)}
      className="relative"
      style={{ height }}
    >
      <button
        onPointerDown={(e) => dragControls.start(e)}
        title="Drag to reorder"
        className="no-select absolute right-2 top-2 z-10 flex h-6 w-6 cursor-grab items-center justify-center rounded-md transition-colors hover:bg-[var(--raised)] active:cursor-grabbing"
        style={{ color: 'var(--text-faint)' }}
      >
        <GripVertical size={13} />
      </button>
      <div className="h-full">{children}</div>
    </motion.div>
  )
}
