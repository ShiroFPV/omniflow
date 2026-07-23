import { randomBytes, createHash } from 'node:crypto'
import http from 'node:http'
import { shell } from 'electron'
import { getDb } from './db'

export const SPOTIFY_REDIRECT_PORT = 8888
export const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_REDIRECT_PORT}/callback`
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ')

function base64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pkcePair() {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

let pendingVerifier: string | null = null
let callbackServer: http.Server | null = null

export async function startSpotifyLogin(clientId: string): Promise<void> {
  const { verifier, challenge } = pkcePair()
  pendingVerifier = verifier

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })

  await new Promise<void>((resolve, reject) => {
    if (callbackServer) {
      callbackServer.close()
      callbackServer = null
    }
    callbackServer = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.end('Not found')
        return
      }
      const url = new URL(req.url, SPOTIFY_REDIRECT_URI)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res.setHeader('Content-Type', 'text/html')
      if (error || !code) {
        res.end('<h2>Spotify login failed. You can close this tab.</h2>')
        callbackServer?.close()
        callbackServer = null
        reject(new Error(error ?? 'no_code'))
        return
      }
      res.end('<h2>Spotify connected. You can close this tab and return to the app.</h2>')
      callbackServer?.close()
      callbackServer = null
      try {
        await exchangeCode(clientId, code)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
    callbackServer.listen(SPOTIFY_REDIRECT_PORT, '127.0.0.1', () => {
      shell.openExternal(`https://accounts.spotify.com/authorize?${params.toString()}`)
    })
  })
}

async function exchangeCode(clientId: string, code: string) {
  if (!pendingVerifier) throw new Error('missing_verifier')
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_verifier: pendingVerifier,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`token_exchange_failed: ${await res.text()}`)
  const json = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  const db = await getDb()
  db.data.settings.spotifyClientId = clientId
  db.data.settings.spotifyAccessToken = json.access_token
  db.data.settings.spotifyRefreshToken = json.refresh_token
  db.data.settings.spotifyTokenExpiresAt = Date.now() + json.expires_in * 1000
  await db.write()
}

async function refreshToken(): Promise<string | null> {
  const db = await getDb()
  const { spotifyClientId, spotifyRefreshToken } = db.data.settings
  if (!spotifyClientId || !spotifyRefreshToken) return null
  const body = new URLSearchParams({
    client_id: spotifyClientId,
    grant_type: 'refresh_token',
    refresh_token: spotifyRefreshToken,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }
  db.data.settings.spotifyAccessToken = json.access_token
  if (json.refresh_token) db.data.settings.spotifyRefreshToken = json.refresh_token
  db.data.settings.spotifyTokenExpiresAt = Date.now() + json.expires_in * 1000
  await db.write()
  return json.access_token
}

async function getValidAccessToken(): Promise<string | null> {
  const db = await getDb()
  const { spotifyAccessToken, spotifyTokenExpiresAt } = db.data.settings
  if (!spotifyAccessToken) return null
  if (spotifyTokenExpiresAt && Date.now() > spotifyTokenExpiresAt - 30_000) {
    return refreshToken()
  }
  return spotifyAccessToken
}

export async function getSpotifyStatus() {
  const db = await getDb()
  return { connected: !!db.data.settings.spotifyRefreshToken }
}

export async function disconnectSpotify() {
  const db = await getDb()
  db.data.settings.spotifyAccessToken = null
  db.data.settings.spotifyRefreshToken = null
  db.data.settings.spotifyTokenExpiresAt = null
  await db.write()
}

export async function getNowPlaying() {
  const token = await getValidAccessToken()
  if (!token) return null
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204 || !res.ok) return null
  const json = (await res.json()) as {
    is_playing: boolean
    progress_ms: number
    item: {
      name: string
      duration_ms: number
      artists?: { name: string }[]
      album?: { images?: { url: string }[] }
    } | null
  }
  if (!json?.item) return null
  return {
    isPlaying: json.is_playing as boolean,
    progressMs: json.progress_ms as number,
    durationMs: json.item.duration_ms as number,
    trackName: json.item.name as string,
    artistName: (json.item.artists ?? []).map((a: { name: string }) => a.name).join(', '),
    albumArt: json.item.album?.images?.[0]?.url ?? null,
  }
}

export async function controlPlayback(action: 'play' | 'pause' | 'next' | 'previous') {
  const token = await getValidAccessToken()
  if (!token) return false
  const endpointMap = {
    play: { path: '/v1/me/player/play', method: 'PUT' },
    pause: { path: '/v1/me/player/pause', method: 'PUT' },
    next: { path: '/v1/me/player/next', method: 'POST' },
    previous: { path: '/v1/me/player/previous', method: 'POST' },
  } as const
  const { path, method } = endpointMap[action]
  const res = await fetch(`https://api.spotify.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.ok || res.status === 204
}
