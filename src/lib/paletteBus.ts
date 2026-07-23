const listeners = new Set<() => void>()

export function openPalette() {
  for (const l of listeners) l()
}

export function onOpenPalette(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}
