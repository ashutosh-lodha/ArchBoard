#!/usr/bin/env bash
# GCE startup script for archboard-vm (Ubuntu 24.04). Idempotent: safe to run on every boot.
# - installs nginx (reverse proxy) and certbot (Let's Encrypt certificates, auto-renewed)
# - installs Docker Engine + Compose (official apt repo) for the API and Postgres
# - creates a locked-down "deploy" user that CI uses to upload releases over SSH
# - lays out /srv/archboard/{releases,current,stack,backups}
# - generates the Postgres password on the VM (it never leaves the machine)
# - two root helpers CI may run via sudo, nothing else: apply a validated nginx config, and
#   deploy/roll back the API stack
# - nightly database backups, a 2 GB swapfile and unattended security upgrades
set -euo pipefail

DEPLOY_PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM9ma+yaL4I4N10WkggJ0XjwkkfKQD8ssyRGm6HQDZ7x archboard-deploy"

export DEBIAN_FRONTEND=noninteractive

if ! command -v nginx >/dev/null 2>&1 || ! command -v certbot >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y nginx certbot openssl curl ca-certificates gnupg unattended-upgrades
  rm -f /etc/nginx/sites-enabled/default
fi

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable"     > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  # Rotate container logs so they can never fill the disk.
  cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
  systemctl restart docker
fi
systemctl enable --now docker

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
install -d -m 700 -o deploy -g deploy /home/deploy/stack
install -d -m 750 /srv/archboard/stack /srv/archboard/backups
# Postgres password: generated here once, readable by root only.
if [ ! -f /srv/archboard/stack/secrets.env ]; then
  umask 077
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > /srv/archboard/stack/secrets.env
  umask 022
fi
if [ ! -e /srv/archboard/current ]; then
  install -d -m 755 -o deploy -g deploy /srv/archboard/releases/placeholder
  echo '<!doctype html><title>ArchBoard</title><p>Deploying… check back in a minute.</p>' > /srv/archboard/releases/placeholder/index.html
  chown -R deploy:deploy /srv/archboard/releases/placeholder
  ln -sfn /srv/archboard/releases/placeholder /srv/archboard/current
  chown -h deploy:deploy /srv/archboard/current
fi

# Privileged action 1: install the nginx config CI uploaded to /home/deploy/nginx, only if
# `nginx -t` passes (a bad config never replaces a good one). Before a certificate exists it
# serves the HTTP bootstrap config and asks Let's Encrypt for one (needs DNS pointing here).
cat > /usr/local/bin/archboard-apply-nginx <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
IN=/home/deploy/nginx
DOMAIN=archboard.ashutoshdev.online
SITE=/etc/nginx/sites-available/archboard
SNIPPET=/etc/nginx/snippets/archboard-security-headers.conf
for f in archboard.conf bootstrap.conf security-headers.conf; do
  [ -f "$IN/$f" ] || { echo "missing $IN/$f"; exit 1; }
done
install -d /var/www/letsencrypt /etc/nginx/snippets
BACKUP=$(mktemp -d)
cp -a "$SITE" "$BACKUP/site" 2>/dev/null || true
cp -a "$SNIPPET" "$BACKUP/snippet" 2>/dev/null || true
restore() {
  echo "nginx config rejected: keeping the previous one"
  [ -f "$BACKUP/site" ] && cp -a "$BACKUP/site" "$SITE"
  [ -f "$BACKUP/snippet" ] && cp -a "$BACKUP/snippet" "$SNIPPET"
  exit 1
}
install -m 644 "$IN/security-headers.conf" "$SNIPPET"
ln -sfn "$SITE" /etc/nginx/sites-enabled/archboard
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  install -m 644 "$IN/bootstrap.conf" "$SITE"
  nginx -t || restore
  systemctl reload nginx
  if ! certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" -d "www.$DOMAIN"       --non-interactive --agree-tos --register-unsafely-without-email       --deploy-hook "systemctl reload nginx"; then
    echo "no certificate yet (is DNS pointing at this VM?): serving HTTP until the next run"
    exit 0
  fi
fi
install -m 644 "$IN/archboard.conf" "$SITE"
nginx -t || restore
systemctl reload nginx
echo "nginx config applied"
SCRIPT
chmod 755 /usr/local/bin/archboard-apply-nginx

# Privileged action 2: deploy (or roll back) the API stack from files CI uploaded to
# /home/deploy/stack. Inputs are validated; a failed health check rolls back automatically.
cat > /usr/local/bin/archboard-stack <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
IN=/home/deploy/stack
STACK=/srv/archboard/stack
dc() { docker compose --env-file "$STACK/secrets.env" -f "$STACK/compose.yml" "$@"; }
case "${1:-}" in
  deploy)
    for f in compose.yml app.env api-image.tar.gz; do [ -f "$IN/$f" ] || { echo "missing $IN/$f"; exit 1; }; done
    if grep -Ev '^(PUBLIC_ORIGIN|CLERK_JWT_KEY|LOG_LEVEL|APP_VERSION)=' "$IN/app.env" | grep -q .; then
      echo "app.env may only set PUBLIC_ORIGIN, CLERK_JWT_KEY, LOG_LEVEL and APP_VERSION"; exit 1
    fi
    install -m 640 "$IN/compose.yml" "$STACK/compose.yml.new"
    install -m 640 "$IN/app.env" "$STACK/app.env"
    docker compose --env-file "$STACK/secrets.env" -f "$STACK/compose.yml.new" config -q
    mv "$STACK/compose.yml.new" "$STACK/compose.yml"
    if docker image inspect archboard-api:current >/dev/null 2>&1; then
      docker tag archboard-api:current archboard-api:previous
    fi
    gunzip -c "$IN/api-image.tar.gz" | docker load
    rm -f "$IN/api-image.tar.gz"
    dc up -d postgres
    dc --profile migrate run --rm migrate
    if ! dc up -d --wait --wait-timeout 90 api; then
      echo "api failed its health check: rolling back"
      dc logs --tail 50 api || true
      if docker image inspect archboard-api:previous >/dev/null 2>&1; then
        docker tag archboard-api:previous archboard-api:current
        dc up -d --wait --wait-timeout 90 api || true
      fi
      exit 1
    fi
    docker image prune -f >/dev/null
    echo "api deployed"
    ;;
  rollback)
    docker image inspect archboard-api:previous >/dev/null 2>&1 || { echo "no previous image"; exit 1; }
    docker tag archboard-api:previous archboard-api:current
    dc up -d --wait --wait-timeout 90 api
    echo "api rolled back"
    ;;
  status) dc ps ;;
  *) echo "usage: archboard-stack deploy|rollback|status"; exit 2 ;;
esac
SCRIPT
chmod 755 /usr/local/bin/archboard-stack

# Nightly database backup (03:15 UTC), 7 kept on the VM; the disk itself is also snapshotted
# daily by a Terraform-managed snapshot schedule.
cat > /usr/local/bin/archboard-backup <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
OUT=/srv/archboard/backups
STACK=/srv/archboard/stack
[ -f "$STACK/compose.yml" ] || exit 0
docker compose --env-file "$STACK/secrets.env" -f "$STACK/compose.yml" exec -T postgres   pg_dump -U archboard --format=custom archboard > "$OUT/archboard-$(date -u +%F).dump"
find "$OUT" -name 'archboard-*.dump' -mtime +7 -delete
SCRIPT
chmod 755 /usr/local/bin/archboard-backup
echo '15 3 * * * root /usr/local/bin/archboard-backup' > /etc/cron.d/archboard-backup

cat > /etc/sudoers.d/archboard-deploy <<'SUDO'
deploy ALL=(root) NOPASSWD: /usr/local/bin/archboard-apply-nginx, /usr/local/bin/archboard-stack
SUDO
chmod 440 /etc/sudoers.d/archboard-deploy

# First boot: the nginx config comes from instance metadata (set by Terraform from infra/nginx);
# later deploys upload newer versions. Then apply it (and get the certificate once DNS is live).
install -d -m 755 -o deploy -g deploy /home/deploy/nginx
md() { curl -fsS -H 'Metadata-Flavor: Google' "http://metadata.google.internal/computeMetadata/v1/instance/attributes/$1"; }
for pair in archboard.conf:nginx-site bootstrap.conf:nginx-bootstrap security-headers.conf:nginx-headers; do
  file="${pair%%:*}"; key="${pair##*:}"
  if [ ! -f "/home/deploy/nginx/$file" ] && md "$key" > "/tmp/$file" 2>/dev/null; then
    install -m 644 -o deploy -g deploy "/tmp/$file" "/home/deploy/nginx/$file"
  fi
done
systemctl enable --now nginx
/usr/local/bin/archboard-apply-nginx || true
