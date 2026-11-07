# ---------- Etapa 1: dependencias ----------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------- Etapa 2: build ----------
FROM node:24-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && apt-get upgrade -y \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN node scripts/generate-images.mjs
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ---------- Etapa 3: ejecución ----------
FROM node:24-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
  && groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/app/data/novastore.db

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
USER nextjs

EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
