import DashboardPage from './pages/DashboardPage'
import TitleBar from './components/TitleBar'
import CommandPalette from './components/CommandPalette'
import SettingsPanel from './components/SettingsPanel'
import { ThemeProvider } from './lib/theme'
import { WidgetsProvider } from './lib/widgets'
import { useNotifications } from './hooks/useNotifications'

export default function App() {
  return (
    <ThemeProvider>
      <WidgetsProvider>
        <AppShell />
      </WidgetsProvider>
    </ThemeProvider>
  )
}

function AppShell() {
  useNotifications()

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <TitleBar />
      <CommandPalette />
      <SettingsPanel />
      <DashboardPage />
    </div>
  )
}
