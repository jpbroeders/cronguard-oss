# syntax=docker/dockerfile:1
FROM node:24-alpine AS base

# Install dependencies for better-sqlite3 compilation
RUN apk add --no-cache python3 make g++

# --- Dependencies stage ---
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# --- Builder stage ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js application
RUN npm run build

# --- Production stage ---
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy better-sqlite3 native bindings (built for Alpine in deps stage)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Port is configurable via environment variable (default: 3000)
ARG PORT=3000
EXPOSE ${PORT}

USER nextjs

ENV PORT=${PORT}
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
