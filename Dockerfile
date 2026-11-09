# taployal — production container.
#
# Next.js standalone output: the build emits a self-contained server at
# .next/standalone/server.js, so the runtime image needs no node_modules install
# and no source tree.
#
# WHY standalone: directive §2 requires it, and it makes .pkpass signing / APNs
# / queue workers runnable in the same long-lived Node process.
#
# NOTE on the install step: the committed lockfile was produced on a different
# platform/libc (Alpine aarch64) with --no-bin-links, so `npm ci` is attempted
# first for reproducibility and falls back to `npm install` if the lockfile is
# rejected. Both are pinned by package.json ranges.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# No runtime secrets at build time: the Better Auth instance is created lazily,
# so `next build` never needs DATABASE_URL.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Fail fast if the process dies; the platform restarts it.
CMD ["node", "server.js"]
