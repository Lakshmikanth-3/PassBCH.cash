# Satoshi Duel launcher for PowerShell:  irm https://satoshi-duel.vercel.app/play.ps1 | iex
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host 'Satoshi Duel needs Node.js 18+ : https://nodejs.org' -ForegroundColor Red; return }
$f = Join-Path $env:TEMP 'satoshi-duel.mjs'
Invoke-WebRequest -UseBasicParsing 'https://satoshi-duel.vercel.app/duel.mjs' -OutFile $f
node $f @args
