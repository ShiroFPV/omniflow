import { useEffect, useRef, useState } from 'react'
import { SkipBack, SkipForward, Play, Pause, Music2 } from 'lucide-react'
import type { NowPlaying } from '../types'

const POLL_MS = 1500

export default function SpotifyWidget() {
  const [connected, setConnected] = useState(false)
  const [track, setTrack] = useState<NowPlaying | null>(null)
  const [localProgressMs, setLocalProgressMs] = useState(0)
  const pollRef = useRef<() => void>(() => {})

  useEffect(() => {
    window.api.spotify.status().then((s) => setConnected(s.connected))
  }, [])

  useEffect(() => {
    if (!connected) return
    let cancelled = false
    async function poll() {
      const now = await window.api.spotify.nowPlaying()
      if (cancelled) return
      setTrack(now)
      setLocalProgressMs(now?.progressMs ?? 0)
    }
    pollRef.current = poll
    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [connected])

  // Ticks the progress bar every second locally so it feels live between polls,
  // instead of only moving once every POLL_MS when a fresh value comes back.
  useEffect(() => {
    if (!track?.isPlaying) return
    const tick = setInterval(() => {
      setLocalProgressMs((p) => Math.min(p + 1000, track.durationMs))
    }, 1000)
    return () => clearInterval(tick)
  }, [track?.isPlaying, track?.durationMs])

  function pollSoon() {
    setTimeout(() => pollRef.current(), 350)
  }

  function togglePlay() {
    if (!track) return
    setTrack({ ...track, isPlaying: !track.isPlaying })
    window.api.spotify.control(track.isPlaying ? 'pause' : 'play')
    pollSoon()
  }

  function skip(direction: 'next' | 'previous') {
    window.api.spotify.control(direction)
    pollSoon()
  }

  if (!connected) {
    return (
      <div className="flex items-center gap-2 rounded-xl border p-3 text-[12px]" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
        <Music2 size={14} />
        Connect Spotify in Settings
      </div>
    )
  }

  if (!track) {
    return (
      <div className="flex items-center gap-2 rounded-xl border p-3 text-[12px]" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
        <Music2 size={14} />
        Nothing playing
      </div>
    )
  }

  const progressPct = track.durationMs ? Math.min(100, (localProgressMs / track.durationMs) * 100) : 0

  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: 'var(--border)', background: 'var(--raised)' }}>
      <div className="flex items-center gap-2.5">
        {track.albumArt ? (
          <img src={track.albumArt} alt="" className="h-9 w-9 rounded-md" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-md" style={{ background: 'var(--surface)' }}>
            <Music2 size={14} style={{ color: 'var(--text-faint)' }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium">{track.trackName}</div>
          <div className="truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
            {track.artistName}
          </div>
        </div>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: 'var(--surface)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${progressPct}%`, background: 'var(--accent)', transition: 'width 0.9s linear' }}
        />
      </div>

      <div className="mt-2 flex items-center justify-center gap-4">
        <button onClick={() => skip('previous')} style={{ color: 'var(--text-muted)' }}>
          <SkipBack size={14} fill="currentColor" />
        </button>
        <button onClick={togglePlay} style={{ color: 'var(--accent)' }}>
          {track.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <button onClick={() => skip('next')} style={{ color: 'var(--text-muted)' }}>
          <SkipForward size={14} fill="currentColor" />
        </button>
      </div>
    </div>
  )
}
