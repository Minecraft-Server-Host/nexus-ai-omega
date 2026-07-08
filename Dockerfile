# ============================================================
# Nexus AI Omega v3.3 — Multi-stage Production Dockerfile
# Node 20 LTS — Alpine — Multi-arch
# ============================================================

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# ── Dependencies (prod only) ──────────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
# prisma is in dependencies so it installs here; use local binary (not npx) to avoid downloading latest
RUN npm install --omit=dev --no-fund --legacy-peer-deps && \
    ./node_modules/.bin/prisma generate

# ── Builder (all deps + compile) ──────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm install --no-fund --legacy-peer-deps
COPY . .
# prisma generate runs here too so compiled code has up-to-date client types
RUN ./node_modules/.bin/prisma generate && npm run build

# ── Production image ──────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nexus

COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/src/dashboard ./src/dashboard
COPY                package.json      ./

USER nexus
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "timeout 60 ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss; code=$?; if [ $code -ne 0 ]; then echo \"prisma db push exited with code $code (continuing startup; runtime queries will surface real schema errors)\"; fi; exec node dist/index.js"]
