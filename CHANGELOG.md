# Changelog — Nexus AI Omega

All notable changes to this project will be documented in this file.

---

## [3.3.0] - 2026-07-07 — Team v2 + Global Admin

### Added
- Global Nexus Team System v2 — 8 ranks — auto `✨ Nexus Team` role sync across all guilds
- RoleProtectionService — `<120ms` unauthorized strip • auto-recreate • auto-repair
- Global Admin Control Center — Guild `1523481048149921883` — 8 categories • 71 channels auto-provision
- Global User Restriction — `/globalbanuser` • `/globalunbanuser` • `/globaluserinfo` • `/globalblacklist`
- Global Server Database + GlobalLog + GlobalStatsSnapshot — Prisma
- `/team` — 12 subcommands: add|remove|promote|demote|suspend|activate|info|list|sync|reload|history|permissions
- Universal AI Engine v3.1 — 13 providers: OpenAI, Anthropic, Google Gemini, Groq, Mistral, DeepSeek, xAI Grok, Cohere, Perplexity, Together, OpenRouter, Azure, Ollama Local — auto-failover
- API: `GET /api/v1/ai/providers` • `POST /api/v1/ai/provider/:guildId` (BYO-Key)
- Discord: `/ai` now has provider dropdown (14 options) • `/aiprovider` command

### Security
- Zero-Trust audit velocity `<5ms`
- MFA biometric push framework
- S3 audit media archiver
- Token leak regex scanner

### Infrastructure
- Next.js 14 PWA — `apps/web` — ActionBuilder • EmbedStudio • Marketplace
- ClickHouse OLAP batching 1000/2s
- Redis cache 60s TTL — 85% PG read reduction
- WASM Wasmtime sandbox
- Lavalink audio grid • Whisper voice AI • Arweave/IPFS • Minecraft Paper bridge
- Multi-stage Docker build — Node 20 Alpine
- Railway deployment config — 5 microservices

---

## [3.2.0] - 2026-06-01 — Global Admin v1

### Added
- `/globalbanuser`, `/globalunbanuser`, `/globaluserinfo`, `/globalblacklist` commands
- GlobalBan, GlobalBanHistory, GlobalServer, GlobalLog Prisma models
- Nexus Control Center — auto-provision guild structure

---

## [3.1.0] - 2026-04-15 — Universal AI Engine

### Added
- AI Engine supporting 9 providers with auto-failover
- 18 AI modules
- BYO API key per guild

---

## [3.0.0] - 2026-03-01 — Initial v3 Release

### Added
- discord.js v14 with slash commands
- Zero-Trust security center
- Kafka event bus with in-memory fallback
- ClickHouse OLAP analytics
- Glassmorphism SSE dashboard
