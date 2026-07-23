import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  todos: {
    list: () => ipcRenderer.invoke('todos:list'),
    add: (title: string, dueDate: string | null) => ipcRenderer.invoke('todos:add', title, dueDate),
    toggle: (id: string) => ipcRenderer.invoke('todos:toggle', id),
    delete: (id: string) => ipcRenderer.invoke('todos:delete', id),
  },
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    add: () => ipcRenderer.invoke('notes:add'),
    update: (id: string, title: string, content: string) => ipcRenderer.invoke('notes:update', id, title, content),
    delete: (id: string) => ipcRenderer.invoke('notes:delete', id),
  },
  events: {
    list: () => ipcRenderer.invoke('events:list'),
    add: (partial: unknown) => ipcRenderer.invoke('events:add', partial),
    delete: (id: string) => ipcRenderer.invoke('events:delete', id),
    importIcsFile: () => ipcRenderer.invoke('events:importIcsFile'),
    subscriptions: {
      list: () => ipcRenderer.invoke('events:subscriptions:list'),
      add: (name: string, url: string) => ipcRenderer.invoke('events:subscriptions:add', name, url),
      remove: (id: string) => ipcRenderer.invoke('events:subscriptions:remove', id),
      sync: (id: string) => ipcRenderer.invoke('events:subscriptions:sync', id),
    },
  },
  spotify: {
    login: (clientId: string) => ipcRenderer.invoke('spotify:login', clientId),
    status: () => ipcRenderer.invoke('spotify:status'),
    disconnect: () => ipcRenderer.invoke('spotify:disconnect'),
    nowPlaying: () => ipcRenderer.invoke('spotify:nowPlaying'),
    control: (action: 'play' | 'pause' | 'next' | 'previous') => ipcRenderer.invoke('spotify:control', action),
  },
  cloudflare: {
    provision: (apiToken: string) => ipcRenderer.invoke('cloudflare:provision', apiToken),
    redeploy: (apiToken: string) => ipcRenderer.invoke('cloudflare:redeploy', apiToken),
    pair: (workerUrl: string, syncSecret: string) => ipcRenderer.invoke('cloudflare:pair', workerUrl, syncSecret),
    disconnect: () => ipcRenderer.invoke('cloudflare:disconnect'),
    status: () => ipcRenderer.invoke('cloudflare:status'),
  },
  data: {
    exportAll: () => ipcRenderer.invoke('data:exportAll'),
    importAll: (snapshot: unknown) => ipcRenderer.invoke('data:importAll', snapshot),
  },
  timer: {
    getSettings: () => ipcRenderer.invoke('timer:getSettings'),
    saveSettings: (settings: unknown) => ipcRenderer.invoke('timer:saveSettings', settings),
    logSession: (minutes: number) => ipcRenderer.invoke('timer:logSession', minutes),
    getHistory: () => ipcRenderer.invoke('timer:getHistory'),
  },
  habits: {
    list: () => ipcRenderer.invoke('habits:list'),
    add: (name: string) => ipcRenderer.invoke('habits:add', name),
    toggleToday: (id: string) => ipcRenderer.invoke('habits:toggleToday', id),
    delete: (id: string) => ipcRenderer.invoke('habits:delete', id),
  },
  onSyncChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('sync:changed', listener)
    return () => ipcRenderer.removeListener('sync:changed', listener)
  },
  platform: process.platform,
})
