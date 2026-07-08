# ============================================================
# Nexus AI Omega v3.3 — Multi-stage Production Dockerfile
# Node 20 LTS — Alpine — Multi-arch
# ============================================================

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# ── Dependencies ─────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev --no-fund --legacy-peer-deps && npx prisma generate

# ── Builder ──────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm install --no-fund --legacy-peer-deps
COPY . .
RUN npm run build

# ── Production image ─────────────────────────────────────────
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

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
