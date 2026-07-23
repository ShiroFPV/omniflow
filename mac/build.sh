#!/usr/bin/env bash
# Builds the macOS installer and copies it into mac/dist for easy access.
# Run from anywhere; this script locates the repo root itself. macOS only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm run dist -- --mac
mkdir -p mac/dist
cp release/*.dmg mac/dist/ 2>/dev/null || true
cp release/*.blockmap mac/dist/ 2>/dev/null || true
echo "Installer copied to mac/dist/"
