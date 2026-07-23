import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDb, newId, type Todo, type Note, type CalendarEvent } from './db'
import {
  startSpotifyLogin,
  getSpotifyStatus,
  disconnectSpotify,
  getNowPlaying,
  controlPlayback,
} from './spotify'
import {
  importIcsFromText,
  addIcsSubscription,
  removeIcsSubscription,
  listIcsSubscriptions,
  syncIcsSubscription,
  syncAllIcsSubscriptions,
} from './calendar'
import {
  provisionCloudflareSync,
  redeployCloudflareSync,
  pairExistingWorker,
  disconnectCloudflareSync,
  getCloudflareSyncConfig,
} from './cloudflare'
import { startSyncEngine, restartSyncEngine, stopSyncEngine, isSyncConnected, pushChange, notifyRenderer } from './sync'
import { getTimerSettings, saveTimerSettings, logStudyMinutes, getStudyHistory } from './timer'
import { exportAllData, importAllData, type BackupSnapshot } from './backup'
import { listHabits, addHabit, toggleHabitToday, deleteHabit } from './habits'
import type { TimerSettings } from './db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0b10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay:
      process.platform === 'darwin'
        ? undefined
        : { color: '#0d0d12', symbolColor: '#a1a1aa', height: 40 },
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 14 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('preload-error', (_e, preloadPath, error) => {
    console.error('Preload script failed to load:', preloadPath, error)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  await getDb()
  registerIpcHandlers()
  createWindow()
  syncAllIcsSubscriptions()
  startSyncEngine()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopSyncEngine()
})

function registerIpcHandlers() {
  // Todos
  ipcMain.handle('todos:list', async () => (await getDb()).data.todos)
  ipcMain.handle('todos:add', async (_e, title: string, dueDate: string | null) => {
    const db = await getDb()
    const now = new Date().toISOString()
    const todo: Todo = { id: newId(), title, done: false, dueDate, createdAt: now, updatedAt: now }
    db.data.todos.unshift(todo)
    await db.write()
    pushChange('todo', 'upsert', todo)
    notifyRenderer()
    return todo
  })
  ipcMain.handle('todos:toggle', async (_e, id: string) => {
    const db = await getDb()
    const todo = db.data.todos.find((t: Todo) => t.id === id)
    if (todo) {
      todo.done = !todo.done
      todo.updatedAt = new Date().toISOString()
    }
    await db.write()
    if (todo) pushChange('todo', 'upsert', todo)
    notifyRenderer()
    return todo
  })
  ipcMain.handle('todos:delete', async (_e, id: string) => {
    const db = await getDb()
    db.data.todos = db.data.todos.filter((t: Todo) => t.id !== id)
    await db.write()
    pushChange('todo', 'delete', { id, updatedAt: new Date().toISOString() })
    notifyRenderer()
  })

  // Notes
  ipcMain.handle('notes:list', async () => (await getDb()).data.notes)
  ipcMain.handle('notes:add', async () => {
    const db = await getDb()
    const note: Note = { id: newId(), title: 'Untitled note', content: '', updatedAt: new Date().toISOString() }
    db.data.notes.unshift(note)
    await db.write()
    pushChange('note', 'upsert', note)
    notifyRenderer()
    return note
  })
  ipcMain.handle('notes:update', async (_e, id: string, title: string, content: string) => {
    const db = await getDb()
    const note = db.data.notes.find((n: Note) => n.id === id)
    if (note) {
      note.title = title
      note.content = content
      note.updatedAt = new Date().toISOString()
    }
    await db.write()
    if (note) pushChange('note', 'upsert', note)
    notifyRenderer()
    return note
  })
  ipcMain.handle('notes:delete', async (_e, id: string) => {
    const db = await getDb()
    db.data.notes = db.data.notes.filter((n: Note) => n.id !== id)
    await db.write()
    pushChange('note', 'delete', { id, updatedAt: new Date().toISOString() })
    notifyRenderer()
  })

  // Calendar
  ipcMain.handle('events:list', async () => (await getDb()).data.events)
  ipcMain.handle('events:add', async (_e, partial: Partial<CalendarEvent>) => {
    const db = await getDb()
    const event: CalendarEvent = {
      id: newId(),
      title: partial.title ?? '(untitled)',
      start: partial.start ?? new Date().toISOString(),
      end: partial.end ?? null,
      allDay: partial.allDay ?? false,
      location: partial.location ?? null,
      source: 'local',
      sourceName: null,
      updatedAt: new Date().toISOString(),
    }
    db.data.events.push(event)
    await db.write()
    pushChange('event', 'upsert', event)
    notifyRenderer()
    return event
  })
  ipcMain.handle('events:delete', async (_e, id: string) => {
    const db = await getDb()
    db.data.events = db.data.events.filter((e: CalendarEvent) => e.id !== id)
    await db.write()
    pushChange('event', 'delete', { id, updatedAt: new Date().toISOString() })
    notifyRenderer()
  })
  ipcMain.handle('events:importIcsFile', async () => {
    if (!win) return 0
    const result = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Calendar files', extensions: ['ics'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return 0
    const fs = await import('node:fs/promises')
    const text = await fs.readFile(result.filePaths[0], 'utf-8')
    const name = path.basename(result.filePaths[0])
    const count = await importIcsFromText(text, name)
    notifyRenderer()
    return count
  })
  ipcMain.handle('events:subscriptions:list', async () => listIcsSubscriptions())
  ipcMain.handle('events:subscriptions:add', async (_e, name: string, url: string) => {
    const sub = await addIcsSubscription(name, url)
    notifyRenderer()
    return sub
  })
  ipcMain.handle('events:subscriptions:remove', async (_e, id: string) => {
    await removeIcsSubscription(id)
    notifyRenderer()
  })
  ipcMain.handle('events:subscriptions:sync', async (_e, id: string) => {
    const count = await syncIcsSubscription(id)
    notifyRenderer()
    return count
  })

  // Spotify
  ipcMain.handle('spotify:login', async (_e, clientId: string) => {
    await startSpotifyLogin(clientId)
    return true
  })
  ipcMain.handle('spotify:status', async () => getSpotifyStatus())
  ipcMain.handle('spotify:disconnect', async () => disconnectSpotify())
  ipcMain.handle('spotify:nowPlaying', async () => getNowPlaying())
  ipcMain.handle('spotify:control', async (_e, action: 'play' | 'pause' | 'next' | 'previous') =>
    controlPlayback(action),
  )

  // Cloudflare cloud sync
  ipcMain.handle('cloudflare:provision', async (_e, apiToken: string) => {
    const result = await provisionCloudflareSync(apiToken)
    await restartSyncEngine()
    return result
  })
  ipcMain.handle('cloudflare:redeploy', async (_e, apiToken: string) => {
    await redeployCloudflareSync(apiToken)
    await restartSyncEngine()
  })
  ipcMain.handle('cloudflare:pair', async (_e, workerUrl: string, syncSecret: string) => {
    await pairExistingWorker(workerUrl, syncSecret)
    await restartSyncEngine()
  })
  ipcMain.handle('cloudflare:disconnect', async () => {
    stopSyncEngine()
    await disconnectCloudflareSync()
  })
  ipcMain.handle('cloudflare:status', async () => {
    const config = await getCloudflareSyncConfig()
    return { configured: !!config.workerUrl, connected: isSyncConnected(), workerUrl: config.workerUrl, syncSecret: config.syncSecret }
  })

  // Study timer
  ipcMain.handle('timer:getSettings', async () => getTimerSettings())
  ipcMain.handle('timer:saveSettings', async (_e, settings: TimerSettings) => saveTimerSettings(settings))
  ipcMain.handle('timer:logSession', async (_e, minutes: number) => logStudyMinutes(minutes))
  ipcMain.handle('timer:getHistory', async () => getStudyHistory())

  // Backup
  ipcMain.handle('data:exportAll', async () => exportAllData())
  ipcMain.handle('data:importAll', async (_e, snapshot: BackupSnapshot) => importAllData(snapshot))

  // Habit tracker
  ipcMain.handle('habits:list', async () => listHabits())
  ipcMain.handle('habits:add', async (_e, name: string) => {
    const habit = await addHabit(name)
    notifyRenderer()
    return habit
  })
  ipcMain.handle('habits:toggleToday', async (_e, id: string) => {
    const habit = await toggleHabitToday(id)
    notifyRenderer()
    return habit
  })
  ipcMain.handle('habits:delete', async (_e, id: string) => {
    await deleteHabit(id)
    notifyRenderer()
  })
}
