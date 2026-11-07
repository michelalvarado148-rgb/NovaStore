# ---------- Etapa 1: dependencias ----------
FROM node:24-alpine AS deps
WORKDIR /app
# Toolchain necesario para compilar better-sqlite3 en musl.
RUN apk upgrade --no-cache \
  && apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------- Etapa 2: build ----------
FROM node:24-alpine AS builder
WORKDIR /app
RUN apk upgrade --no-cache \
  && apk add --no-cache python3 make g++ ca-certificates
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN node scripts/generate-images.mjs
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ---------- Etapa 3: ejecución ----------
FROM node:24-alpine AS runner
WORKDIR /app
RUN apk upgrade --no-cache

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/app/data/novastore.db

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

RUN mkdir -p /app/data /app/.next/cache \
  && chown -R node:node /app/data /app/.next/cache

USER node

EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
