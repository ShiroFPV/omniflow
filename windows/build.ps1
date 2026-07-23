# Builds the Windows installer and copies it into windows\dist for easy access.
# Run from anywhere; this script locates the repo root itself.

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $root
try {
    npm run dist -- --win
    New-Item -ItemType Directory -Force -Path "windows\dist" | Out-Null
    Copy-Item "release\*.exe" "windows\dist\" -Force
    Copy-Item "release\*.blockmap" "windows\dist\" -Force -ErrorAction SilentlyContinue
    Write-Output "Installer copied to windows\dist\"
} finally {
    Pop-Location
}
