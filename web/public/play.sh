#!/bin/sh
# PassBCH.cash launcher:  curl -sL passbch.vercel.app | sh
command -v node >/dev/null 2>&1 || { echo "PassBCH.cash needs Node.js 18+ : https://nodejs.org"; exit 1; }
f="${TMPDIR:-/tmp}/passbch.mjs"
curl -fsSL -H "Cache-Control: no-cache" "https://passbch-cash.vercel.app/duel.mjs?t=$(date +%s)" -o "$f" && node "$f" "$@" </dev/tty
