#!/usr/bin/env bash
# Usage: shots.sh name=hash ...   for example: shots.sh s05=/5/0/3
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"
for spec in "$@"; do
  "$dir/shot.sh" "${spec%%=*}" "${spec#*=}" "${WAIT:-5000}" >/dev/null
done
