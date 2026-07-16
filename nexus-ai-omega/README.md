# 🌐 Nexus AI Omega v5

![Version](https://img.shields.io/badge/version-5.2.0-7c3aed?style=for-the-badge&logo=discord&logoColor=white)
![Node](https://img.shields.io/badge/node-%3E%3D20-06ffa5?style=for-the-badge&logo=node.js)
![Discord.js](https://img.shields.io/badge/discord.js-v14-5865f2?style=for-the-badge&logo=discord)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript)
![Commands](https://img.shields.io/badge/Commands-75-06ffa5?style=for-the-badge)
![AI](https://img.shields.io/badge/KI--Provider-14-a855f7?style=for-the-badge)

> **75 Commands · 14 KI-Provider (Groq⚡ & Gemini🟢 kostenlos) · Musik (YouTube/Spotify) · Zero-Trust Security · Support-Voice (TTS+Musik) · KI-Tickets · Bewerbungen · Economy · Leveling · Auto-Setup**

---

## ⚡ Quick Start — 3 Schritte

```bash
npm install
cp .env.example .env
# .env öffnen → DISCORD_TOKEN + DISCORD_CLIENT_ID + GROQ_API_KEY eintragen
npm run dev
```

### 🔑 Minimale .env (Bot + kostenlose KI)

```env
# Discord (PFLICHT)
DISCORD_TOKEN=dein-token-hier
DISCORD_CLIENT_ID=1523530214938771546

# KI — WÄHLE EINEN (beide kostenlos!):
# ⚡ Groq: https://console.groq.com/keys → kostenlos, sehr schnell
GROQ_API_KEY=gsk_...

# 🟢 Gemini: https://aistudio.google.com/apikey → kostenlos, 60 req/min
GEMINI_API_KEY=AIza...
```

### ⚠️ Commands werden nicht angezeigt? — Lösung:

```
1. Commands werden GLOBAL registriert → dauert bis zu 1 Stunde beim ersten Start
2. Für sofortige Anzeige auf einem Server:
   → NEXUS_CONTROL_GUILD_ID=deine-server-id in .env eintragen
   → Dann erscheinen Commands sofort auf diesem Server
3. Nach 1h sind sie auf ALLEN Servern verfügbar
4. Bot muss Scope "applications.commands" haben:
   → discord.com/developers → OAuth2 → Bot + applications.commands
```

---

## 📋 Alle 75 Commands

### 🔧 Utility (5)
| Command | Beschreibung |
|---------|-------------|
| `/ping` | Latenz · API · KI-Provider · RAM · Uptime |
| `/help` | 75 Commands in 13 Kategorien (Select-Menü) |
| `/ai` | Universal KI (14 Provider · 20 Module · Auto-Select) |
| `/serverbuild` | KI generiert kompletten Discord-Server |
| `/suggest` | Vorschlag mit 👍/👎 Voting & Thread |

### 🎵 Musik-System (13) — YouTube · Spotify · Suche
| Command | Beschreibung |
|---------|-------------|
| `/play song:...` | YouTube-URL, Spotify-Link oder Suchbegriff |
| `/skip anzahl:1` | Song(s) überspringen |
| `/stop` | Musik stoppen · Voice verlassen |
| `/pause` | Pausieren |
| `/resume` | Fortsetzen |
| `/queue seite:1` | Warteschlange (mit Seiten) |
| `/nowplaying` | Aktueller Song + Fortschrittsbalken |
| `/volume lautstärke:80` | Lautstärke 0–200% |
| `/loop modus:song` | Loop: keiner / song / warteschlange |
| `/shuffle` | Warteschlange mischen |
| `/remove position:2` | Song entfernen |
| `/clearqueue` | Alles leeren |
| `/lyrics song:...` | Songtext via KI |

### ℹ️ Info (5)
`/userinfo` `/serverinfo` `/roleinfo` `/avatar` `/level`

### 🛡️ Moderation (11)
| Command | Berechtigung |
|---------|-------------|
| `/ban` | BanMembers |
| `/kick` | KickMembers |
| `/timeout` | ModerateMembers |
| `/purge` | ManageMessages |
| `/warn` (+Auto-Eskalation: 3→Timeout, 5→Ban) | ModerateMembers |
| `/defcon level:1-5` | ManageGuild |
| `/warnings` | ModerateMembers |
| `/clearwarnings` | Administrator |
| `/lock` / `/unlock` | ManageChannels |
| `/slowmode` | ManageChannels |

### 📈 Leveling (4)
`/level` `/rank` `/leaderboard` `/levelrole` `/setxp`

### ⚙️ Setup & Config (6)
| Command | Funktion |
|---------|---------|
| `/setup` | Vollständiges Auto-Setup (150+ Kanal-Muster) |
| `/autosetup` | 11 Einzelaktionen (Rules, Welcome, Logs, Verify…) |
| `/setwelcome` | Welcome-Kanal + KI-Nachricht |
| `/setrules` | Regeln-Kanal + KI generiert Regeln |
| `/setlogs` | Log-Kanal + Event-Filter |
| `/verify-setup` | Verifizierungs-Button |

### 🎫 Ticket-System (7)
`/ticket-setup` `/close` `/claim` `/unclaim` `/add` `/remove` `/transcript`

### 📋 Bewerbungs-System (1)
`/bewerbung-setup` — 6 Positionen, KI-Score, Accept/Ablehnen, DM

### 🎤 Support-Warteraum (6)
`/support-setup` `/support-musik` `/support-nachricht` `/support-info` `/support-test` `/support-leave`

### 💰 Economy (9)
`/balance` `/daily` `/work` `/pay` `/shop` `/buy` `/sell` `/inventory` `/additem`

### 🎮 Fun & Utility (13)
`/rank` `/leaderboard` `/setxp` `/levelrole` `/warnings` `/clearwarnings`
`/lock` `/unlock` `/slowmode` `/poll` `/giveaway` `/remind` `/cmd`

### 🔑 Admin & Team (7)
| Command | Zugriff |
|---------|---------|
| `/clear` | Server-Owner ODER Nexus-Team |
| `/team` | Nexus-Team |
| `/globalbanuser` | Nexus-Team |
| `/globalunbanuser` | Nexus-Team |
| `/globaluserinfo` | Nexus-Team |
| `/globalblacklist` | Nexus-Team |

---

## 🤖 KI-System — Groq & Gemini kostenlos nutzen

### Priorität (wer zuerst benutzt wird):
```
1. 🥇 Groq     — KOSTENLOS · Schnellster (llama-3.3-70b) · GROQ_API_KEY
2. 🥈 Gemini   — KOSTENLOS · 60 req/min · GEMINI_API_KEY / GOOGLE_API_KEY
3. 🥉 OpenAI   — Kostenpflichtig · OPENAI_API_KEY
4.    Claude   — Kostenpflichtig · ANTHROPIC_API_KEY
...
```

### Keys bekommen:
```bash
# Groq (schnellster, kostenlos):
# → https://console.groq.com/keys → New API Key

# Gemini (Google, kostenlos):
# → https://aistudio.google.com/apikey → Create API Key
```

### In .env eintragen:
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
# ODER
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxx
```

### Testen ob KI funktioniert:
```
/ping → Zeigt aktiven KI-Provider
/ai prompt:Hallo Welt → KI antwortet
```

---

## 🎵 Musik-System

### Unterstützte Quellen:
- 🔴 **YouTube** — URL oder Suche
- 🟢 **Spotify** — Song-Links werden zu YouTube umgewandelt
- 📋 **YouTube Playlists** — bis 50 Songs

### Einrichtung:
```bash
npm install play-dl  # Falls noch nicht installiert
```

### Optional für bessere Performance:
```env
# YouTube Cookie (verhindert 429-Fehler bei viel Nutzung)
YOUTUBE_COOKIE=dein-cookie-hier
```

### Beispiele:
```
/play song:Bohemian Rhapsody Queen          ← Suche
/play song:https://youtu.be/xxxxx           ← YouTube-URL
/play song:https://open.spotify.com/track/x ← Spotify → YouTube
```

---

## 🗄️ Datenbank (SQLite — automatisch erstellt)
`guild_settings` `levels` `xp_cooldowns` `warnings` `economy` `inventory`
`shop_items` `tickets` `applications` `support_sessions` `support_settings`
`custom_commands` `reminders` `giveaways` `automod` `ai_history`

---

## 🚀 Deployment

### Lokal (Entwicklung):
```bash
npm run dev    # Hot-Reload, Commands sofort auf Nexus-Control-Server
```

### Produktion:
```bash
npm run build && npm start
```

### Docker:
```bash
docker-compose up -d
```

### Railway.app (kostenlos hosten):
```bash
# railway.json bereits vorhanden → Railway verbinden → Deploy
```

---

## 📞 Support & Links

| | Link |
|--|--|
| 💬 Discord | https://discord.gg/kzaMp69dD |
| 🤖 Bot einladen | https://discord.com/oauth2/authorize?client_id=1523530214938771546&permissions=8&scope=bot+applications.commands |
| 📋 Groq (kostenlos) | https://console.groq.com/keys |
| 🟢 Gemini (kostenlos) | https://aistudio.google.com/apikey |

---

*Nexus AI Omega v5.2.0 · 80 TypeScript-Dateien · 75 Commands · Groq & Gemini als Standard-KI* 🌐
