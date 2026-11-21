#!/usr/bin/env bash
# Deploy the built SPA (and the nginx config, if it changed) to the VM over SSH, with an atomic
# switch, keeping the last 5 releases.
#   usage: deploy-web.sh <host> <release-id> <path-to-dist>
# Requires an SSH key for the "deploy" user (CI: secret VM_SSH_KEY).
set -euo pipefail

HOST="$1"
RELEASE="$2"
DIST="$3"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

tar -C "$DIST" -czf "/tmp/archboard-$RELEASE.tgz" .
scp "${SSH_OPTS[@]}" "/tmp/archboard-$RELEASE.tgz" "deploy@$HOST:/tmp/"
ssh "${SSH_OPTS[@]}" "deploy@$HOST" 'mkdir -p /home/deploy/nginx.new'
scp "${SSH_OPTS[@]}" infra/nginx/archboard.conf infra/nginx/bootstrap.conf \
  infra/nginx/security-headers.conf "deploy@$HOST:/home/deploy/nginx.new/"

ssh "${SSH_OPTS[@]}" "deploy@$HOST" bash -s -- "$RELEASE" <<'REMOTE'
set -euo pipefail
RELEASE="$1"
ROOT=/srv/archboard
DIR="$ROOT/releases/$RELEASE"
mkdir -p "$DIR"
tar -xzf "/tmp/archboard-$RELEASE.tgz" -C "$DIR"
rm -f "/tmp/archboard-$RELEASE.tgz"
test -f "$DIR/index.html"

# Atomic switch: build the new symlink beside the old one, then rename over it.
ln -sfn "$DIR" "$ROOT/current.tmp"
mv -T "$ROOT/current.tmp" "$ROOT/current"
echo "$RELEASE" > "$ROOT/CURRENT_RELEASE"

# nginx: apply only when the config changed, or while still waiting for a certificate.
if ! diff -rq /home/deploy/nginx.new /home/deploy/nginx >/dev/null 2>&1 \
   || [ ! -f /etc/letsencrypt/live/archboard.ashutoshdev.online/fullchain.pem ]; then
  rm -rf /home/deploy/nginx && mv /home/deploy/nginx.new /home/deploy/nginx
  sudo /usr/local/bin/archboard-apply-nginx
else
  rm -rf /home/deploy/nginx.new
fi

# Keep the five newest releases (plus whatever is current).
cd "$ROOT/releases"
ls -1t | grep -v '^placeholder$' | tail -n +6 | while read -r old; do
  [ "$ROOT/releases/$old" = "$(readlink -f "$ROOT/current")" ] || rm -rf "$old"
done
echo "web deployed: $RELEASE"
REMOTE
