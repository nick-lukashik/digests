# syntax=docker/dockerfile:1
#   docker build --build-arg APP_VERSION=$(git rev-parse HEAD) -t digests .
#   docker run --rm --read-only --env-file .env digests
# APP_VERSION is the only build arg, the rest is runtime env. A job: it starts,
# works and exits, so no port and no health check; the exit code is the result.

# base: the Node image every stage starts from. Renovate updates the tag.
FROM node:26.13.0-trixie-slim AS base
WORKDIR /app

# deps: pnpm and the manifests.
FROM base AS deps
ENV CI=1
COPY package.json pnpm-lock.yaml ./
# Node 25+ ships without corepack: install the pnpm that package.json "packageManager" names.
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
    && npm cache clean --force

# build: dist/ from src/.
FROM deps AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

# prod-deps: node_modules without dev dependencies.
FROM deps AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --store-dir /pnpm/store

# runtime: files stay owned by root, so the app cannot change itself. The
# numeric non-root user (Kubernetes can verify runAsNonRoot) writes nothing:
# it runs with a read-only root filesystem.
FROM base AS runtime
ARG APP_VERSION=dev
LABEL org.opencontainers.image.title="digests" \
      org.opencontainers.image.version="${APP_VERSION}"
ENV NODE_ENV=production
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER 10001:10001
CMD ["node", "dist/main.js"]
