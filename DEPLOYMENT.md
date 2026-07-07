# Deployment Guide — Nexus AI Omega v3.3

## Railway Deployment

### Prerequisites
- Railway account
- GitHub repo connected to Railway
- Discord bot application created

### Step 1 — Create Railway Project

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select `Minecraft-Server-Host/nexus-ai-omega`
3. Railway auto-detects Dockerfile

### Step 2 — Add Database Services

In Railway project → Add Service:

| Service | Plugin | Config |
|---|---|---|
| PostgreSQL | Railway PostgreSQL | Extensions: uuid-ossp, pg_trgm, pgcrypto |
| Redis | Railway Redis | maxmemory 512mb, allkeys-lru, AOF on |
| ClickHouse | Docker Image: `clickhouse/clickhouse-server:latest` | Volume: 10GB |
| Qdrant | Docker Image: `qdrant/qdrant:latest` | Volume: 5GB |
| Redpanda | Docker Image: `redpandadata/redpanda:latest` | — |

### Step 3 — Set Environment Variables

In Railway project → Variables → Add all from `.env.example`:

```
NODE_ENV=production
PORT=8080
DISCORD_TOKEN=<your bot token>
DISCORD_CLIENT_ID=<your client id>
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
KAFKA_BROKERS=${{Redpanda.KAFKA_BROKERS}}
CLICKHOUSE_URL=http://clickhouse.railway.internal:8123
QDRANT_URL=http://qdrant.railway.internal:6333
JWT_SECRET=<openssl rand -hex 32>
SESSION_SECRET=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 16>
GEMINI_API_KEY=<your gemini key>
# ... add all AI provider keys you have
```

### Step 4 — Run Migrations & Seed

After databases are healthy, in Railway → Service → Shell:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Verify:
```bash
# Should show 2 rows: Owner + CoOwner
npx prisma studio  # or run SQL
```

### Step 5 — Deploy Services

Create 5 Railway services from same repo, each with `SERVICE_ROLE` override:

| Service | Start Command | RAM |
|---|---|---|
| nexus-api | `node dist/index.js` | 512MB |
| nexus-worker-core | `WORKER_ROLE=core node dist/services/workers.js` | 512MB |
| nexus-worker-security | `WORKER_ROLE=security node dist/services/workers.js` | 512MB |
| nexus-worker-ai | `WORKER_ROLE=ai node dist/services/workers.js` | 1GB |
| nexus-worker-analytics | `WORKER_ROLE=analytics node dist/services/workers.js` | 512MB |

### Step 6 — Configure Domains

- `api.nexus-omega.up.railway.app` → `nexus-api` service
- `nexus-omega.up.railway.app` → `nexus-api` service (dashboard)

### Step 7 — Invite Bot

Generate invite URL:
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot+applications.commands
```

Invite to Control Guild: `1523481048149921883`

### Step 8 — Verify

```bash
# Health check
curl https://api.nexus-omega.up.railway.app/healthz

# Status
curl https://api.nexus-omega.up.railway.app/api/v1/status

# AI Providers
curl https://api.nexus-omega.up.railway.app/api/v1/ai/providers
```

Expected `/healthz` response:
```json
{ "ok": true, "version": "3.3.0-team-v2", "uptime": 123 }
```

## Environment Variables Reference

See `.env.example` for the complete list with descriptions.

## Rollback

Railway → Deployments → Select previous deployment → Redeploy

If ANY smoke test fails → rollback immediately, open GitHub issue with logs.
