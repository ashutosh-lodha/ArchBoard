#!/usr/bin/env bash
# GCE startup script for archboard-vm (Ubuntu 24.04). Idempotent: safe to run on every boot.
# - installs Caddy (official apt repo) for automatic HTTPS
# - creates a locked-down "deploy" user that CI uses to upload releases over SSH
# - lays out /srv/archboard/{releases,current}
# - adds a 2 GB swapfile and unattended security upgrades
set -euo pipefail

DEPLOY_PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM9ma+yaL4I4N10WkggJ0XjwkkfKQD8ssyRGm6HQDZ7x archboard-deploy"

export DEBIAN_FRONTEND=noninteractive

if ! command -v caddy >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg unattended-upgrades
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# Swap as a safety net on small machines.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Deploy user: can write releases, nothing else (no sudo).
if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
fi
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "$DEPLOY_PUBKEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys

install -d -m 755 -o deploy -g deploy /srv/archboard /srv/archboard/releases
if [ ! -e /srv/archboard/current ]; then
  install -d -m 755 -o deploy -g deploy /srv/archboard/releases/placeholder
  echo '<!doctype html><title>ArchBoard</title><p>Deploying… check back in a minute.</p>' > /srv/archboard/releases/placeholder/index.html
  chown -R deploy:deploy /srv/archboard/releases/placeholder
  ln -sfn /srv/archboard/releases/placeholder /srv/archboard/current
  chown -h deploy:deploy /srv/archboard/current
fi

# The one privileged action CI may take: validate an uploaded Caddyfile and, only if valid,
# install it and reload Caddy. A bad config never replaces a good one.
cat > /usr/local/bin/archboard-apply-caddy <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
SRC=/home/deploy/Caddyfile
[ -f "$SRC" ] || { echo "no $SRC"; exit 1; }
caddy validate --config "$SRC" --adapter caddyfile
install -m 644 "$SRC" /etc/caddy/Caddyfile
systemctl reload caddy
SCRIPT
chmod 755 /usr/local/bin/archboard-apply-caddy
echo 'deploy ALL=(root) NOPASSWD: /usr/local/bin/archboard-apply-caddy' > /etc/sudoers.d/archboard-deploy
chmod 440 /etc/sudoers.d/archboard-deploy

systemctl enable --now caddy
if [ -f /home/deploy/Caddyfile ]; then
  /usr/local/bin/archboard-apply-caddy || true
fi
