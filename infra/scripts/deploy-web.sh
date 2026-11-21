#!/usr/bin/env bash
# Deploy the built SPA to the VM over SSH with an atomic switch and keep the last 5 releases.
#   usage: deploy-web.sh <host> <release-id> <path-to-dist>
# Requires an SSH key for the "deploy" user (CI: secret VM_SSH_KEY).
set -euo pipefail

HOST="$1"
RELEASE="$2"
DIST="$3"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
ROOT=/srv/archboard

tar -C "$DIST" -czf "/tmp/archboard-$RELEASE.tgz" .
scp "${SSH_OPTS[@]}" "/tmp/archboard-$RELEASE.tgz" "deploy@$HOST:/tmp/"
scp "${SSH_OPTS[@]}" infra/caddy/Caddyfile "deploy@$HOST:/home/deploy/Caddyfile.new"

ssh "${SSH_OPTS[@]}" "deploy@$HOST" bash -s -- "$RELEASE" <<'REMOTE'
set -euo pipefail
RELEASE="$1"
ROOT=/srv/archboard
DIR="$ROOT/releases/$RELEASE"
mkdir -p "$DIR"
tar -xzf "/tmp/archboard-$RELEASE.tgz" -C "$DIR"
rm -f "/tmp/archboard-$RELEASE.tgz"
test -f "$DIR/index.html"

# Update the Caddy config only when it changed (validated before it's applied).
if ! cmp -s /home/deploy/Caddyfile.new /home/deploy/Caddyfile 2>/dev/null; then
  mv /home/deploy/Caddyfile.new /home/deploy/Caddyfile
  sudo /usr/local/bin/archboard-apply-caddy
else
  rm -f /home/deploy/Caddyfile.new
fi

# Atomic switch: build the new symlink beside the old one, then rename over it.
ln -sfn "$DIR" "$ROOT/current.tmp"
mv -T "$ROOT/current.tmp" "$ROOT/current"
echo "$RELEASE" > "$ROOT/CURRENT_RELEASE"

# Keep the five newest releases (plus whatever is current).
cd "$ROOT/releases"
ls -1t | grep -v '^placeholder$' | tail -n +6 | while read -r old; do
  [ "$ROOT/releases/$old" = "$(readlink -f "$ROOT/current")" ] || rm -rf "$old"
done
echo "deployed $RELEASE"
REMOTE
