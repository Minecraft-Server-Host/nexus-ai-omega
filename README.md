# Nexus AI Omega v3.3 — Team Ultimate

![Version](https://img.shields.io/badge/version-3.3.0--team--v2-7c3aed)
![Node](https://img.shields.io/badge/node-%3E%3D20-06ffa5)
![Discord.js](https://img.shields.io/badge/discord.js-v14-5865f2)
![Status](https://img.shields.io/badge/status-production_ready-success)
![AI Providers](https://img.shields.io/badge/AI%20providers-13-blueviolet)
![License](https://img.shields.io/badge/license-Proprietary-red)

> 🌐 World's Best Discord Bot • Zero-Trust Security • 18 AI Modules • 13 LLM Providers • Global Admin Control Center • WASM • ClickHouse OLAP • Lavalink • Whisper AI

---

## ✨ Features

| Feature | Details |
|---|---|
| **Universal AI Engine** | 13 providers: OpenAI, Anthropic, Google Gemini, Groq, Mistral, DeepSeek, xAI Grok, Cohere, Perplexity, Together, OpenRouter, Azure, Ollama — auto-failover |
| **18 AI Modules** | HybridAutoMod, ServerBuilder, CommunityManager, EmbedBuilder, SecurityAdvisor, CodeAssistant, Analytics, RAGTicket, and more |
| **Global Admin Control Center** | Guild `1523481048149921883` — auto-provisions 8 categories & 71 channels |
| **Global Team System v2** | 8 ranks • Owner → Co-Owner → Manager → Developer → AI Manager → Moderator → Support → Team |
| **Zero-Trust Security** | `<5ms` audit velocity • MFA • WASM sandbox |
| **Role Protection** | `<120ms` unauthorized strip • auto-recreate • auto-repair |
| **14 Slash Commands** | `/ping /ai /aiprovider /defcon /ban /timeout /purge /serverbuild /level /ticket /dashboard /globalbanuser /globalunbanuser /globaluserinfo /globalblacklist` + `/team` (12 subcommands) |
| **64-Shard Gateway** | Discord Gateway v10 • max_concurrency 16 |
| **Real-time Dashboard** | Glassmorphism SPA • SSE live telemetry |
| **ClickHouse OLAP** | 1000 events/2s batching • 90d retention |

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20
- PostgreSQL 15
- Redis 7
- (Optional) Kafka/Redpanda, ClickHouse, Qdrant

### Local Development

```bash
# 1. Clone
git clone https://github.com/Minecraft-Server-Host/nexus-ai-omega.git
cd nexus-ai-omega

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env with your tokens and keys

# 4. Database
npx prisma migrate deploy
npm run prisma:seed

# 5. Start (docker-compose for full stack)
docker-compose up -d          # start deps
npm run dev                   # start bot in dev mode
```

Or spin up everything with Docker:
```bash
docker-compose up --build
```

---

## 🏗️ Architecture

```
src/
├── index.ts                    # Unified entrypoint
├── bot/client.ts               # Discord.js v14 client + 14 slash commands
├── gateway/shardedClient.ts    # 64-shard Gateway v10
├── event-bus/kafkaClient.ts    # Kafka + in-memory fallback
├── security-center/            # Zero-Trust <5ms + MFA
├── ai-center/                  # Universal AI Engine (13 providers, 18 modules)
├── api/server.ts               # Express REST + Zod + JWT + SSE
├── services/                   # Redis, ClickHouse, Lavalink, Workers, S3, Arweave
├── global/                     # Control Center, Global Bans, Team System v2
└── dashboard/index.html        # Glassmorphism Cyber SPA
```

---

## 🌐 Deployment — Railway

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full Railway deployment guide.

**Quick deploy:**
1. Fork this repo
2. Create Railway project → connect repo
3. Add PostgreSQL + Redis plugins
4. Set environment variables (see `.env.example`)
5. Deploy!

---

## 👥 Global Team System v2

| Rank | Badge | Permissions |
|---|---|---|
| OWNER | 👑 | All (`*`) |
| CO_OWNER | 💎 | All except owner-only |
| MANAGER | 🛡 | Team + Server management |
| DEVELOPER | ⚙ | Code + AI management |
| AI_MANAGER | 🤖 | AI module management |
| MODERATOR | 🛡️ | Moderation + ban |
| SUPPORT | 🎫 | Ticket management |
| TEAM | 👥 | Basic team access |

---

## 🔐 Security

- **Zero-Trust** — every interaction verified `<5ms`
- **Rate Limits** — 180 req/min/IP (API), 20 req/min/user (AI)
- **Global Ban System** — `<1ms` check on every command
- **Role Protection** — unauthorized `✨ Nexus Team` role stripped `<120ms`
- **No secrets in code** — all via env vars
- **MFA** framework for team members

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

## 📊 Observability

- **Sentry** — error tracking
- **Pino** — structured JSON logs
- **ClickHouse** — analytics OLAP
- **Prometheus** — metrics on port 9090
- **SSE Dashboard** — real-time telemetry at `/`

---

## 📄 License

© 2026 Nexus AI Omega — All Rights Reserved. Proprietary software.
