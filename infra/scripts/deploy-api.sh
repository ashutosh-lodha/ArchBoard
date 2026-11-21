#!/usr/bin/env bash
# Ship the API image (a docker-save tarball built in CI) and its config to the VM, then let the
# root helper load it, run database migrations and swap the container. If the new container
# fails its health check, the helper rolls back to the previous image automatically.
#   usage: deploy-api.sh <host> <image-tarball.gz> <app.env>
set -euo pipefail
HOST="$1"
IMAGE="$2"
APP_ENV="$3"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

scp "${SSH_OPTS[@]}" "$IMAGE" "deploy@$HOST:/home/deploy/stack/api-image.tar.gz"
scp "${SSH_OPTS[@]}" infra/stack/compose.prod.yml "deploy@$HOST:/home/deploy/stack/compose.yml"
scp "${SSH_OPTS[@]}" "$APP_ENV" "deploy@$HOST:/home/deploy/stack/app.env"
ssh "${SSH_OPTS[@]}" "deploy@$HOST" 'sudo /usr/local/bin/archboard-stack deploy'
