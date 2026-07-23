import { useEffect, useMemo, useRef, useState } from 'react'
import { Settings, Sun, Moon, Plus, Play, SkipForward, Download, Search } from 'lucide-react'
import { useTheme } from '../lib/theme'
import { exportBackup } from '../lib/backup'
import { onOpenPalette } from '../lib/paletteBus'
import { openSettings } from '../lib/settingsBus'

interface Command {
  id: string
  label: string
  keywords?: string
  icon: typeof Search
  perform: () => void | Promise<void>
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => onOpenPalette(() => setOpen(true)), [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const commands = useMemo<Command[]>(
    () => [
      { id: 'go-settings', label: 'Open Settings', icon: Settings, perform: openSettings },
      {
        id: 'toggle-theme',
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: theme === 'dark' ? Sun : Moon,
        perform: toggleTheme,
      },
      {
        id: 'new-task',
        label: 'New task',
        keywords: 'add create todo',
        icon: Plus,
        perform: () => {
          window.api.todos.add('New task', null)
        },
      },
      {
        id: 'new-note',
        label: 'New note',
        keywords: 'add create',
        icon: Plus,
        perform: () => {
          window.api.notes.add()
        },
      },
      {
        id: 'new-habit',
        label: 'New habit',
        keywords: 'add create streak',
        icon: Plus,
        perform: () => {
          window.api.habits.add('New habit')
        },
      },
      {
        id: 'spotify-play',
        label: 'Spotify: play / pause',
        keywords: 'music resume toggle',
        icon: Play,
        perform: async () => {
          const now = await window.api.spotify.nowPlaying()
          await window.api.spotify.control(now?.isPlaying ? 'pause' : 'play')
        },
      },
      {
        id: 'spotify-next',
        label: 'Spotify: skip track',
        keywords: 'music next',
        icon: SkipForward,
        perform: () => {
          window.api.spotify.control('next')
        },
      },
      { id: 'export', label: 'Export your data (backup)', keywords: 'download json backup save', icon: Download, perform: exportBackup },
    ],
    [theme, toggleTheme],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filtered[selected]
        if (cmd) {
          setOpen(false)
          cmd.perform()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, selected])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3.5 py-3" style={{ borderColor: 'var(--border)' }}>
          <Search size={15} style={{ color: 'var(--text-faint)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-[14px]"
          />
          <kbd className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--raised)', color: 'var(--text-faint)' }}>
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon
            return (
              <button
                key={cmd.id}
                onMouseEnter={() => setSelected(i)}
                onClick={() => {
                  setOpen(false)
                  cmd.perform()
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px]"
                style={{ background: i === selected ? 'var(--accent-soft)' : 'transparent', color: i === selected ? 'var(--accent)' : 'var(--text)' }}
              >
                <Icon size={15} />
                {cmd.label}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
              No matching commands.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
