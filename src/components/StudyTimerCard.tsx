import { useEffect, useState } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { usePomodoro, formatCountdown } from '../hooks/usePomodoro'
import StudyBarChart from './StudyBarChart'
import type { StudyDay } from '../types'

export default function StudyTimerCard() {
  const { settings, updateSettings, phase, remainingSeconds, running, statusLabel, start, pause, reset } = usePomodoro()
  const [history, setHistory] = useState<StudyDay[]>([])

  useEffect(() => {
    refreshHistory()
    const interval = setInterval(refreshHistory, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (phase === 'idle' && remainingSeconds === settings.studyMinutes * 60) refreshHistory()
  }, [phase])

  async function refreshHistory() {
    setHistory(await window.api.timer.getHistory())
  }

  return (
    <Card>
      <div className="mb-3 text-center">
        <div className="font-mono text-[34px] font-semibold tracking-tight tabular-nums">
          {formatCountdown(remainingSeconds)}
        </div>
        <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {statusLabel}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1.5">
        <DurationField
          label="Study"
          value={settings.studyMinutes}
          onChange={(v) => updateSettings({ ...settings, studyMinutes: v })}
        />
        <DurationField
          label="Break"
          value={settings.breakMinutes}
          onChange={(v) => updateSettings({ ...settings, breakMinutes: v })}
        />
        <DurationField
          label="Long break"
          value={settings.longBreakMinutes}
          onChange={(v) => updateSettings({ ...settings, longBreakMinutes: v })}
        />
        <DurationField label="Cycles" value={settings.cycles} onChange={(v) => updateSettings({ ...settings, cycles: v })} />
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={running ? pause : start}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium text-white transition-transform active:scale-[0.97]"
          style={{ background: 'var(--accent)' }}
        >
          {running ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={reset}
          className="flex items-center justify-center rounded-xl border px-3 transition-colors hover:bg-[var(--raised)]"
          style={{ borderColor: 'var(--border)' }}
        >
          <RotateCcw size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {history.length > 0 && <StudyBarChart days={history} />}
    </Card>
  )
}

function DurationField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col items-center gap-1 rounded-lg py-1.5" style={{ background: 'var(--raised)' }}>
      <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
        {label}
      </span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="w-full bg-transparent text-center text-[13px] font-medium"
      />
    </label>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {children}
    </div>
  )
}
