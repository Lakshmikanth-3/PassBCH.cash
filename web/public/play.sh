#!/bin/sh
# Satoshi Duel launcher:  curl -fsSL https://satoshi-duel.vercel.app/play.sh | sh
command -v node >/dev/null 2>&1 || { echo "Satoshi Duel needs Node.js 18+ : https://nodejs.org"; exit 1; }
f="${TMPDIR:-/tmp}/satoshi-duel.mjs"
curl -fsSL https://satoshi-duel.vercel.app/duel.mjs -o "$f" && node "$f" "$@" </dev/tty
