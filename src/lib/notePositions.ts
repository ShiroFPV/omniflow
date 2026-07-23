const STORAGE_KEY = 'omniflow-note-positions'

export interface NotePosition {
  x: number
  y: number
}

export function getStoredPositions(): Record<string, NotePosition> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function savePositions(positions: Record<string, NotePosition>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
}
