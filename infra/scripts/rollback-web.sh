#!/usr/bin/env bash
# Point "current" back at an earlier release (default: the previous one).
#   usage: rollback-web.sh <host> [release-id]
set -euo pipefail
HOST="$1"
TARGET="${2:-}"
ssh -o StrictHostKeyChecking=accept-new "deploy@$HOST" bash -s -- "$TARGET" <<'REMOTE'
set -euo pipefail
ROOT=/srv/archboard
cd "$ROOT/releases"
CURRENT="$(basename "$(readlink -f "$ROOT/current")")"
TARGET="${1:-$(ls -1t | grep -v -e "^$CURRENT\$" -e '^placeholder$' | head -n 1)}"
[ -n "$TARGET" ] && [ -f "$ROOT/releases/$TARGET/index.html" ] || { echo "no release to roll back to"; exit 1; }
ln -sfn "$ROOT/releases/$TARGET" "$ROOT/current.tmp"
mv -T "$ROOT/current.tmp" "$ROOT/current"
echo "$TARGET" > "$ROOT/CURRENT_RELEASE"
echo "rolled back from $CURRENT to $TARGET"
REMOTE
