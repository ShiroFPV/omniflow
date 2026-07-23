function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

export function hexToRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Mixes `hex` toward white (amount > 0) or black (amount < 0), like a quick tint/shade.
export function shade(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex)
  const target = amount > 0 ? 255 : 0
  const t = Math.abs(amount)
  const mix = (c: number) => Math.round(c + (target - c) * t)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
