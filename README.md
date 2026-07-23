# OmniFlow

A desktop productivity app: tasks, notes, a calendar that pulls from Outlook/Apple
Calendar via ICS subscriptions, a Pomodoro-style study timer, and Spotify remote
control, all in one window. Optional cross-device sync backed by your own
Cloudflare account — there's no shared server, each install talks to a Worker
you deploy into your own account.

Two views: a widget dashboard (drag to reorder, toggle any of them off) or a
classic sidebar + pages layout. Switch anytime from the title bar.

## Running it

```
npm install
npm run dev        # desktop app (Electron)
npm run dev:web    # same app, plain browser build
```

## Building installers

```
npm run dist            # current platform
windows\build.ps1       # Windows, copies the .exe into windows\dist
bash mac/build.sh       # macOS only, copies the .dmg into mac\dist
```

See [windows/README.md](windows/README.md), [mac/README.md](mac/README.md), and
[web/README.md](web/README.md) for platform-specific notes (unsigned-build
warnings, what the web build can and can't do, etc).

## How it's put together

- `src/` — the React UI. Shared verbatim between the Electron build and the
  standalone web build.
- `electron/` — the Electron main process: local storage (a JSON file via
  lowdb), Spotify OAuth, Cloudflare provisioning, the WebSocket sync client.
- `src/platform/` — the browser-native equivalent of `electron/`, used only by
  the web build (see `src/main.web.tsx`). Same `window.api` shape either way,
  so the UI code never needs to know which one it's talking to.
- `cloudflare-worker/worker.js` — the sync backend. Bundled into the app and
  uploaded to a user's own Cloudflare account via their API token; not
  something you deploy once centrally.

## Cloud sync, briefly

Settings → Cross-device cloud sync → paste a Cloudflare API token on your
first device. The app creates a Durable Object (SQLite-backed, no separate
database needed) under your account and gives you a Worker URL + secret to
pair your other devices with. The web build can only pair with a backend that
already exists — Cloudflare's management API doesn't allow creating one from
a browser tab, so that step needs the desktop app once.
