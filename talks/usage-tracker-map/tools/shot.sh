#!/usr/bin/env bash
# Usage: shot.sh <name> <hash> [wait_ms]
# Takes a 1600x900 headless Chrome screenshot of the deck at the given reveal.js hash (for example /5/0/2).
set -euo pipefail
name="$1"
hash="$2"
wait="${3:-4000}"
out="$(cd "$(dirname "$0")/.." && pwd)/out/shots"
mkdir -p "$out"
profile="$(mktemp -d)"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --user-data-dir="$profile" --window-size=1600,900 --virtual-time-budget="$wait" \
  --screenshot="$out/$name.png" "http://127.0.0.1:8765/index.html?shot#$hash" >/dev/null 2>&1
rm -rf "$profile"
echo "$out/$name.png"
