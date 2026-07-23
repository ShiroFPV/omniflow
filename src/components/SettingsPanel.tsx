import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Music2, Cloud, CalendarClock, Palette, LayoutGrid, BellRing, DatabaseBackup, NotebookPen } from 'lucide-react'
import { useTheme, ACCENT_PRESETS, type AccentId } from '../lib/theme'
import { useWidgets, type DashboardWidgets } from '../lib/widgets'
import { notificationsEnabled, notificationsSupported, enableNotifications, disableNotifications } from '../lib/notifications'
import { markdownEnabled, setMarkdownEnabled } from '../lib/notesSettings'
import { exportBackup, pickBackupFile, importBackupFromFile } from '../lib/backup'
import { onOpenSettings } from '../lib/settingsBus'

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)

  useEffect(() => onOpenSettings(() => setOpen(true)), [])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            className="relative flex h-full w-full max-w-[420px] flex-col border-l"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
              <h1 className="text-[16px] font-semibold tracking-tight">Settings</h1>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--raised)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <SpotifySection />
              <CloudSyncSection />
              <Section icon={CalendarClock} title="Calendar sync">
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Manage connected calendars from the Calendar page. Outlook and Apple Calendar both support
                  publishing a calendar as an ICS/webcal link — paste that link there to keep events in sync
                  automatically.
                </p>
              </Section>
              <AppearanceSection />
              <DashboardWidgetsSection />
              <NotesSection />
              <NotificationsSection />
              <BackupSection />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function SpotifySection() {
  const [clientId, setClientId] = useState('')
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    window.api.spotify.status().then((s) => setConnected(s.connected))
  }, [])

  async function connect() {
    if (!clientId.trim()) {
      setStatus('Enter your Spotify Client ID first.')
      return
    }
    setStatus('Opening Spotify login in your browser...')
    try {
      await window.api.spotify.login(clientId.trim())
      setConnected(true)
      setStatus('Connected to Spotify.')
    } catch {
      setStatus('Spotify login failed or was cancelled.')
    }
  }

  async function disconnect() {
    await window.api.spotify.disconnect()
    setConnected(false)
    setStatus('Disconnected.')
  }

  return (
    <Section icon={Music2} title="Spotify">
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Create a free app at <Mono>developer.spotify.com/dashboard</Mono>, add the redirect URI{' '}
        <Mono>{window.api.platform === 'web' ? `${window.location.origin}/` : 'http://127.0.0.1:8888/callback'}</Mono>,
        then paste the Client ID below.
      </p>
      <div className="flex gap-2">
        <TextInput value={clientId} onChange={setClientId} placeholder="Spotify Client ID" />
        {connected ? (
          <SecondaryButton onClick={disconnect}>Disconnect</SecondaryButton>
        ) : (
          <PrimaryButton onClick={connect}>Connect</PrimaryButton>
        )}
      </div>
      {status && <Hint>{status}</Hint>}
      <p className="mt-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        Status: {connected ? <span style={{ color: 'var(--success)' }}>Connected</span> : 'Not connected'}. Playback
        control requires Spotify Premium, and requires the real Spotify app to be open on some device (phone,
        desktop, etc.) since this app remote-controls it rather than playing audio itself.
      </p>
    </Section>
  )
}

function AppearanceSection() {
  const { accent, setAccent } = useTheme()

  return (
    <Section icon={Palette} title="Appearance">
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Pick an accent color. Light/dark theme toggles from the icon in the title bar.
      </p>
      <div className="flex gap-2">
        {(Object.entries(ACCENT_PRESETS) as [AccentId, (typeof ACCENT_PRESETS)[AccentId]][]).map(([id, preset]) => (
          <button
            key={id}
            onClick={() => setAccent(id)}
            title={preset.label}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform active:scale-90"
            style={{ borderColor: accent === id ? preset.dark : 'transparent' }}
          >
            <span className="h-6 w-6 rounded-full" style={{ background: preset.dark }} />
          </button>
        ))}
      </div>
    </Section>
  )
}

function DashboardWidgetsSection() {
  const { widgets, setWidget } = useWidgets()
  const labels: { key: keyof DashboardWidgets; label: string }[] = [
    { key: 'calendar', label: 'Calendar' },
    { key: 'tasks', label: 'To-do' },
    { key: 'timer', label: 'Study timer' },
    { key: 'spotify', label: 'Now playing' },
    { key: 'notes', label: 'Notes desk' },
    { key: 'habits', label: 'Habit tracker' },
  ]

  return (
    <Section icon={LayoutGrid} title="Dashboard widgets">
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Show, hide, and drag to reorder widgets on the dashboard view.
      </p>
      <div className="space-y-1.5">
        {labels.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--raised)' }}>
            <span className="text-[13px]">{label}</span>
            <Switch checked={widgets[key]} onChange={(v) => setWidget(key, v)} />
          </div>
        ))}
      </div>
    </Section>
  )
}

function NotesSection() {
  const [enabled, setEnabled] = useState(markdownEnabled())

  function toggle(next: boolean) {
    setMarkdownEnabled(next)
    setEnabled(next)
  }

  return (
    <Section icon={NotebookPen} title="Notes">
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Render notes as Markdown, with an Edit/Preview toggle on the Notes page.
      </p>
      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--raised)' }}>
        <span className="text-[13px]">Markdown preview</span>
        <Switch checked={enabled} onChange={toggle} />
      </div>
    </Section>
  )
}

function NotificationsSection() {
  const [enabled, setEnabled] = useState(notificationsEnabled())
  const [message, setMessage] = useState<string | null>(null)

  async function toggle(next: boolean) {
    if (next) {
      const granted = await enableNotifications()
      setEnabled(granted)
      setMessage(granted ? null : 'Notification permission was denied - check your OS/browser settings.')
    } else {
      disableNotifications()
      setEnabled(false)
    }
  }

  return (
    <Section icon={BellRing} title="Notifications">
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Get notified when a task's due date arrives, and when a study/break cycle finishes.
      </p>
      {notificationsSupported() ? (
        <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--raised)' }}>
          <span className="text-[13px]">Enable notifications</span>
          <Switch checked={enabled} onChange={toggle} />
        </div>
      ) : (
        <Hint>Notifications aren't supported in this environment.</Hint>
      )}
      {message && <Hint>{message}</Hint>}
    </Section>
  )
}

function BackupSection() {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function doExport() {
    setBusy(true)
    try {
      await exportBackup()
      setMessage('Backup downloaded.')
    } finally {
      setBusy(false)
    }
  }

  async function doImport() {
    const file = await pickBackupFile()
    if (!file) return
    setBusy(true)
    try {
      const { imported } = await importBackupFromFile(file)
      setMessage(`Imported ${imported} item(s).`)
    } catch (err) {
      setMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section icon={DatabaseBackup} title="Backup">
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Export your tasks, notes, and events as a JSON file, or restore from one. Doesn't include Spotify/Cloudflare
        credentials.
      </p>
      <div className="flex gap-2">
        <SecondaryButton onClick={doExport} disabled={busy}>
          Export data
        </SecondaryButton>
        <SecondaryButton onClick={doImport} disabled={busy}>
          Import data
        </SecondaryButton>
      </div>
      {message && <Hint>{message}</Hint>}
    </Section>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 active:scale-95"
      style={{
        background: checked ? 'var(--accent)' : 'var(--border-strong)',
        boxShadow: checked ? 'inset 0 0 0 1px var(--accent-border)' : 'inset 0 1px 2px rgba(0,0,0,0.15)',
      }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ease-out"
        style={{
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2), 0 1px 4px rgba(0,0,0,0.12)',
        }}
      />
    </button>
  )
}

function CloudSyncSection() {
  const isWeb = window.api.platform === 'web'
  const [mode, setMode] = useState<'idle' | 'provision' | 'pair'>(isWeb ? 'pair' : 'idle')
  const [apiToken, setApiToken] = useState('')
  const [pairUrl, setPairUrl] = useState('')
  const [pairSecret, setPairSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [redeployToken, setRedeployToken] = useState('')
  const [showRedeploy, setShowRedeploy] = useState(false)
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; workerUrl: string | null; syncSecret: string | null }>({
    configured: false,
    connected: false,
    workerUrl: null,
    syncSecret: null,
  })

  async function refreshStatus() {
    const s = await window.api.cloudflare.status()
    setStatus(s)
  }

  useEffect(() => {
    refreshStatus()
    const interval = setInterval(refreshStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  async function provision() {
    if (!apiToken.trim()) {
      setMessage('Paste a Cloudflare API token first.')
      return
    }
    setBusy(true)
    setMessage('Provisioning your sync backend on Cloudflare... this can take a few seconds.')
    try {
      await window.api.cloudflare.provision(apiToken.trim())
      setApiToken('')
      setMode('idle')
      setMessage('Backend deployed. Copy the URL and secret below onto your other device to pair it.')
      await refreshStatus()
    } catch (err) {
      setMessage(`Provisioning failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function pair() {
    if (!pairUrl.trim() || !pairSecret.trim()) {
      setMessage('Enter both the Worker URL and the sync secret.')
      return
    }
    setBusy(true)
    setMessage('Connecting...')
    try {
      await window.api.cloudflare.pair(pairUrl.trim(), pairSecret.trim())
      setPairUrl('')
      setPairSecret('')
      setMode('idle')
      setMessage('Paired. This device will now sync with your other devices.')
      await refreshStatus()
    } catch (err) {
      setMessage(`Pairing failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await window.api.cloudflare.disconnect()
      setMessage('Disconnected from cloud sync. Your data stays local on this device.')
      await refreshStatus()
    } finally {
      setBusy(false)
    }
  }

  async function redeploy() {
    if (!redeployToken.trim()) {
      setMessage('Paste the same Cloudflare API token again to redeploy.')
      return
    }
    setBusy(true)
    setMessage('Redeploying the latest Worker code...')
    try {
      await window.api.cloudflare.redeploy(redeployToken.trim())
      setRedeployToken('')
      setShowRedeploy(false)
      setMessage('Redeployed. Your existing pairing/secret is unchanged - other devices stay connected.')
    } catch (err) {
      setMessage(`Redeploy failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section icon={Cloud} title="Cross-device cloud sync">
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Backed by your own Cloudflare account — nothing runs on shared infrastructure. Create a free API token at{' '}
        <Mono>dash.cloudflare.com/profile/api-tokens</Mono> with "Workers Scripts: Edit" and "Account Settings: Read"
        permissions, then set it up below on your first device.
      </p>
      {isWeb && !status.configured && (
        <p className="mb-3 text-[12px] leading-relaxed" style={{ color: '#f0b45f' }}>
          The web version can't create a new backend itself — Cloudflare's API blocks that call from a browser tab.
          Create one using the Windows or Mac app first, then paste its URL and secret below to pair this browser.
        </p>
      )}

      {status.configured ? (
        <div className="space-y-3">
          <p className="text-[13px]">
            Status:{' '}
            {status.connected ? (
              <span style={{ color: 'var(--success)' }}>Connected, syncing live</span>
            ) : (
              <span style={{ color: '#f0b45f' }}>Configured, reconnecting...</span>
            )}
          </p>
          <div className="rounded-xl p-3 text-[12px]" style={{ background: 'var(--raised)' }}>
            <div className="mb-1" style={{ color: 'var(--text-faint)' }}>
              Worker URL (paste on other devices)
            </div>
            <code className="break-all" style={{ color: 'var(--accent)' }}>
              {status.workerUrl}
            </code>
            <div className="mb-1 mt-2" style={{ color: 'var(--text-faint)' }}>
              Sync secret (paste on other devices)
            </div>
            <code className="break-all" style={{ color: 'var(--accent)' }}>
              {status.syncSecret}
            </code>
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={disconnect} disabled={busy}>
              Disconnect this device
            </SecondaryButton>
            {!isWeb && (
              <SecondaryButton onClick={() => setShowRedeploy(!showRedeploy)} disabled={busy}>
                Update Worker code
              </SecondaryButton>
            )}
          </div>
          {showRedeploy && (
            <div className="flex gap-2">
              <TextInput value={redeployToken} onChange={setRedeployToken} placeholder="Cloudflare API token" type="password" />
              <PrimaryButton onClick={redeploy} disabled={busy}>
                Redeploy
              </PrimaryButton>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            {!isWeb && (
              <ToggleButton active={mode === 'provision'} onClick={() => setMode(mode === 'provision' ? 'idle' : 'provision')}>
                First device: create backend
              </ToggleButton>
            )}
            <ToggleButton active={mode === 'pair'} onClick={() => setMode(mode === 'pair' ? 'idle' : 'pair')}>
              {isWeb ? 'Pair with your backend' : 'Other device: pair with existing backend'}
            </ToggleButton>
          </div>

          {mode === 'provision' && !isWeb && (
            <div className="flex gap-2">
              <TextInput value={apiToken} onChange={setApiToken} placeholder="Cloudflare API token" type="password" />
              <PrimaryButton onClick={provision} disabled={busy}>
                Deploy
              </PrimaryButton>
            </div>
          )}

          {mode === 'pair' && (
            <div className="space-y-2">
              <TextInput value={pairUrl} onChange={setPairUrl} placeholder="Worker URL (from your other device)" full />
              <div className="flex gap-2">
                <TextInput value={pairSecret} onChange={setPairSecret} placeholder="Sync secret" type="password" />
                <PrimaryButton onClick={pair} disabled={busy}>
                  Connect
                </PrimaryButton>
              </div>
            </div>
          )}
        </>
      )}

      {message && <Hint>{message}</Hint>}
    </Section>
  )
}

function Section({ icon: Icon, title, children }: { icon: typeof Music2; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>
        <Icon size={14} style={{ color: 'var(--accent)' }} />
        {title}
      </h2>
      {children}
    </section>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded px-1.5 py-0.5 text-[12px]" style={{ background: 'var(--raised)', color: 'var(--accent)' }}>
      {children}
    </code>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
      {children}
    </p>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  full,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
  full?: boolean
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      className={`rounded-lg border px-3 py-2 text-[13px] ${full ? 'w-full' : 'flex-1'}`}
      style={{ background: 'var(--raised)', borderColor: 'var(--border)' }}
    />
  )
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-transform active:scale-[0.97] disabled:opacity-50"
      style={{ background: 'var(--accent)' }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border px-4 py-2 text-[13px] transition-colors hover:bg-[var(--raised)] disabled:opacity-50"
      style={{ borderColor: 'var(--border)' }}
    >
      {children}
    </button>
  )
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
      style={
        active
          ? { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }
          : { border: '1px solid var(--border)', color: 'var(--text-muted)' }
      }
    >
      {children}
    </button>
  )
}
