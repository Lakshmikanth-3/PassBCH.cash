# PassBCH.cash launcher for PowerShell:  irm https://passbch.vercel.app | iex
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host 'PassBCH.cash needs Node.js 18+ : https://nodejs.org' -ForegroundColor Red; return }
$f = Join-Path $env:TEMP 'passbch.mjs'
Invoke-WebRequest -UseBasicParsing "https://passbch-cash.vercel.app/duel.mjs?t=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -Headers @{ 'Cache-Control' = 'no-cache' } -OutFile $f
node $f @args
