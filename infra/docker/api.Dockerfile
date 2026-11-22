# Production image for apps/api. Built in CI, shipped to the VM as a tarball (no registry needed).
# Debian slim (not Alpine) so Prisma's migration engine runs without musl workarounds.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# Manifests first, for layer caching. Every workspace manifest is copied so the lockfile matches.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/diagram-schema/package.json packages/diagram-schema/
COPY packages/icons/package.json packages/icons/
COPY packages/ui/package.json packages/ui/
COPY packages/db/package.json packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma packages/db/prisma

# Only the API and its workspace dependencies (the Prisma CLI runs migrations; the shared
# tsconfig presets are needed by tsx and Prisma at runtime).
RUN pnpm install --frozen-lockfile --filter "@archboard/api..." --fetch-retries 5

COPY packages/config packages/config

COPY packages/shared packages/shared
COPY packages/diagram-schema packages/diagram-schema
COPY packages/db packages/db
COPY apps/api apps/api
RUN pnpm --filter @archboard/db generate

ENV NODE_ENV=production
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
USER node
EXPOSE 3000
WORKDIR /repo/apps/api
# Run node directly (not via pnpm) so SIGTERM reaches the app and shutdown is graceful.
CMD ["node", "--import", "tsx", "src/main.ts"]
