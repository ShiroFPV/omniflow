import { useEffect, useRef, useState } from 'react'
import type { TimerSettings } from '../types'
import { notify } from '../lib/notifications'

type Phase = 'idle' | 'study' | 'break' | 'longBreak' | 'done'

const DEFAULT_SETTINGS: TimerSettings = { studyMinutes: 30, breakMinutes: 5, longBreakMinutes: 15, cycles: 4 }

export function usePomodoro() {
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS)
  const [phase, setPhase] = useState<Phase>('idle')
  const [cycle, setCycle] = useState(1)
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_SETTINGS.studyMinutes * 60)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    window.api.timer.getSettings().then((s) => {
      setSettings(s)
      setRemainingSeconds(s.studyMinutes * 60)
    })
  }, [])

  useEffect(() => {
    if (!running) return
    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev > 1) return prev - 1
        advancePhase()
        return 0
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, cycle, settings])

  function advancePhase() {
    if (phase === 'study') {
      window.api.timer.logSession(settings.studyMinutes)
      if (cycle >= settings.cycles) {
        setPhase('longBreak')
        setRemainingSeconds(settings.longBreakMinutes * 60)
        notify('Study session complete', 'Time for a long break.')
      } else {
        setPhase('break')
        setRemainingSeconds(settings.breakMinutes * 60)
        notify('Study session complete', 'Time for a short break.')
      }
    } else if (phase === 'break') {
      setCycle((c) => c + 1)
      setPhase('study')
      setRemainingSeconds(settings.studyMinutes * 60)
      notify('Break over', 'Back to studying.')
    } else if (phase === 'longBreak') {
      setPhase('done')
      setRunning(false)
      notify('All cycles complete', 'Nice work today.')
    }
  }

  function start() {
    if (phase === 'idle' || phase === 'done') {
      setPhase('study')
      setCycle(1)
      setRemainingSeconds(settings.studyMinutes * 60)
    }
    setRunning(true)
  }

  function pause() {
    setRunning(false)
  }

  function reset() {
    setRunning(false)
    setPhase('idle')
    setCycle(1)
    setRemainingSeconds(settings.studyMinutes * 60)
  }

  async function updateSettings(next: TimerSettings) {
    setSettings(next)
    await window.api.timer.saveSettings(next)
    if (phase === 'idle') setRemainingSeconds(next.studyMinutes * 60)
  }

  const statusLabel =
    phase === 'idle'
      ? `Ready · Cycle 1/${settings.cycles}`
      : phase === 'study'
        ? `Studying · Cycle ${cycle}/${settings.cycles}`
        : phase === 'break'
          ? `Break · Cycle ${cycle}/${settings.cycles}`
          : phase === 'longBreak'
            ? 'Long break'
            : 'Done for now 🎉'

  return {
    settings,
    updateSettings,
    phase,
    cycle,
    remainingSeconds,
    running,
    statusLabel,
    start,
    pause,
    reset,
  }
}

export function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}
