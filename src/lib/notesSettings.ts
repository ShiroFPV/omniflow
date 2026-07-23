const KEY = 'omniflow-notes-markdown'

export function markdownEnabled() {
  return localStorage.getItem(KEY) === 'on'
}

export function setMarkdownEnabled(enabled: boolean) {
  localStorage.setItem(KEY, enabled ? 'on' : 'off')
}
