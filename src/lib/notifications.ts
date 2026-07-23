const KEY = 'omniflow-notifications'

export function notificationsEnabled() {
  return localStorage.getItem(KEY) === 'on'
}

export function notificationsSupported() {
  return typeof Notification !== 'undefined'
}

export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    localStorage.setItem(KEY, 'on')
    return true
  }
  return false
}

export function disableNotifications() {
  localStorage.setItem(KEY, 'off')
}

export function notify(title: string, body: string) {
  if (!notificationsEnabled() || !notificationsSupported() || Notification.permission !== 'granted') return
  new Notification(title, { body })
}
