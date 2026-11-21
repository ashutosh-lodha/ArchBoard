#!/usr/bin/env bash
# Roll back: point "current" at an earlier web release (default: the previous one) and switch
# the API back to its previous image.
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
echo "web rolled back from $CURRENT to $TARGET"
sudo /usr/local/bin/archboard-stack rollback || echo "api: nothing to roll back"
REMOTE
