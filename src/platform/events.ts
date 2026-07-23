const listeners = new Set<() => void>()

export function notifyChanged() {
  for (const l of listeners) l()
}

export function onChanged(callback: () => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}
