import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { hexToRgba, shade } from './color'

export type Theme = 'light' | 'dark'

export const ACCENT_PRESETS = {
  violet: { label: 'Violet', dark: '#8b6bf2', light: '#7c5cf0' },
  blue: { label: 'Blue', dark: '#4f8ef0', light: '#3f74e0' },
  rose: { label: 'Rose', dark: '#f26b9f', light: '#e0508a' },
  lime: { label: 'Lime', dark: '#4ade80', light: '#22a35e' },
  amber: { label: 'Amber', dark: '#f0955f', light: '#e07f3f' },
} as const

export type AccentId = keyof typeof ACCENT_PRESETS

const THEME_KEY = 'omniflow-theme'
const ACCENT_KEY = 'omniflow-accent'

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

function getStoredAccent(): AccentId {
  const stored = localStorage.getItem(ACCENT_KEY)
  return stored && stored in ACCENT_PRESETS ? (stored as AccentId) : 'violet'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function applyAccent(accentId: AccentId, theme: Theme) {
  const base = ACCENT_PRESETS[accentId][theme]
  const root = document.documentElement.style
  root.setProperty('--accent', base)
  root.setProperty('--accent-hover', shade(base, theme === 'dark' ? 0.12 : -0.12))
  root.setProperty('--accent-soft', hexToRgba(base, theme === 'dark' ? 0.16 : 0.1))
  root.setProperty('--accent-border', hexToRgba(base, theme === 'dark' ? 0.4 : 0.32))
}

// Applied once at module load, before React mounts, so there's no flash of the wrong theme/accent.
const initialTheme = getStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light')
applyTheme(initialTheme)
applyAccent(getStoredAccent(), initialTheme)

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  accent: AccentId
  setAccent: (a: AccentId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [accent, setAccentState] = useState<AccentId>(getStoredAccent())

  useEffect(() => {
    applyTheme(theme)
    applyAccent(accent, theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme, accent])

  function setTheme(t: Theme) {
    setThemeState(t)
  }

  function toggleTheme() {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  function setAccent(a: AccentId) {
    setAccentState(a)
    localStorage.setItem(ACCENT_KEY, a)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, accent, setAccent }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
