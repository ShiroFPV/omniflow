const listeners = new Set<() => void>()

export function openSettings() {
  for (const l of listeners) l()
}

export function onOpenSettings(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}
