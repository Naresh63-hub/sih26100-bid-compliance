# =====================================================================
# BIDGUARD AI — Production Frontend Dockerfile
# Multi-stage build for React / Next.js / Vinext UI
# =====================================================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install system dependencies if required
RUN apk add --no-cache libc6-compat

# Copy package manifests
COPY package.json package-lock.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Ensure pdf worker is copied
RUN node scripts/copy-pdf-worker.mjs

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bidguard

# Copy built artifacts and dependencies
COPY --from=builder --chown=bidguard:nodejs /app/package.json ./
COPY --from=builder --chown=bidguard:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=bidguard:nodejs /app/public ./public
COPY --from=builder --chown=bidguard:nodejs /app/app ./app
COPY --from=builder --chown=bidguard:nodejs /app/components ./components
COPY --from=builder --chown=bidguard:nodejs /app/lib ./lib
COPY --from=builder --chown=bidguard:nodejs /app/hooks ./hooks
COPY --from=builder --chown=bidguard:nodejs /app/scripts ./scripts
COPY --from=builder --chown=bidguard:nodejs /app/vite.config.ts ./
COPY --from=builder --chown=bidguard:nodejs /app/tsconfig.json ./

USER bidguard

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
