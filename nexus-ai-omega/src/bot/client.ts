/**
 * ██████████████████████████████████████████████████████████████
 * █                                                            █
 * █   Nexus AI Omega — Discord Bot Client v5.2                █
 * █   ─────────────────────────────────────────               █
 * █   • 75 Slash Commands  •  6 Event-Handler                 █
 * █   • Auto-Setup  •  Tickets  •  Zero-Trust                 █
 * █   • Musik (YouTube/Spotify)  •  Economy  •  Leveling      █
 * █   • Support-Voice (TTS + Musik)  •  KI (Groq/Gemini)     █
 * █                                                            █
 * ██████████████████████████████████████████████████████████████
 */

import 'dotenv/config';
import {
  Client, GatewayIntentBits, Partials,
  REST, Routes, ActivityType,
} from 'discord.js';

// ── Core Services ──────────────────────────────────────────────────────────────
import { botLogger, logger } from '../services/logger.js';
import { aiEngine }          from '../ai-center/aiEngine.js';
import { connectRedis }      from '../services/redisCache.js';
import { eventBus }          from '../event-bus/kafkaClient.js';

// ── Global Systems ─────────────────────────────────────────────────────────────
import { initializeGlobalSystems }  from '../global/index.js';
import { roleProtectionService }    from '../global/team/roleProtectionService.js';

// ── Command Registry ───────────────────────────────────────────────────────────
import { registerCommand, getAllCommands } from './events/interactionCreate.js';

// ── Musik-Engine Shutdown ──────────────────────────────────────────────────────
// destroyAllQueues — called on shutdown (graceful queue cleanup)

// ── Support-System Init ────────────────────────────────────────────────────────
import { supportCommands, initSupportTables } from './commands/support/supportSetup.js';

// ════════════════════════════════════════════════════════════════════════════════
// COMMANDS IMPORTIEREN
// ════════════════════════════════════════════════════════════════════════════════

// 🔧 Utility (5)
import pingCmd        from './commands/utility/ping.js';
import helpCmd        from './commands/utility/help.js';
import aiCmd          from './commands/utility/ai.js';
import serverbuildCmd from './commands/utility/serverbuild.js';
import suggestCmd     from './commands/utility/suggest.js';
import serverbuilderCmd from './commands/builder/serverbuilder.js';  // NEW v2.0

// ℹ️ Info (4)
import userinfoCmd   from './commands/info/userinfo.js';
import serverinfoCmd from './commands/info/serverinfo.js';
import roleinfoCmd   from './commands/info/roleinfo.js';
import avatarCmd     from './commands/info/avatar.js';

// 🛡️ Moderation (6)
import banCmd     from './commands/moderation/ban.js';
import kickCmd    from './commands/moderation/kick.js';
import timeoutCmd from './commands/moderation/timeout.js';
import purgeCmd   from './commands/moderation/purge.js';
import warnCmd    from './commands/moderation/warn.js';
import defconCmd  from './commands/moderation/defcon.js';

// 📈 Leveling (1)
import levelCmd from './commands/levels/level.js';

// ⚙️ Setup (5)
import setupCmd      from './commands/setup/setup.js';
import autosetupCmd  from './commands/setup/autosetup.js';
import setwelcomeCmd from './commands/setup/setwelcome.js';
import setrulesCmd   from './commands/setup/setrules.js';
import setlogsCmd    from './commands/setup/setlogs.js';

// 🔑 Team / Admin (1)
import clearCmd from './commands/team/clear.js';

// 👥 Team Commands (1)
import { teamCommand } from './commands/team/teamCommands.js';

// 🌐 Global Admin (4)
import {
  globalbanuserCommand,
  globalunbanuserCommand,
  globaluserinfoCommand,
  globalblacklistCommand,
} from './commands/global/globalban.js';

// 🎫 Ticket-System (7)
import ticketSetupCmd from './commands/tickets/ticketSetup.js';
import {
  closeCmd, addCmd, removeCmd,
  claimCmd, unclaimCmd, transcriptCmd,
} from './commands/tickets/ticketCommands.js';

// 📋 Bewerbungs-System (1)
import { bewerbungSetupCmd } from './commands/applications/bewerbungSetup.js';

// 💰 Economy (9)
import { economyCommands } from './commands/economy/economyCommands.js';

// 🎮 Fun & Utility (13)
import { funCommands } from './commands/fun/funCommands.js';

// 🎵 Musik-System (13)
import { musicCommands } from './commands/music/musicCommands.js';

// ════════════════════════════════════════════════════════════════════════════════
// EVENTS IMPORTIEREN
// ════════════════════════════════════════════════════════════════════════════════

import interactionCreateEvent  from './events/interactionCreate.js';
import messageCreateEvent      from './events/messageCreate.js';
import guildCreateEvent        from './events/guildCreate.js';
import guildMemberAddEvent     from './events/guildMemberAdd.js';
import guildMemberRemoveEvent  from './events/guildMemberRemove.js';
import voiceStateUpdateEvent   from './events/voiceStateUpdate.js';

// ════════════════════════════════════════════════════════════════════════════════
// COMMANDS REGISTRIEREN (75 total)
// ════════════════════════════════════════════════════════════════════════════════

[
  // 🔧 Utility (5)
  pingCmd, helpCmd, aiCmd, serverbuildCmd, serverbuilderCmd, suggestCmd,

  // ℹ️ Info (4)
  userinfoCmd, serverinfoCmd, roleinfoCmd, avatarCmd,

  // 🛡️ Moderation (6)
  banCmd, kickCmd, timeoutCmd, purgeCmd, warnCmd, defconCmd,

  // 📈 Leveling (1)
  levelCmd,

  // ⚙️ Setup (5)
  setupCmd, autosetupCmd, setwelcomeCmd, setrulesCmd, setlogsCmd,

  // 🔑 Admin (1)
  clearCmd,

  // 👥 Team (1)
  teamCommand,

  // 🌐 Global Admin (4)
  globalbanuserCommand,
  globalunbanuserCommand,
  globaluserinfoCommand,
  globalblacklistCommand,

  // 🎫 Ticket-System (7)
  ticketSetupCmd,
  closeCmd, addCmd, removeCmd,
  claimCmd, unclaimCmd, transcriptCmd,

  // 📋 Bewerbungs-System (1)
  bewerbungSetupCmd,

  // 💰 Economy (9)
  ...economyCommands,

  // 🎮 Fun & Utility (13)
  ...funCommands,

  // 🎵 Musik (13)
  ...musicCommands,

  // 🎤 Support-Voice (6)
  ...supportCommands,

].forEach(cmd => registerCommand(cmd));

// ════════════════════════════════════════════════════════════════════════════════
// DISCORD CLIENT
// ════════════════════════════════════════════════════════════════════════════════

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.User,
    Partials.Reaction,
  ],
  shards:          'auto',
  failIfNotExists: false,
  presence: {
    activities: [{ name: '/help • Nexus AI Omega', type: ActivityType.Watching }],
    status: 'online',
  },
});

// ════════════════════════════════════════════════════════════════════════════════
// EVENTS REGISTRIEREN
// ════════════════════════════════════════════════════════════════════════════════

client.on(interactionCreateEvent.name,  (...args: unknown[]) => interactionCreateEvent.execute(args[0]));
client.on(messageCreateEvent.name,      (...args: unknown[]) => messageCreateEvent.execute(args[0]));
client.on(guildCreateEvent.name,        (...args: unknown[]) => guildCreateEvent.execute(args[0]));
client.on(guildMemberAddEvent.name,     (...args: unknown[]) => guildMemberAddEvent.execute(args[0]));
client.on(guildMemberRemoveEvent.name,  (...args: unknown[]) => guildMemberRemoveEvent.execute(args[0]));
client.on(voiceStateUpdateEvent.name,   (...args: unknown[]) => voiceStateUpdateEvent.execute(args[0], args[1]));

// ════════════════════════════════════════════════════════════════════════════════
// READY EVENT
// ════════════════════════════════════════════════════════════════════════════════

client.once('ready', async readyClient => {
  logger.info(`✅ Eingeloggt als ${readyClient.user.tag} | ${readyClient.guilds.cache.size} Server`);

  // 1. Globale Systeme initialisieren
  await initializeGlobalSystems(readyClient);

  // 2. Nexus-Team Rollen-Schutz
  roleProtectionService.attach(readyClient);

  // 2b. Nexus Team Rolle auf allen Servern synchronisieren
  setTimeout(async () => {
    try {
      const { roleSyncService } = await import('../global/team/roleSyncService.js');
      const guildsMap = new Map(readyClient.guilds.cache.entries());
      await roleSyncService.syncAllGuilds(guildsMap as unknown as Map<string, import('discord.js').Guild>);
      botLogger.info({ guilds: guildsMap.size }, '✅ Nexus Team Rolle auf allen Servern synchronisiert');
    } catch (err) {
      botLogger.warn({ err }, '⚠️ Nexus Team Role Sync fehlgeschlagen');
    }
  }, 5000); // 5s nach Ready (Rate-Limit freundlich)

  // 3. SQLite Datenbank
  await import('../services/database.js')
    .then(m => m.getDB())
    .catch(err => botLogger.warn({ err: (err as Error).message }, '⚠️ SQLite Fallback'));

  // 4. Support Tabellen
  await initSupportTables().catch(() => {});

  // 5. Erinnerungs-Checker
  const { dbAll, dbRun } = await import('../services/database.js');
  setInterval(async () => {
    try {
      const due = await dbAll('SELECT * FROM reminders WHERE remind_at <= ? AND sent = 0', Date.now());
      for (const r of due) {
        const ch = readyClient.channels.cache.get(String(r['channel_id']));
        if (ch && 'send' in ch) {
          await (ch as import('discord.js').TextChannel)
            .send({ content: `⏰ <@${r['user_id']}> **Erinnerung:** ${r['message']}` })
            .catch(() => {});
        }
        await dbRun('UPDATE reminders SET sent = 1 WHERE id = ?', r['id']);
      }
    } catch { /* ignore */ }
  }, 10_000);

  // 6. Commands IMMER global registrieren (alle Server sofort!)
  await registerSlashCommands(readyClient.user.id);

  // 7. Presence mit Serverzahl
  readyClient.user.setPresence({
    activities: [{
      name: `${readyClient.guilds.cache.size} Server • /help`,
      type: ActivityType.Watching,
    }],
    status: 'online',
  });

  botLogger.info({
    tag:      readyClient.user.tag,
    guilds:   readyClient.guilds.cache.size,
    commands: getAllCommands().length,
  }, `🌐 Nexus AI Omega v5.2 online — ${getAllCommands().length} Commands registriert`);
});

// ════════════════════════════════════════════════════════════════════════════════
// FEHLERBEHANDLUNG
// ════════════════════════════════════════════════════════════════════════════════

client.on('error',          (err: Error)          => botLogger.error({ err }, '❌ Discord Client Fehler'));
client.on('warn',           (msg: string)         => botLogger.warn({ msg }, '⚠️ Warnung'));
client.on('shardError',     (err: Error, id: number) => botLogger.error({ err, id }, `❌ Shard ${id}`));
client.on('shardReady',     (id: number)          => botLogger.info({ id }, `✅ Shard ${id} bereit`));
client.on('shardDisconnect', (_e: unknown, id: number) => botLogger.warn({ id }, `⚠️ Shard ${id} getrennt`));
client.on('guildDelete',    (guild: unknown)       => {
  import('../global/serverRegistry.js')
    .then(m => m.serverRegistry.markLeft(guild.id))
    .catch(() => {});
});

// ════════════════════════════════════════════════════════════════════════════════
// COMMAND REGISTRIERUNG — IMMER GLOBAL (alle Server sofort)
// ════════════════════════════════════════════════════════════════════════════════

async function registerSlashCommands(clientId: string): Promise<void> {
  const token = process.env.DISCORD_TOKEN!;
  const rest  = new REST({ version: '10' }).setToken(token);

  const commandData = getAllCommands().map(cmd =>
    typeof cmd.data.toJSON === 'function' ? cmd.data.toJSON() : cmd.data,
  );

  botLogger.info({ count: commandData.length }, `📤 Registriere ${commandData.length} Commands…`);

  try {
    // ─── IMMER GLOBAL registrieren ────────────────────────────────────────────
    // Guild-Commands sind nur auf 1 Server sichtbar!
    // Global-Commands sind auf ALLEN Servern sofort nach Propagation (~1h) sichtbar.
    // Beim ersten Start ggf. 1 Stunde warten bis sie überall erscheinen.
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });

    botLogger.info(
      { count: commandData.length },
      `✅ ${commandData.length} Commands global registriert (erscheinen in ~1h auf allen Servern)`,
    );

    // ─── OPTIONAL: Sofortige Registrierung auf dem Nexus-Control-Server ──────
    // Für schnelles Testen: NEXUS_CONTROL_GUILD_ID in .env setzen
    const guildId = process.env.NEXUS_CONTROL_GUILD_ID;
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
      botLogger.info(
        { count: commandData.length, guildId },
        `⚡ ${commandData.length} Commands sofort auf Nexus-Control-Server aktiv`,
      );
    }

  } catch (err) {
    botLogger.error({ err }, '❌ Command-Registrierung fehlgeschlagen');
    botLogger.error({}, '💡 Prüfe: DISCORD_TOKEN korrekt? Bot hat applications.commands Scope in OAuth2?');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════════════════════

async function boot(): Promise<void> {
  logger.info('🚀 Nexus AI Omega v5.2 startet…');

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    logger.error('❌ DISCORD_TOKEN fehlt! Füge ihn in .env ein.');
    logger.error('   https://discord.com/developers/applications → Bot → Token');
    return;
  }

  // Redis
  await connectRedis();
  logger.info('✅ Redis verbunden (oder Memory-Fallback)');

  // Event-Bus
  await eventBus.connect();
  logger.info('✅ Event-Bus verbunden');

  // KI-Engine (Groq + Gemini automatisch erkannt)
  await aiEngine.init();
  const activeProviders = aiEngine.listProviders()
    .filter(p => p.configured && p.id !== 'nexus-mock')
    .map(p => p.id);

  if (activeProviders.length === 0) {
    logger.warn('⚠️  Keine KI-Provider konfiguriert!');
    logger.warn('   Füge GROQ_API_KEY oder GEMINI_API_KEY in .env ein');
    logger.warn('   Groq kostenlos: https://console.groq.com/keys');
    logger.warn('   Gemini kostenlos: https://aistudio.google.com/apikey');
  } else {
    logger.info(`✅ KI aktiv: ${activeProviders.join(', ')}`);
  }

  // Discord Login
  await client.login(token);
}

// Fehler abfangen
process.on('uncaughtException',   err    => logger.fatal({ err }, '💀 Uncaught Exception'));
process.on('unhandledRejection',  reason => logger.error({ reason }, '❌ Unhandled Rejection'));

// Graceful Shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, '🛑 Shutdown…');
  client.destroy();
  await eventBus.shutdown().catch(() => {});
  logger.info('✅ Sauber beendet.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

boot().catch(err => {
  logger.fatal({ err }, '💀 Boot fehlgeschlagen');
  process.exit(1);
});

export default client;
