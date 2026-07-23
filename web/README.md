# OmniFlow — Web build

This folder is just the web deployment story. The actual app code lives in the
repo root (`src/`) and is shared with the Windows and macOS builds — there's
only one codebase. The only web-specific files are `index.web.html`,
`vite.web.config.ts`, and `src/main.web.tsx` + `src/platform/*` (the
browser-native replacement for Electron's IPC bridge).

## Run it locally

From the repo root:

```bash
npm install
npm run dev:web
```

Opens `http://localhost:5174/index.web.html`.

## Build for deployment

```bash
npm run build:web
```

Output: a static site in `dist-web/`. Deploy it anywhere that serves static
files (Cloudflare Pages, Netlify, GitHub Pages, a plain nginx box, whatever) —
it's just HTML/CSS/JS, no server-side code required.

## What's different from the desktop app

The web version is the same UI running on a different foundation: Electron's
Node.js process (with no CORS restrictions) is replaced by pure browser code
subject to real CORS rules. That forces three real differences, not just
missing polish:

1. **Cross-device sync setup.** Cloudflare's management API blocks direct
   browser calls (no CORS headers on their side, confirmed by testing it
   live) — so the web version **cannot create a new sync backend from
   scratch**. Use the Windows or Mac app to create one first (Settings →
   "First device: create backend"), then paste the resulting Worker URL and
   secret into the web version's Settings → "Pair with your backend."
   After that, sync works identically to the desktop apps — same
   WebSocket connection, same live updates.

2. **Calendar ICS subscriptions.** Outlook/iCloud/Google calendar feeds don't
   send CORS headers either (also confirmed live), so the browser can't fetch
   them directly. If cloud sync is paired, the web version routes ICS fetches
   through your own Worker instead (which has no CORS restrictions, since
   it's not a browser) via a `/proxy-ics` endpoint. Without cloud sync paired,
   calendar subscriptions won't work in the web version — importing a local
   `.ics` file still does, via a normal file picker.

3. **Spotify.** Works exactly the same as desktop — Spotify's own API is
   fully CORS-enabled for browser apps (this is their officially supported
   PKCE flow), so no proxy is needed here. You do need to register your
   browser's exact URL (e.g. `http://localhost:5174/`, or wherever you deploy
   it) as a redirect URI in your Spotify app dashboard — the Settings page
   shows you the exact value to use.

Local data (todos, notes, events, settings) is stored in the browser's
`localStorage`, scoped to whatever origin you're running/deploying this on —
clearing site data or switching domains starts fresh, same as any web app.
