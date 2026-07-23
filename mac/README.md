# OmniFlow — macOS build

This folder is just the macOS launcher/installer story. The actual app code lives
in the repo root (`src/`, `electron/`, `cloudflare-worker/`) and is shared with the
Windows and Web builds — there's only one codebase.

## Build the installer

**Requires an actual Mac** — `.dmg` creation uses `hdiutil`/`codesign`, which only
exist on macOS. If you're on Windows, either:

- Push to GitHub and let `.github/workflows/build.yml` build it on a
  `macos-latest` runner (triggered by pushing a `v*` tag, or manually via the
  Actions tab → "Run workflow"), or
- Build it directly on a Mac using the steps below.

From the repo root, on a Mac:

```bash
npm install
npm run dist -- --mac
```

Or run the helper, which does the same thing and copies the result here:

```bash
bash mac/build.sh
```

Output: `OmniFlow-<version>.dmg` lands in `mac/dist/`.

## Or just grab a prebuilt one

Pushing a `v*` tag builds both installers on GitHub's runners and attaches them
(plus this script and its Windows equivalent) to that tag's page under
**Releases**.

## What happens when someone installs it

Opening the `.dmg` shows the standard drag-to-Applications window. Once dragged in,
OmniFlow shows up in Spotlight (⌘+Space, type "omniflow") and Launchpad like any
other installed app — no extra registration needed, that's just how a `.app`
bundle in `/Applications` works.

The build is currently **unsigned** (no Apple Developer certificate yet), so
Gatekeeper will likely say the app "is damaged and can't be opened" on first
launch. Fix with:

```bash
xattr -cr /Applications/OmniFlow.app
```

This clears the quarantine flag macOS puts on anything downloaded without a
recognized developer signature — it's not actually damaged.
