# OmniFlow — Windows build

This folder is just the Windows launcher/installer story. The actual app code lives
in the repo root (`src/`, `electron/`, `cloudflare-worker/`) and is shared with the
macOS and Web builds — there's only one codebase.

## Build the installer

From the repo root:

```powershell
npm install
npm run dist -- --win
```

This runs `windows\build.ps1` under the hood conceptually — or just run that script
directly, which does the same thing and copies the result here:

```powershell
windows\build.ps1
```

Output: an NSIS installer (`OmniFlow Setup <version>.exe`) lands in `windows\dist\`.

## Or just grab a prebuilt one

Pushing a `v*` tag (e.g. `v1.0.0`) triggers `.github/workflows/build.yml`, which
builds both the Windows and macOS installers on GitHub's own runners and attaches
them to that tag's page under **Releases** — along with this build script and its
macOS equivalent, if you'd rather build from source yourself instead of trusting
a binary someone else built.

## What happens when someone installs it

The installer registers a real Start Menu entry and a Desktop shortcut (both are
on by default in NSIS). After installing, pressing the Windows key and typing
"omniflow" finds it exactly like any other installed application — this isn't
something extra to configure, it's what a normal NSIS installer does.

The installer is currently **unsigned** (no code-signing certificate yet), so
Windows SmartScreen will show an "unrecognized app" warning on first run. Click
**More info → Run anyway**. This is a one-time browser-download-reputation thing,
not a sign anything is wrong.
