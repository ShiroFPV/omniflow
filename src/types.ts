export interface Todo {
  id: string
  title: string
  done: boolean
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  location: string | null
  source: 'local' | 'ics'
  sourceName: string | null
  updatedAt: string
}

export interface IcsSubscription {
  id: string
  name: string
  url: string
  lastSynced: string | null
}

export interface NowPlaying {
  isPlaying: boolean
  progressMs: number
  durationMs: number
  trackName: string
  artistName: string
  albumArt: string | null
}

export interface TimerSettings {
  studyMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  cycles: number
}

export interface StudyDay {
  date: string
  minutes: number
}

export interface BackupSnapshot {
  version: 1
  exportedAt: string
  todos: Todo[]
  notes: Note[]
  events: CalendarEvent[]
  icsSubscriptions: IcsSubscription[]
}

export interface Habit {
  id: string
  name: string
  createdAt: string
  completedDates: string[]
}

export interface Api {
  todos: {
    list(): Promise<Todo[]>
    add(title: string, dueDate: string | null): Promise<Todo>
    toggle(id: string): Promise<Todo | undefined>
    delete(id: string): Promise<void>
  }
  notes: {
    list(): Promise<Note[]>
    add(): Promise<Note>
    update(id: string, title: string, content: string): Promise<Note | undefined>
    delete(id: string): Promise<void>
  }
  events: {
    list(): Promise<CalendarEvent[]>
    add(partial: Partial<CalendarEvent>): Promise<CalendarEvent>
    delete(id: string): Promise<void>
    importIcsFile(): Promise<number>
    subscriptions: {
      list(): Promise<IcsSubscription[]>
      add(name: string, url: string): Promise<IcsSubscription>
      remove(id: string): Promise<void>
      sync(id: string): Promise<number>
    }
  }
  spotify: {
    login(clientId: string): Promise<boolean>
    status(): Promise<{ connected: boolean }>
    disconnect(): Promise<void>
    nowPlaying(): Promise<NowPlaying | null>
    control(action: 'play' | 'pause' | 'next' | 'previous'): Promise<boolean>
  }
  cloudflare: {
    provision(apiToken: string): Promise<{ workerUrl: string; syncSecret: string }>
    redeploy(apiToken: string): Promise<void>
    pair(workerUrl: string, syncSecret: string): Promise<void>
    disconnect(): Promise<void>
    status(): Promise<{ configured: boolean; connected: boolean; workerUrl: string | null; syncSecret: string | null }>
  }
  timer: {
    getSettings(): Promise<TimerSettings>
    saveSettings(settings: TimerSettings): Promise<void>
    logSession(minutes: number): Promise<void>
    getHistory(): Promise<StudyDay[]>
  }
  data: {
    exportAll(): Promise<BackupSnapshot>
    importAll(snapshot: BackupSnapshot): Promise<{ imported: number }>
  }
  habits: {
    list(): Promise<Habit[]>
    add(name: string): Promise<Habit>
    toggleToday(id: string): Promise<Habit | undefined>
    delete(id: string): Promise<void>
  }
  onSyncChanged(callback: () => void): () => void
  platform: 'darwin' | 'win32' | 'linux' | 'web'
}

declare global {
  interface Window {
    api: Api
  }
}
