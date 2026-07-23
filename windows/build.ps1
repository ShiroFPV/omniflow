# Builds the Windows installer and copies it into windows\dist for easy access.
# Run from anywhere; this script locates the repo root itself.
#
# This script keeps its window open and prints a clear message if anything is
# missing (e.g. Node.js not installed) instead of flashing closed.

$ErrorActionPreference = 'Stop'

function Close-Window {
    param([int]$Code = 0)
    Write-Host ""
    # Only pause when there is an interactive console (i.e. a real window),
    # so this doesn't hang automated/CI runs.
    if ([Environment]::UserInteractive -and $Host.Name -eq 'ConsoleHost') {
        try { Read-Host "Press Enter to close this window" | Out-Null } catch {}
    }
    exit $Code
}

function Fail {
    param([string]$Message)
    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    Close-Window 1
}

try {
    # --- Preflight: is Node.js / npm available? ---
    $node = Get-Command node -ErrorAction SilentlyContinue
    $npm  = Get-Command npm  -ErrorAction SilentlyContinue

    if (-not $node -or -not $npm) {
        Write-Host "Node.js (which provides 'npm') was not found on this PC." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Install it, then run this script again:" -ForegroundColor Yellow
        Write-Host "  1. Download the Windows LTS installer from https://nodejs.org"
        Write-Host "     (or run:  winget install OpenJS.NodeJS.LTS )"
        Write-Host "  2. Close and reopen PowerShell so PATH refreshes."
        Write-Host "  3. Verify with:  node -v   and   npm -v"
        Fail "Node.js / npm is not installed or not on PATH."
    }

    Write-Host ("Using Node {0} / npm {1}" -f (node -v), (npm -v)) -ForegroundColor Green

    $root = Resolve-Path (Join-Path $PSScriptRoot "..")
    Push-Location $root
    try {
        # --- Install dependencies if needed ---
        if (-not (Test-Path (Join-Path $root "node_modules"))) {
            Write-Host "`nInstalling dependencies (npm install)..." -ForegroundColor Cyan
            npm install
            if ($LASTEXITCODE -ne 0) { Fail "npm install failed (exit code $LASTEXITCODE)." }
        }

        # --- Build the Windows installer ---
        Write-Host "`nBuilding the Windows installer (npm run dist -- --win)..." -ForegroundColor Cyan
        npm run dist -- --win
        if ($LASTEXITCODE -ne 0) { Fail "The build failed (exit code $LASTEXITCODE). See the output above." }

        # --- Collect the output ---
        New-Item -ItemType Directory -Force -Path "windows\dist" | Out-Null

        $exes = Get-ChildItem "release\*.exe" -ErrorAction SilentlyContinue
        if (-not $exes) { Fail "Build finished but no .exe was produced in 'release\'." }

        Copy-Item "release\*.exe" "windows\dist\" -Force
        Copy-Item "release\*.blockmap" "windows\dist\" -Force -ErrorAction SilentlyContinue

        Write-Host "`nDone. Installer copied to windows\dist\:" -ForegroundColor Green
        Get-ChildItem "windows\dist\*.exe" | ForEach-Object { Write-Host ("  " + $_.Name) }
    } finally {
        Pop-Location
    }

    Close-Window 0
} catch {
    Fail $_.Exception.Message
}
