import { Waves, Sun, Moon, Search, Settings } from 'lucide-react'
import { useTheme } from '../lib/theme'
import { openPalette } from '../lib/paletteBus'
import { openSettings } from '../lib/settingsBus'

export default function TitleBar() {
  const isMac = window.api.platform === 'darwin'
  const { theme, toggleTheme } = useTheme()

  return (
    <div
      className="drag-region flex h-10 shrink-0 items-center gap-3 border-b"
      style={{ paddingLeft: isMac ? 78 : 14, borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="no-select flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
        <Waves size={14} style={{ color: 'var(--accent)' }} strokeWidth={2.25} />
        OmniFlow
      </div>
      {/* Everything lives on the left, next to the wordmark - the right edge of the
          window is Windows' native minimize/maximize/close territory (via titleBarOverlay)
          and must stay clear, or these buttons render underneath them. */}
      <div className="no-drag flex items-center gap-1">
        <IconButton onClick={openPalette} title="Command palette (Ctrl/Cmd+K)">
          <Search size={14} />
        </IconButton>
        <IconButton onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </IconButton>
        <IconButton onClick={openSettings} title="Settings">
          <Settings size={14} />
        </IconButton>
      </div>
    </div>
  )
}

function IconButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--raised)]"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </button>
  )
}
