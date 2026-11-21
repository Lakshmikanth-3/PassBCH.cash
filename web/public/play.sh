#!/bin/sh
# PassBCH.cash launcher:  curl -fsSL https://passbch-cash.vercel.app/play.sh | sh
command -v node >/dev/null 2>&1 || { echo "PassBCH.cash needs Node.js 18+ : https://nodejs.org"; exit 1; }
f="${TMPDIR:-/tmp}/passbch.mjs"
curl -fsSL https://passbch-cash.vercel.app/duel.mjs -o "$f" && node "$f" "$@" </dev/tty
