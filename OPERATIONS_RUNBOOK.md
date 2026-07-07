# Operations Runbook — Nexus AI Omega v3.3

## Smoke Test Checklist (run after every deploy)

All items must be ✅ before marking deploy successful.

### API Health
- [ ] `GET /healthz` → `{ok:true, version:"3.3.0-team-v2", ...}`
- [ ] `GET /api/v1/status` → `gateway.ready:≥1`, `ai.modules:18`, `security.modulesActive:18`
- [ ] `GET /api/v1/ai/providers` → lists 13 providers, `configured:true` for each key set

### AI Inference
- [ ] `POST /api/v1/ai/infer` `{"module":"AI_COMMUNITY_MANAGER","prompt":"test","provider":"auto"}` → 200, `latencyMs < 2000`

### Discord Bot
- [ ] `/ping` → replies `<150ms`, shows shard info, AI providers, uptime
- [ ] `/ai prompt:"hello" provider:auto` → AI response received
- [ ] `/dashboard` → returns dashboard URL embed

### Control Guild (`1523481048149921883`)
- [ ] Bot is member of Control Guild
- [ ] 8 categories + 71 channels exist
- [ ] `#system-logs` shows `🟢 Nexus AI Omega — Global Control Center Online`
- [ ] `/team list` → shows Owner `1097607057244442764` + CoOwner `1056815951980527678` — both ACTIVE

### Team System
- [ ] `✨ Nexus Team` role exists in a test guild — color `#06b6d4`, hoist true
- [ ] Manually assign `✨ Nexus Team` to non-team user → auto-stripped `<2s`
- [ ] `#security-logs` → `UNAUTHORIZED_ROLE_ASSIGNMENT_BLOCKED`

### Global Ban System
- [ ] `/globalbanuser user:@testalt reason:"e2e"` → success embed
- [ ] Banned user runs `/ping` → `⛔ You are currently restricted from using Nexus AI Omega…`
- [ ] `/globalunbanuser` → unblock works

### Dashboard
- [ ] `https://nexus-omega.up.railway.app/` → loads `<1.5s`
- [ ] SSE connects → telemetry ticking
- [ ] `curl -N https://api.nexus-omega.up.railway.app/api/v1/stream` → receives `event: telemetry` every ~1.2s

### Database
- [ ] `SELECT count(*) FROM "global_servers";` → ≥1
- [ ] `SELECT * FROM nexus_team_members WHERE status='ACTIVE';` → ≥2 (Owner + CoOwner)
- [ ] `SELECT count(*) FROM global_logs WHERE created_at > now() - interval '5 minutes';` → >0

### Observability
- [ ] Railway logs → 0 ERROR level in last 5 min
- [ ] Sentry DSN → test error captured `<60s`
- [ ] ClickHouse → `SELECT count() FROM message_events WHERE ts > now() - 300` → >0 (if traffic)

---

## Common Issues

### Bot not connecting
- Check `DISCORD_TOKEN` is set and valid
- Verify bot has `bot` + `applications.commands` scopes
- Check Gateway intents are enabled in Discord Dev Portal (Message Content, Server Members)

### Database connection error
- Verify `DATABASE_URL` and `DIRECT_URL` are set
- Run `npx prisma migrate deploy` if tables missing
- Check PostgreSQL service is healthy in Railway

### AI providers not working
- Check respective `*_API_KEY` environment variables
- `/api/v1/ai/providers` shows which are `configured:true`
- AI falls back to `nexus-mock` if no keys set

### Control Guild not provisioning
- Verify `NEXUS_CONTROL_GUILD_ID=1523481048149921883`
- Bot must be in that guild with Administrator permission
- Check `#system-logs` for errors

### Role protection not stripping
- Ensure bot has `Manage Roles` permission
- Bot role must be ABOVE `✨ Nexus Team` in role hierarchy
- Check `#security-logs` for `UNAUTHORIZED_ROLE_ASSIGNMENT_BLOCKED` events

---

## Escalation

1. Check `#error-logs` in Control Guild
2. Check Railway service logs
3. Check Sentry for captured errors
4. Roll back via Railway → Deployments → Previous → Redeploy
5. Open GitHub issue with full logs
