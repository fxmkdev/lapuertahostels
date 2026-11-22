# syntax = docker/dockerfile:1

# From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

FROM node:24-alpine AS base

# Install the native pnpm executable at the workspace's exact pinned version.
WORKDIR /app
COPY --link package.json ./
RUN npm install -g --allow-scripts=pnpm "$(node -p 'require("./package.json").packageManager.split("+")[0]')"

# Install dependencies only when needed
FROM base AS builder
ARG APP_VERSION=0.0.0-unknown
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
ENV CI=true

# Install dependencies
COPY --link package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --link patches patches
COPY --link apps/cms/package.json apps/cms/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm --config.store-dir=/pnpm/store --filter @lapuertahostels/cms install --frozen-lockfile

# Copy application code
COPY apps/cms apps/cms

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN pnpm --dir apps/cms build
RUN node -e "const fs = require('fs'); const [file, version] = process.argv.slice(1); const pkg = JSON.parse(fs.readFileSync(file, 'utf8')); pkg.version = version; fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');" apps/cms/.next/standalone/apps/cms/package.json "$APP_VERSION"

# Production image, copy all the files and run next
FROM base AS runner

# Dependencies are fixed at build time, including for Payload maintenance scripts.
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy source files so that we can run scripts like 'payload migrate'
COPY --from=builder /app .

RUN mv apps/cms/.next/static apps/cms/.next/standalone/apps/cms/.next/static
RUN cp apps/cms/public apps/cms/.next/standalone/apps/cms/public -r

# Set the correct permission for prerender cache
RUN chown nextjs:nodejs apps/cms/.next/standalone/apps/cms/.next

USER nextjs

EXPOSE 3001

ENV PORT=3001

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD HOSTNAME="0.0.0.0" node apps/cms/.next/standalone/apps/cms/server.js
