# 🌐 Nexus AI Omega v5 — Vollständiger Info-Bericht
### Datum: 2026-07-12 | Version: 5.1.0 | Sprache: TypeScript (ESM strict)

---

## 📊 Projekt-Statistiken

| Kennzahl | Wert |
|----------|------|
| 📄 Gesamt Dateien | **54 TypeScript-Dateien** |
| 📝 Gesamt Codezeilen | **9.117 Zeilen** |
| ⌨️ Slash-Commands | **22 Commands** |
| 📡 Event-Handler | **5 Events** |
| 🎫 Ticket-Typen | **6 Typen** |
| 🤖 KI-Module | **20 Module** |
| 🔮 KI-Provider | **14 Provider** |
| 🛡️ Security-Module | **18 defensive Module** |
| 🔘 Button-Handler | **9 Namespaces** |
| 🏗️ Auto-Setup Aktionen | **11 Aktionen** |

---

## 🗂️ Vollständige Dateistruktur

```
nexus-ai-omega-v5/
│
├── src/
│   │
│   ├── 📄 index.ts                          (59 Z.)   ← Entrypoint
│   │
│   ├── 🤖 ai-center/
│   │   └── aiEngine.ts                               ← KI-Engine
│   │
│   ├── 🔐 security-center/
│   │   └── securityManager.ts               (302 Z.)  ← Zero-Trust
│   │
│   ├── 📡 event-bus/
│   │   └── kafkaClient.ts                   (240 Z.)  ← Kafka/Memory Bus
│   │
│   ├── 🔧 services/
│   │   ├── logger.ts                        (142 Z.)  ← Pino Logger
│   │   └── redisCache.ts                    (217 Z.)  ← Redis Cache
│   │
│   ├── 📋 types/
│   │   └── index.ts                         (395 Z.)  ← Alle Interfaces
│   │
│   ├── 🎨 utils/
│   │   └── embeds.ts                        (496 Z.)  ← Design System
│   │
│   ├── 🌐 global/
│   │   ├── index.ts                          (44 Z.)  ← Barrel Export
│   │   ├── globalLogger.ts                  (184 Z.)  ← Global Logging
│   │   ├── nexusControlCenter.ts            (109 Z.)  ← Discord Log-Routing
│   │   ├── restrictionManager.ts            (229 Z.)  ← Global Bans
│   │   ├── serverRegistry.ts                (126 Z.)  ← Server-DB
│   │   ├── statisticsAggregator.ts           (75 Z.)  ← Stats
│   │   └── team/
│   │       ├── types.ts                      (68 Z.)  ← Rang-Definitionen
│   │       ├── globalTeamService.ts          (94 Z.)  ← Team-DB
│   │       ├── permissionService.ts          (54 Z.)  ← Berechtigungen
│   │       ├── roleSyncService.ts            (54 Z.)  ← Rollen-Sync
│   │       └── roleProtectionService.ts      (71 Z.)  ← Rollen-Schutz
│   │
│   └── 🤖 bot/
│       ├── client.ts                        (369 Z.)  ← ★ Haupt-Client
│       │
│       ├── ⌨️ commands/
│       │   ├── utility/
│       │   │   ├── ping.ts                   (30 Z.)
│       │   │   ├── help.ts                   (52 Z.)
│       │   │   ├── ai.ts                    (104 Z.)
│       │   │   ├── serverbuild.ts            (72 Z.)
│       │   │   └── suggest.ts               (123 Z.)
│       │   │
│       │   ├── info/
│       │   │   ├── userinfo.ts               (72 Z.)
│       │   │   ├── serverinfo.ts             (55 Z.)
│       │   │   ├── roleinfo.ts               (44 Z.)
│       │   │   └── avatar.ts                 (37 Z.)
│       │   │
│       │   ├── moderation/
│       │   │   ├── ban.ts                    (94 Z.)
│       │   │   ├── kick.ts                   (55 Z.)
│       │   │   ├── timeout.ts                (79 Z.)
│       │   │   ├── purge.ts                  (53 Z.)
│       │   │   ├── warn.ts                   (80 Z.)
│       │   │   └── defcon.ts                 (70 Z.)
│       │   │
│       │   ├── levels/
│       │   │   └── level.ts                  (56 Z.)
│       │   │
│       │   ├── setup/
│       │   │   ├── setup.ts                  (34 Z.)
│       │   │   ├── autosetup.ts           (1.005 Z.)
│       │   │   ├── setwelcome.ts            (136 Z.)
│       │   │   ├── setrules.ts              (207 Z.)
│       │   │   └── setlogs.ts                (95 Z.)
│       │   │
│       │   └── team/
│       │       └── clear.ts                 (630 Z.)
│       │
│       ├── 📡 events/
│       │   ├── interactionCreate.ts         (173 Z.)  ← Haupt-Dispatcher
│       │   ├── buttonHandler.ts             (190 Z.)  ← Button-Router
│       │   ├── modalHandler.ts               (28 Z.)  ← Modal-Router
│       │   ├── selectHandler.ts              (22 Z.)  ← Select-Router
│       │   ├── autocompleteHandler.ts        (30 Z.)  ← Autocomplete
│       │   ├── guildCreate.ts                (58 Z.)  ← Server beigetreten
│       │   ├── guildMemberAdd.ts            (131 Z.)  ← Member join
│       │   ├── guildMemberRemove.ts          (71 Z.)  ← Member leave
│       │   └── messageCreate.ts             (100 Z.)  ← Nachrichten
│       │
│       ├── 🔧 handlers/
│       │   ├── ticketHandler.ts             (375 Z.)  ← Ticket-System
│       │   └── serverBuildHandler.ts        (747 Z.)  ← Server-Builder
│       │
│       └── ⚙️ systems/
│           └── autoSetup.ts                 (632 Z.)  ← Auto-Setup Engine
│
├── .env.example                                       ← Env-Vorlage
├── package.json                                       ← Dependencies
└── tsconfig.json                                      ← TypeScript Konfig
```

---

## ⌨️ Alle 22 Slash-Commands

### 🔧 Utility (5 Commands)

| Command | Beschreibung | Cooldown | Berechtigung |
|---------|-------------|----------|--------------|
| `/ping` | 📡 Bot-Latenz, WebSocket-Ping & System-Status | 5s | Alle |
| `/help` | 📖 Alle Commands & Features — mit Kategorie-Auswahl | 5s | Alle |
| `/ai` | 🤖 Universal KI-System — 14 Provider, 20 Module | 3s | Alle |
| `/serverbuild` | 🏗️ KI Server Builder — kompletten Server aus Idee generieren | 30s | Manage Guild |
| `/suggest` | 💡 Vorschlag einreichen — mit Community-Voting | 60s | Alle |

**`/ai` Optionen:**
- `prompt` — Deine Frage oder Aufgabe
- `module` — 10 KI-Module wählbar (AutoMod, Server Builder, Security, Code, Embed…)
- `provider` — 10 Provider (OpenAI, Claude, Gemini, Groq, Mistral, DeepSeek, Grok, Cohere, OpenRouter, Ollama)
- `model` — Spezifisches Modell (mit Autocomplete)
- `ephemeral` — Nur für dich sichtbar?

**`/serverbuild` Flow:**
```
/serverbuild theme:"..." style:"..."
  → KI-Plan generieren (einzigartig per Seed)
  → Preview-Embed anzeigen
  → [✅ Erstellen] → Lösch-Abfrage mit Server-Übersicht
      ├── [🗑️ Alles löschen & neu bauen]
      ├── [➕ Behalten & hinzufügen]
      └── [❌ Abbrechen]
  → Live-Fortschritts-Embed
  → Abschlussbericht
```

---

### ℹ️ Info (4 Commands)

| Command | Beschreibung | Cooldown | Berechtigung |
|---------|-------------|----------|--------------|
| `/userinfo` | 👤 User-Infos: ID, Badges, Rollen, Account-Alter, Join-Datum | 5s | Alle |
| `/serverinfo` | 🏰 Server-Infos: Owner, Mitglieder, Kanäle, Boosts, Emojis | 10s | Alle |
| `/roleinfo` | 🎭 Rollen-Info: Farbe, Mitglieder, Berechtigungen, Position | 5s | Alle |
| `/avatar` | 🖼️ Profilbild in voller Größe (global + server-spezifisch) | 3s | Alle |

---

### 🛡️ Moderation (6 Commands)

| Command | Beschreibung | Cooldown | Berechtigung |
|---------|-------------|----------|--------------|
| `/ban` | 🔨 User permanent bannen (mit DM + Global-Log) | 5s | Ban Members |
| `/kick` | 👟 User kicken (mit DM + Log) | 5s | Kick Members |
| `/timeout` | ⏰ Timeout 1–40.320 Minuten (mit Auto-Aufhebung) | 3s | Moderate Members |
| `/purge` | 🗑️ 1–100 Nachrichten löschen (mit User-Filter) | 5s | Manage Messages |
| `/warn` | ⚠️ Verwarnung aussprechen (Auto-Eskalation) | 3s | Moderate Members |
| `/defcon` | 🛡️ DEFCON 1–5 anzeigen oder setzen | 5s | Manage Guild |

**`/warn` Auto-Eskalation:**
```
1. Verwarnung  → DM an User
2. Verwarnung  → DM an User
3. Verwarnung  → Auto-Timeout 10 Minuten ⏰
4. Verwarnung  → DM an User
5. Verwarnung  → Auto-Ban 🔨
```

**`/defcon` Stufen:**
```
DEFCON 5 🟢 — NORMAL    — Standardbetrieb
DEFCON 4 🟡 — ELEVATED  — Erhöhte Überwachung
DEFCON 3 🟠 — HIGH      — AutoMod maximiert
DEFCON 2 🔴 — CRITICAL  — Anti-Raid aktiv
DEFCON 1 ⚫ — PANIC     — Notfall-Lockdown
```

---

### 📈 Leveling (1 Command)

| Command | Beschreibung | Cooldown |
|---------|-------------|----------|
| `/level` | 📈 Level & XP anzeigen (eigenes oder anderes Profil) | 5s |

**XP-System:**
- 15 XP pro Nachricht
- 60 Sekunden Cooldown zwischen XP-Vergaben (kein Farming)
- Level-Up Benachrichtigung im Channel
- Fortschrittsbalken: `▓▓▓▓▓▓▓░░░ 72%`
- Formel: `Level = floor(0.1 × √XP)`

---

### ⚙️ Setup (5 Commands)

| Command | Beschreibung | Cooldown | Berechtigung |
|---------|-------------|----------|--------------|
| `/setup` | 🔧 Vollständiges Auto-Setup auf einmal | 30s | Manage Guild |
| `/autosetup` | ⚙️ Einzelne Module konfigurieren (11 Aktionen) | 10s | Manage Guild |
| `/setwelcome` | 👋 Welcome-Kanal einrichten (KI-generiert) | 10s | Manage Guild |
| `/setrules` | 📋 Regeln-Kanal mit KI-Regeln befüllen | 15s | Manage Guild |
| `/setlogs` | 📊 Log-Kanal einrichten (automatisch oder manuell) | 10s | Manage Guild |

**`/autosetup` — 11 Aktionen:**

| Aktion | Funktion |
|--------|----------|
| `🔧 Vollständiges Auto-Setup` | Alles auf einmal: scan + configure + erstellen |
| `🔍 Kanäle scannen` | Zeigt erkannte Kanäle + Quick-Action-Buttons |
| `📋 Nur Regeln setzen` | KI generiert Regeln → sendet + pinnt automatisch |
| `👋 Nur Welcome` | Welcome-Embed mit Buttons einrichten |
| `📊 Nur Logs` | Log-Kanal finden oder automatisch erstellen |
| `✅ Nur Verifizierung` | Verifizierungs-Button-System einrichten |
| `🎭 Nur Rollen erstellen` | 7 Standard-Rollen (Owner, Admin, Mod, Support, VIP, Member, Muted) |
| `📢 Ankündigungen` | Announcement-Kanal finden oder erstellen |
| `💡 Vorschlags-System` | Suggestion-Kanal mit Info-Embed + Thread-Erstellung |
| `📊 Status anzeigen` | Fortschrittsbalken + Übersicht aller konfigurierten Module |
| `🔄 Config zurücksetzen` | Cache löschen (mit doppelter Bestätigung) |

---

### 🔑 Team / Admin (1 Command)

| Command | Beschreibung | Cooldown | Zugriff |
|---------|-------------|----------|---------|
| `/clear` | 🗑️ Löscht Kanäle, Kategorien, Voice & Rollen | 60s | Server-Owner ODER Nexus-Team |

**`/clear` Scope-Optionen:**
- `🗑️ Alles` — Kanäle + Kategorien + Voice + Forum + Stage + Rollen
- `💬 Nur Kanäle` — Alle Kanäle & Kategorien (Rollen bleiben)
- `🎨 Nur Rollen` — Alle Rollen (Kanäle bleiben, @everyone + Bot-Rollen nie)

**Sicherheitsstufen:**
```
1. Zugriff: Server-Owner ODER Nexus-Team (DB-Check)
2. Fehlermeldung bei Ablehnung (zeigt Owner-Tag + Nexus-Team Info)
3. Bestätigungs-Embed mit vollständiger Lösch-Übersicht
4. 30 Sekunden Timeout → auto-abbrechen
5. 5-Sekunden Live-Countdown
6. Live-Fortschritts-Embed (3 Phasen)
7. Abschlussbericht mit Statistiken
8. Global-Log mit Executor + Scope + Dauer
```

---

## 📡 Event-Handler (5 Events)

### 1. `interactionCreate` (173 Zeilen)
Zentraler Dispatcher für ALLE Interactions:
- ✅ Global-Restriction-Check (Nexus-Ban)
- ✅ Quarantäne-Check (Zero-Trust)
- ✅ Slash-Command-Routing mit Cooldown-System
- ✅ Button-Dispatcher (9 Namespaces)
- ✅ Modal-Dispatcher
- ✅ Select-Menu-Dispatcher
- ✅ Autocomplete-Dispatcher
- ✅ Request-ID Tracing (AsyncLocalStorage)
- ✅ Error-Recovery (kein Crash bei Command-Fehler)

**Button-Namespaces:**
```
ticket:     → open, close, claim, priority
serverbuild:→ confirm, edit, regenerate, cancel, delete_all, keep_add
welcome:    → rules, test
verify:     → click (vergibt Member-Rolle)
autosetup:  → full, missing
suggest:    → upvote, downvote (Live-Counter)
clear:      → confirm, cancel (via awaitMessageComponent)
confirm:    → generisch
```

### 2. `messageCreate` (100 Zeilen)
- 🛡️ Echtzeit-AutoMod (Token-Scan, Phishing, API-Keys)
- 📈 XP-Vergabe mit 60s Cooldown
- 🔔 Level-Up Benachrichtigung
- ⚡ Spam-Velocity-Check (Zero-Trust)
- 📊 Stats-Inkrementierung (`messagesToday`)

### 3. `guildCreate` (58 Zeilen)
- 🗄️ Server in globaler DB registrieren
- 🔧 Auto-Setup automatisch ausführen
- 📋 Ergebnis-Embed im General-Kanal senden
- 📩 Owner per DM informieren
- 🎭 Nexus-Team-Rolle erstellen & syncen

### 4. `guildMemberAdd` (131 Zeilen)
- 🚨 Anti-Raid Velocity-Check
- 🔰 Konto-Alter prüfen (< 7 Tage = Warnung)
- 👋 Welcome-Embed mit Buttons (KI-generiert)
- 🎭 Member-Rolle automatisch vergeben
- 📊 Global-Log eintragen

### 5. `guildMemberRemove` (71 Zeilen)
- 📋 Leave-Embed im Log-Kanal
- ⏱️ Zeit auf dem Server berechnen
- 🎭 Ehemalige Rollen anzeigen
- 📊 Global-Log eintragen

---

## 🎫 KI-Ticket-System (6 Typen)

Jeder Typ hat ein eigenes Discord-Modal mit spezifischen Feldern:

| Typ | Emoji | KI-Funktion | Felder |
|-----|-------|-------------|--------|
| **Bewerbung** | 📋 | Bewertet mit Score 0–10, Quality-Gate < 4 = Ablehnung | Discord-Name, Alter & Erfahrung, Gewünschte Rolle + Warum, Warum sollten wir dich nehmen, Aktivität |
| **Support** | 🛠️ | Priorisiert, schlägt Lösungen vor, erkennt Duplikate | Name, Kategorie, Problem, Bereits versucht, Screenshot |
| **Feedback** | 💡 | Kategorisiert automatisch | Bereich, Bewertung, Feedback, Verbesserung |
| **Bug Report** | 🐞 | Analysiert Schweregrad | Titel, Beschreibung, Schritte, Umgebung, Screenshot |
| **Partnerschaft** | 🤝 | Prüft Serv.-Größe | Server-Name, Mitglieder & Thema, Angebot, Invite-Link |
| **Sonstiges** | ❓ | Allgemein | Betreff, Nachricht, Kontakt |

**KI-Bewerbungsanalyse:**
```
📝 Grammatik:       ████████░░ 8/10
🎯 Ernsthaftigkeit: ██████░░░░ 6/10
📋 Vollständigkeit: █████████░ 9/10
💼 Erfahrung:       ████░░░░░░ 4/10
⭐ Gesamtnote:      ███████░░░ 7/10

Empfehlung: ✅ ACCEPT / 🤔 CONSIDER / ❌ REJECT
```

**Rate-Limiting:** 1 Ticket pro Typ pro User pro 24h (Redis-backed)

---

## 🤖 KI-System

### 14 Provider

| Provider | Modelle | Kosten/1k | Priorität |
|----------|---------|-----------|-----------|
| OpenAI | gpt-4o, gpt-4o-mini, o1-mini | $0.005 | 1 |
| Anthropic Claude | claude-3-5-sonnet, haiku | $0.003 | 2 |
| Google Gemini | gemini-1.5-pro, flash | $0.00125 | 3 |
| Groq LPU | llama-3.3-70b (schnellster) | $0.00059 | 4 |
| Mistral AI | mistral-large, small | $0.002 | 5 |
| DeepSeek | deepseek-chat, reasoner | $0.00014 | 6 |
| xAI Grok | grok-beta, grok-2 | $0.005 | 7 |
| Cohere | command-r-plus | $0.003 | 8 |
| Perplexity | sonar-large-128k-online | $0.001 | 9 |
| Together AI | Meta-Llama-3.1-405B | $0.0008 | 10 |
| OpenRouter | Universell (50+ Modelle) | $0.003 | 11 |
| Azure OpenAI | gpt-4o enterprise | $0.005 | 12 |
| Ollama Local | llama3.3, qwen2.5 (kostenlos) | $0 | 99 |
| Nexus Mock | nexus-mock-v4 (Fallback) | $0 | 999 |

### 20 KI-Module

```
HYBRID_AUTOMOD            — Echtzeit Nachrichten-Analyse
RAG_TICKET_HELPDESK       — Ticket-Assistent mit Kontext
AI_SERVER_BUILDER         — Server-Strukturen generieren
AI_TICKET_SYSTEM          — Ticket-Klassifizierung & Priorität
AI_DISCORD_DESIGNER       — Design-Konzepte erstellen
AI_SECURITY_ADVISOR       — Sicherheitsempfehlungen
AI_COMMUNITY_MANAGER      — Engagement & Churn-Analyse
AI_ANALYTICS              — Statistik-Auswertung
AI_SERVER_HEALTH          — Server-Gesundheits-Check
AI_PERFORMANCE_OPTIMIZER  — Performance-Empfehlungen
AI_PLUGIN_GENERATOR       — Plugin-Code generieren
AI_COMMAND_GENERATOR      — Command-Code generieren
AI_EMBED_BUILDER          — Embed-Design
AI_ROLE_DESIGNER          — Rollen-Struktur
AI_PERMISSION_INSPECTOR   — Berechtigungs-Analyse
AI_CHANNEL_BUILDER        — Kanal-Struktur
AI_EVENT_PLANNER          — Event-Planung
AI_BUG_DETECTOR           — Code-Fehler erkennen
AI_CODE_ASSISTANT         — Code-Hilfe
AI_APPLICATION_REVIEWER   — Bewerbungs-Bewertung
```

### KI-Features
- **Konversations-Kontext**: Merkt sich die letzten 20 Nachrichten pro User (Redis, 1h TTL)
- **Response-Cache**: 60s Cache für identische Anfragen (SHA-256 Hash)
- **Request-Deduplication**: Verhindert doppelte In-flight-Requests (UUID)
- **Prompt-Injection-Guard**: 6 Erkennungsmuster
- **Cost-Tracking**: Kosten pro Guild in USD
- **Auto-Fallback**: Nächster Provider wenn aktueller nicht verfügbar
- **BYO-Key**: Jede Guild kann eigenen API-Key hinterlegen

---

## 🛡️ Security-System (Zero-Trust)

### Velocity-Detection (< 5ms)

| Aktion | Schwellwert | Bedrohung |
|--------|------------|-----------|
| `CHANNEL_DELETE` | 3 in 5s | NUKE_VELOCITY |
| `ROLE_DELETE` | 3 in 5s | NUKE_VELOCITY |
| `BAN_ADD` | 5 in 5s | NUKE_VELOCITY |
| `WEBHOOK_CREATE` | 2 in 5s | NUKE_VELOCITY |
| `MEMBER_JOIN` | 15 in 5s | RAID_SWARM |
| `MESSAGE_CREATE` | 25 in 5s | SPAM_WAVE |
| `INVITE_CREATE` | 8 in 5s | INVITE_SPAM |
| `DM_SEND` | 10 in 5s | MASS_DM |
| `EMOJI_DELETE` | 5 in 5s | NUKE_VELOCITY |

### Nachrichten-Scanner (Echtzeit)
- 🔑 Discord-Tokens erkennen & löschen
- 🔑 OpenAI / Anthropic / Google API-Keys
- 🔑 GitHub Tokens (ghp_)
- 🔗 22+ bekannte Phishing-Domains
- ➕ Laufzeit-erweiterbar (`addPhishingDomain()`)

### Quarantäne-System
- Redis-backed (Cross-Instance-Sync)
- 1-Stunde TTL
- Manuell aufhebbar (`releaseQuarantine()`)

### DEFCON-Persistenz
- In Redis gespeichert (7 Tage TTL)
- Überlbt Bot-Neustarts
- Event-Bus-Benachrichtigung bei Änderung

### Nexus-Team Rollen-Schutz
- Erkennt unauthorisierte Zuweisung der `✨ Nexus Team`-Rolle
- Entzieht Rolle innerhalb von 120ms
- Identifiziert verantwortlichen Moderator via Audit-Log
- Global-Log-Eintrag

---

## 🔧 Auto-Setup System

### Kanal-Erkennung
Das System erkennt über **150+ Kanal-Namen-Muster** automatisch:

| Zweck | Beispiel-Namen |
|-------|---------------|
| 📋 Regeln | `rules`, `regeln`, `server-rules`, `📋rules`, `guidelines`, `verhaltensregeln`, … |
| 👋 Welcome | `welcome`, `willkommen`, `👋welcome`, `new-members`, `join-logs`, … |
| 📊 Logs | `logs`, `audit-log`, `mod-log`, `modlogs`, `📋logs`, `server-log`, … |
| 📢 Ankündigungen | `announcements`, `news`, `updates`, `📢announcements`, `neuigkeiten`, … |
| ✅ Verifizierung | `verify`, `verification`, `captcha`, `✅verify`, `bestätigung`, … |
| 💡 Vorschläge | `suggestions`, `ideen`, `feedback`, `feature-request`, … |
| 👥 Staff | `staff`, `team`, `mod-only`, `intern`, `backstage`, … |
| 💬 General | `general`, `allgemein`, `chat`, `lobby`, `lounge`, … |
| 🛡️ Mod-Log | `mod-log`, `modlogs`, `punishment-log`, `ban-logs`, … |

### Was Auto-Setup macht
1. 🔍 Alle Kanäle scannen & Zweck erkennen
2. 🎭 Standard-Rollen erstellen (falls fehlend)
3. 📋 KI-Regeln generieren & anpinnen
4. 👋 Welcome-Embed mit Buttons senden
5. 📊 Log-Kanal aktivieren (oder erstellen)
6. ✅ Verifizierungs-Button setzen & anpinnen
7. 📢 Ankündigungs-Kanal konfigurieren
8. 💡 Vorschlags-System mit Info-Embed
9. ⚙️ Konfiguration in Redis speichern (7 Tage)
10. 📩 Ergebnis-Embed an Owner senden

---

## 🌐 Globale Admin-Systeme

### Nexus-Team Ränge

| Rang | Emoji | Level | Beschreibung |
|------|-------|-------|-------------|
| OWNER | 👑 | 100 | Vollständiger Zugriff (`*`) |
| CO_OWNER | 💎 | 95 | Fast alles außer System-Shutdown |
| MANAGER | 🛡 | 80 | Moderation & Team-Verwaltung |
| DEVELOPER | ⚙️ | 75 | Deploy, Logs, API, Plugins |
| AI_MANAGER | 🤖 | 70 | KI-Konfiguration & Training |
| MODERATOR | 🛡️ | 60 | Moderation & Tickets |
| SUPPORT | 🎫 | 50 | Tickets & User-Lookup |
| TEAM | 👥 | 10 | Basis-Zugriff |

### Global Logger — Event-Routing

Events werden automatisch in die richtigen Kanäle des Nexus Control Servers geleitet:

```
BAN        → #ban-logs
KICK       → #kick-logs
WARN       → #warn-logs
TIMEOUT    → #timeout-logs
MEMBER_JOIN → #join-logs
RAID_DETECTED → #raid-detection
SCAM_DETECTED → #scam-detection
TOKEN_LEAK → #token-alerts
AI_ACTION  → #ai-logs
TICKET_OPEN → #ticket-logs
COMMAND_EXECUTED → #command-logs
SECURITY_ALERT → #security-logs
… (30+ Event-Typen)
```

---

## 📦 Technischer Stack

```
Runtime:     Node.js ≥ 20 (ESM, nativer TypeScript-Support via tsx)
Language:    TypeScript 5.6 (strict mode, noImplicitAny)
Discord:     discord.js v14.16 (Gateway v10, Interactions API)
Datenbank:   PostgreSQL + Prisma ORM (optional, Memory-Fallback)
Cache:       Redis 5 (Sliding-Window RL, Pub/Sub, LRU-Fallback)
KI:          14 Provider (OpenAI SDK, Anthropic SDK, REST APIs)
Event-Bus:   Apache Kafka / Redpanda (Memory-Fallback)
Logger:      Pino v9 (JSON Produktion, Pretty Dev)
Security:    Zero-Trust, HMAC-SHA256, AsyncLocalStorage Tracing
```

---

## 🔄 Boot-Sequenz

```
boot()
  │
  ├── 1. DISCORD_TOKEN prüfen
  │         └── Fehlt → Warnung, nur API-Modus
  │
  ├── 2. Redis verbinden
  │         └── Fehlt → LRU Memory-Fallback (dev-mode)
  │
  ├── 3. Event-Bus verbinden (Kafka)
  │         └── Fehlt → In-Memory EventEmitter
  │
  ├── 4. AI Engine initialisieren
  │         └── Scannt alle konfigurierten Provider-Keys
  │
  ├── 5. client.login(token) → Discord Gateway
  │
  └── 6. client.once('ready')
            ├── initializeGlobalSystems() → Control Center + Logger
            ├── roleProtectionService.attach() → Rollen-Schutz
            ├── registerSlashCommands() → 22 Commands bei Discord
            └── Presence setzen → "X Server • /help"
```

---

## ⚡ Graceful Shutdown

```
SIGTERM / SIGINT
    │
    ├── client.destroy()     → Discord-Verbindung sauber trennen
    ├── eventBus.shutdown()  → Kafka/EventEmitter bereinigen
    └── process.exit(0)      → Sauberer Exit-Code
```

---

## 📊 Vollständige Feature-Übersicht

| Feature | Status | Details |
|---------|--------|---------|
| 22 Slash-Commands | ✅ | Alle registriert & funktionsfähig |
| 5 Event-Handler | ✅ | Alle registriert |
| 6 Ticket-Typen | ✅ | Mit KI-Analyse |
| 20 KI-Module | ✅ | Via `/ai module:` wählbar |
| 14 KI-Provider | ✅ | Auto-Fallback Chain |
| Zero-Trust Security | ✅ | < 5ms Velocity-Detection |
| DEFCON-System | ✅ | Redis-persistent |
| Auto-Setup | ✅ | 150+ Kanal-Muster |
| Server Builder | ✅ | Preview → Lösch-Abfrage → Build |
| Leveling/XP | ✅ | 15 XP/Msg, 60s Cooldown |
| Welcome-System | ✅ | KI-generiert + Member-Rolle |
| Verifizierung | ✅ | Button → Rolle automatisch |
| Suggest-System | ✅ | Voting mit Live-Counter |
| Global Bans | ✅ | Cross-Server, Redis-cached |
| Nexus-Team System | ✅ | 8 Ränge, DB + Memory |
| Rollen-Schutz | ✅ | < 120ms Revoke |
| Graceful Shutdown | ✅ | SIGTERM/SIGINT |
| Error-Recovery | ✅ | Kein Crash bei Command-Fehler |
| Stats-Tracking | ✅ | Bans, Warns, Tickets, AI, Msgs |
| Request-Tracing | ✅ | UUID pro Interaction |
| Secret-Sanitizer | ✅ | Logs zeigen keine API-Keys |
| KI-Kontext-Memory | ✅ | 20 Nachrichten, 1h TTL |
| Response-Cache | ✅ | 60s TTL, SHA-256 Hash |
| Prompt-Injection-Guard | ✅ | 6 Erkennungsmuster |
| Cost-Tracking | ✅ | USD pro Guild |
| BYO-Key | ✅ | Eigener API-Key pro Guild |
| Pub/Sub Invalidation | ✅ | Multi-Instance Cache-Sync |

---

*Nexus AI Omega v5.1.0 — Info-Bericht*
*Generiert: 2026-07-12 — 54 Dateien — 9.117 Codezeilen*
