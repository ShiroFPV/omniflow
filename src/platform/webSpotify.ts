import { db } from './webStorage'
import type { NowPlaying } from '../types'

const SCOPES = ['user-read-currently-playing', 'user-read-playback-state', 'user-modify-playback-state'].join(' ')

export function spotifyRedirectUri() {
  return `${window.location.origin}/`
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return new Uint8Array(digest)
}

function randomVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return base64url(bytes)
}

export async function startWebSpotifyLogin(clientId: string): Promise<boolean> {
  const verifier = randomVerifier()
  const challenge = base64url(await sha256(verifier))
  db.data.settings.spotifyClientId = clientId
  db.data.settings.spotifyCodeVerifier = verifier
  await db.write()

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })
  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`)
  return true
}

// Called once on app startup - completes the PKCE flow if we just got redirected
// back from Spotify with a ?code= param, then cleans the URL up.
export async function completeWebSpotifyLoginIfRedirected() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (!code) return

  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState({}, '', url.toString())

  const { spotifyClientId, spotifyCodeVerifier } = db.data.settings
  if (!spotifyClientId || !spotifyCodeVerifier) return

  const body = new URLSearchParams({
    client_id: spotifyClientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: spotifyRedirectUri(),
    code_verifier: spotifyCodeVerifier,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return
  const json = await res.json()
  db.data.settings.spotifyAccessToken = json.access_token
  db.data.settings.spotifyRefreshToken = json.refresh_token
  db.data.settings.spotifyTokenExpiresAt = Date.now() + json.expires_in * 1000
  await db.write()
}

async function refreshToken(): Promise<string | null> {
  const { spotifyClientId, spotifyRefreshToken } = db.data.settings
  if (!spotifyClientId || !spotifyRefreshToken) return null
  const body = new URLSearchParams({ client_id: spotifyClientId, grant_type: 'refresh_token', refresh_token: spotifyRefreshToken })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return null
  const json = await res.json()
  db.data.settings.spotifyAccessToken = json.access_token
  if (json.refresh_token) db.data.settings.spotifyRefreshToken = json.refresh_token
  db.data.settings.spotifyTokenExpiresAt = Date.now() + json.expires_in * 1000
  await db.write()
  return json.access_token
}

async function getValidAccessToken(): Promise<string | null> {
  const { spotifyAccessToken, spotifyTokenExpiresAt } = db.data.settings
  if (!spotifyAccessToken) return null
  if (spotifyTokenExpiresAt && Date.now() > spotifyTokenExpiresAt - 30_000) return refreshToken()
  return spotifyAccessToken
}

export async function webSpotifyStatus() {
  return { connected: !!db.data.settings.spotifyRefreshToken }
}

export async function disconnectWebSpotify() {
  db.data.settings.spotifyAccessToken = null
  db.data.settings.spotifyRefreshToken = null
  db.data.settings.spotifyTokenExpiresAt = null
  await db.write()
}

export async function getWebNowPlaying(): Promise<NowPlaying | null> {
  const token = await getValidAccessToken()
  if (!token) return null
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 204 || !res.ok) return null
  const json = await res.json()
  if (!json?.item) return null
  return {
    isPlaying: json.is_playing,
    progressMs: json.progress_ms,
    durationMs: json.item.duration_ms,
    trackName: json.item.name,
    artistName: (json.item.artists ?? []).map((a: { name: string }) => a.name).join(', '),
    albumArt: json.item.album?.images?.[0]?.url ?? null,
  }
}

export async function webSpotifyControl(action: 'play' | 'pause' | 'next' | 'previous') {
  const token = await getValidAccessToken()
  if (!token) return false
  const endpointMap = {
    play: { path: '/v1/me/player/play', method: 'PUT' },
    pause: { path: '/v1/me/player/pause', method: 'PUT' },
    next: { path: '/v1/me/player/next', method: 'POST' },
    previous: { path: '/v1/me/player/previous', method: 'POST' },
  } as const
  const { path, method } = endpointMap[action]
  const res = await fetch(`https://api.spotify.com${path}`, { method, headers: { Authorization: `Bearer ${token}` } })
  return res.ok || res.status === 204
}
