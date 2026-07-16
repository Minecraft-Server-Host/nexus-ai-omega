/**
 * Nexus AI Omega — Auto Setup System v5.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Wird automatisch ausgeführt wenn:
 *   → Bot einem neuen Server beitritt (GuildCreate)
 *   → /setup aufgerufen wird
 *   → /autosetup aufgerufen wird
 *
 * Erkennt automatisch:
 *   • Rules-Kanal   → setzt AI-generierte Regeln
 *   • Welcome-Kanal → setzt AI-generierte Willkommensnachricht
 *   • Log-Kanal     → setzt als Logging-Kanal
 *   • General-Kanal → sendet Setup-Bestätigung
 *   • Mod-Kanal     → setzt als Mod-Log
 *   • Announce-Kanal → setzt als Ankündigungskanal
 *   • Verification  → setzt Verifizierungssystem
 *
 * Erstellt automatisch (falls nicht vorhanden):
 *   • Mod-Rolle, Member-Rolle, Mute-Rolle
 *   • Ticket-Kategorie
 *   • Log-Kanal
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  type Guild,
  type TextChannel,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Role,
} from 'discord.js';
import { botLogger } from '../../services/logger.js';
import { aiEngine } from '../../ai-center/aiEngine.js';
import { cacheSet, cacheGet } from '../../services/redisCache.js';
import { NexusColors } from '../../utils/embeds.js';

// ── Kanal-Suchmuster (lowercase) ──────────────────────────────────────────────
const CHANNEL_PATTERNS = {
  rules: [
    'rules', 'regel', 'regeln', 'rule', 'server-rules', 'server-regeln',
    'rules-and-info', 'rules-info', '📋rules', '📜rules', '📋-rules',
    '📜-rules', 'rules📋', 'regeln📜', 'rules-and-guidelines',
    'tos', 'terms', 'guidelines', 'conduct', 'verhaltensregeln',
    'serverregeln', 'server_rules', 'the-rules', 'lesen', 'read-me',
    'lese-mich', '👁rules', 'rule-book', 'reglamento', 'nutzungsbedingungen',
  ],
  welcome: [
    'welcome', 'willkommen', 'bienvenido', 'bienvenidos', 'welcome-back',
    'welcome-channel', 'willkommen-kanal', '👋welcome', '🎉welcome',
    'join', 'joins', 'beitritt', 'neu', 'new-members', 'neue-mitglieder',
    'hello', 'greetings', 'grüße', 'arrivals', 'welcome-chat',
    'bienvenue', 'benvenuto', 'добро-пожаловать', 'server-welcome',
    'member-log', 'welcome-log', 'join-leave', 'join-logs',
  ],
  logs: [
    'logs', 'log', 'audit', 'audit-log', 'audit-logs', 'server-logs',
    'mod-log', 'mod-logs', 'modlog', 'modlogs', 'bot-log', 'bot-logs',
    'logging', 'logger', 'log-kanal', 'protokoll', 'protokolle',
    'action-log', 'event-log', 'events', 'lounge-log', 'history',
    '📋logs', '🔍logs', '📊logs', 'security-log', 'security-logs',
    'nexus-logs', 'server-log',
  ],
  general: [
    'general', 'allgemein', 'chat', 'main', 'lobby', 'lounge',
    'hauptkanal', 'general-chat', 'allgemein-chat', 'talk', 'discussion',
    '💬general', '🗣general', 'global', 'public', 'deutsch', 'english',
    'plaudern', 'small-talk', 'casual', 'off-topic', 'offtopic', 'random',
  ],
  announcements: [
    'announcements', 'announcement', 'ankündigungen', 'ankündigung',
    'news', 'updates', 'update', 'info', 'information', 'infos',
    '📢announcements', '📣announcements', 'server-news', 'neuigkeiten',
    'wichtig', 'important', 'notice', 'notices', 'official', 'broadcast',
    'release', 'releases', 'changelog', 'patch-notes',
  ],
  modlog: [
    'mod-log', 'mod-logs', 'modlog', 'modlogs', 'mod-actions',
    'moderations-log', 'moderations-logs', 'staff-log', 'staff-logs',
    'team-log', 'admin-log', 'admin-logs', 'punishment-log',
    'sanktionen', 'bans', 'ban-log', 'ban-logs', 'warn-log',
    'infractions', 'moderation', 'mod-channel', 'moderator-log',
  ],
  verify: [
    'verify', 'verification', 'verifizierung', 'verifizieren',
    'captcha', 'check', 'verified', 'gate', 'entry', 'eingang',
    'get-roles', 'role-request', 'verify-here', 'verify-channel',
    'auth', 'authenticate', 'bestätigung', '✅verify',
  ],
  suggestions: [
    'suggestions', 'suggestion', 'vorschläge', 'vorschlag', 'ideas',
    'ideen', 'feedback', 'feature-request', 'wünsche', 'wishlist',
    'improve', 'improvements', 'suggest', '💡suggestions',
  ],
  staff: [
    'staff', 'team', 'mod-only', 'staff-only', 'team-only', 'mod-chat',
    'staff-chat', 'team-chat', 'intern', 'private', 'backstage',
    'behind-scenes', 'staff-lounge', 'moderatoren', 'administration',
  ],
} as const;

export type ChannelPurpose = keyof typeof CHANNEL_PATTERNS;

// ── Ergebnis eines Auto-Setups ─────────────────────────────────────────────────
export interface AutoSetupResult {
  guildId: string;
  guildName: string;
  found: Partial<Record<ChannelPurpose, string>>;   // channelId
  created: string[];
  skipped: string[];
  errors: string[];
  rulesSet: boolean;
  welcomeSet: boolean;
  logsSet: boolean;
  rolesCreated: string[];
  durationMs: number;
}

// ── Kanal finden ───────────────────────────────────────────────────────────────
export function findChannel(guild: Guild, purpose: ChannelPurpose): TextChannel | null {
  const patterns = CHANNEL_PATTERNS[purpose] as readonly string[];

  // Zuerst exakte Übereinstimmung
  for (const pattern of patterns) {
    const ch = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText &&
           c.name.toLowerCase() === pattern.toLowerCase()
    ) as TextChannel | undefined;
    if (ch) return ch;
  }

  // Dann Teilübereinstimmung (enthält Muster)
  for (const pattern of patterns) {
    const ch = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText &&
           c.name.toLowerCase().includes(pattern.toLowerCase())
    ) as TextChannel | undefined;
    if (ch) return ch;
  }

  // Dann umgekehrt (Kanalname ist im Muster enthalten)
  const allText = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
  for (const [, ch] of allText) {
    const name = ch.name.toLowerCase();
    if (patterns.some(p => name.includes(p))) return ch as TextChannel;
  }

  return null;
}

// ── Alle relevanten Kanäle scannen ────────────────────────────────────────────
export function scanAllChannels(guild: Guild): Partial<Record<ChannelPurpose, TextChannel>> {
  const result: Partial<Record<ChannelPurpose, TextChannel>> = {};
  const purposes = Object.keys(CHANNEL_PATTERNS) as ChannelPurpose[];
  for (const purpose of purposes) {
    const ch = findChannel(guild, purpose);
    if (ch) result[purpose] = ch;
  }
  return result;
}

// ── KI-generierte Regeln ───────────────────────────────────────────────────────
async function generateRules(guild: Guild): Promise<string> {
  try {
    const result = await aiEngine.infer({
      module: 'AI_COMMUNITY_MANAGER',
      prompt: `Erstelle professionelle, freundliche Discord-Serverregeln für den Server "${guild.name}" mit ca. ${guild.memberCount} Mitgliedern.
Format:
📋 **Serverregeln — ${guild.name}**

**§1 — Respekt & Umgang**
[regel text]

**§2 — Inhalte & Medien**
[regel text]

**§3 — Spam & Werbung**
[regel text]

**§4 — Sprache & Kommunikation**
[regel text]

**§5 — Discord-Nutzungsbedingungen**
[regel text]

**§6 — Konsequenzen**
[regel text]

**§7 — Sonstiges**
[regel text]

Halte es professionell, klar und freundlich. Deutsch. Maximal 1800 Zeichen.`,
      guildId: guild.id,
      maxTokens: 800,
      temperature: 0.4,
    });
    return String(result.text).slice(0, 1900);
  } catch {
    return `📋 **Serverregeln — ${guild.name}**

**§1 — Respekt & Umgang**
› Behandle alle Mitglieder mit Respekt und Freundlichkeit.
› Beleidigungen, Mobbing und Diskriminierung sind verboten.

**§2 — Inhalte & Medien**
› Keine NSFW-Inhalte außerhalb entsprechend markierter Kanäle.
› Keine illegalen, beleidigenden oder schockierenden Inhalte.

**§3 — Spam & Werbung**
› Kein Spam, Flood oder übermäßiges Erwähnen (Ping).
› Keine unerwünschte Werbung oder Server-Einladungen.

**§4 — Sprache**
› Halte dich an die festgelegte Sprache des jeweiligen Kanals.
› Keine übermäßige Verwendung von Großbuchstaben.

**§5 — Discord-Nutzungsbedingungen**
› Es gelten die Discord ToS: discord.com/terms
› Nutzer müssen mindestens 13 Jahre alt sein.

**§6 — Konsequenzen**
› Regelverstöße führen zu Verwarnungen, Timeouts oder Bans.
› Das Team entscheidet je nach Schwere des Verstoßes.

*Durch den Verbleib auf diesem Server stimmst du diesen Regeln zu.*`;
  }
}

// ── KI-generierte Willkommensnachricht ─────────────────────────────────────────
async function generateWelcomeMessage(guild: Guild): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
  const memberCount = guild.memberCount;

  const embed = new EmbedBuilder()
    .setColor(NexusColors.primary)
    .setTitle(`👋 Willkommen auf ${guild.name}!`)
    .setDescription(
      `> Hey **{user}**! Schön, dass du hier bist! 🎉\n` +
      `> Du bist Mitglied **#${memberCount.toLocaleString('de-DE')}** auf diesem Server.\n\n` +
      `> 📋 Bitte lies unsere **Regeln** durch bevor du mitmachst!\n` +
      `> 🎫 Bei Fragen öffne ein **Ticket** — wir helfen gerne!\n` +
      `> 🤖 **Nexus AI** steht dir jederzeit mit \`/ai\` zur Verfügung.`
    )
    .addFields(
      { name: '📋 Erste Schritte', value: '› Lese die Regeln\n› Stell dich vor\n› Hab Spaß!', inline: true },
      { name: '🛡️ Benötigt Hilfe?', value: '› Öffne ein Ticket\n› Frag das Team\n› Nutze /help', inline: true },
      { name: '👥 Mitglieder', value: `\`${memberCount.toLocaleString('de-DE')}\` & wachsend`, inline: true },
    )
    .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
    .setImage(guild.bannerURL({ size: 1024 }) ?? null)
    .setFooter({ text: `${guild.name} • Powered by Nexus AI Omega v5` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('welcome:rules')
      .setLabel('📋 Regeln lesen')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket:open:sonstiges')
      .setLabel('🎫 Support-Ticket')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('🌐 Nexus AI')
      .setURL('https://discord.gg/nexus-ai')
      .setStyle(ButtonStyle.Link),
  );

  return { embed, components: [row] };
}

// ── Rollen erstellen falls nicht vorhanden ─────────────────────────────────────
async function ensureRoles(guild: Guild): Promise<{ created: string[]; map: Record<string, string> }> {
  const created: string[] = [];
  const map: Record<string, string> = {};

  const rolesToEnsure: Array<{
    names: string[];
    create: { name: string; color: number; hoist: boolean; mentionable: boolean; permissions: bigint };
    key: string;
  }> = [
    {
      key: 'member',
      names: ['member', 'mitglied', 'members', 'verified', 'verifiziert', 'user', 'nutzer'],
      create: {
        name: '👥 Member',
        color: 0x6b7280,
        hoist: false,
        mentionable: false,
        permissions: PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory | PermissionFlagsBits.ViewChannel | PermissionFlagsBits.AddReactions | PermissionFlagsBits.UseApplicationCommands,
      },
    },
    {
      key: 'muted',
      names: ['muted', 'mute', 'stumm', 'timeout', 'silenced'],
      create: {
        name: '🔇 Muted',
        color: 0x374151,
        hoist: false,
        mentionable: false,
        permissions: 0n,
      },
    },
    {
      key: 'moderator',
      names: ['moderator', 'mod', 'moderatoren', 'mods', 'staff', 'team'],
      create: {
        name: '🛡️ Moderator',
        color: 0x06ffa5,
        hoist: true,
        mentionable: true,
        permissions:
          PermissionFlagsBits.KickMembers | PermissionFlagsBits.BanMembers |
          PermissionFlagsBits.ManageMessages | PermissionFlagsBits.ModerateMembers |
          PermissionFlagsBits.ViewAuditLog | PermissionFlagsBits.ManageNicknames |
          PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory | PermissionFlagsBits.ViewChannel,
      },
    },
  ];

  for (const roleDef of rolesToEnsure) {
    // Suche nach bestehender Rolle
    const existing = guild.roles.cache.find(r =>
      roleDef.names.some(n => r.name.toLowerCase().includes(n))
    );

    if (existing) {
      map[roleDef.key] = existing.id;
      continue;
    }

    // Erstelle Rolle
    try {
      const role = await guild.roles.create({
        ...roleDef.create,
        reason: 'Nexus AI Omega v5 — Auto Setup',
      });
      map[roleDef.key] = role.id;
      created.push(`${roleDef.create.name}`);
      botLogger.info({ guildId: guild.id, role: roleDef.create.name }, 'Auto-created role');
    } catch (err) {
      botLogger.warn({ err, role: roleDef.create.name }, 'Could not create role');
    }
  }

  return { created, map };
}

// ── Haupt Auto-Setup Funktion ─────────────────────────────────────────────────
export async function runAutoSetup(guild: Guild, verbose = false): Promise<AutoSetupResult> {
  const start = performance.now();
  botLogger.info({ guildId: guild.id, guildName: guild.name }, '🔧 Auto-Setup gestartet');

  const result: AutoSetupResult = {
    guildId: guild.id,
    guildName: guild.name,
    found: {},
    created: [],
    skipped: [],
    errors: [],
    rulesSet: false,
    welcomeSet: false,
    logsSet: false,
    rolesCreated: [],
    durationMs: 0,
  };

  // 1. Alle relevanten Kanäle scannen
  const channels = scanAllChannels(guild);
  for (const [purpose, ch] of Object.entries(channels) as [ChannelPurpose, TextChannel][]) {
    result.found[purpose] = ch.id;
  }

  botLogger.info({ guildId: guild.id, found: Object.keys(channels) }, '🔍 Kanäle gefunden');

  // 2. Rollen sicherstellen
  const { created: rolesCreated, map: roleMap } = await ensureRoles(guild);
  result.rolesCreated = rolesCreated;

  // Cache: Konfiguration speichern
  const configCache = {
    guildId: guild.id,
    rulesChannelId: channels.rules?.id,
    welcomeChannelId: channels.welcome?.id,
    logChannelId: channels.logs?.id,
    modLogChannelId: channels.modlog?.id,
    announcementChannelId: channels.announcements?.id,
    generalChannelId: channels.general?.id,
    verifyChannelId: channels.verify?.id,
    suggestionChannelId: channels.suggestions?.id,
    memberRoleId: roleMap.member,
    mutedRoleId: roleMap.muted,
    modRoleId: roleMap.moderator,
    autoSetupAt: new Date().toISOString(),
  };

  await cacheSet(`nexus:v5:guild:${guild.id}:config`, configCache, 86_400 * 7);

  // 3. Regeln setzen
  if (channels.rules) {
    try {
      const rulesText = await generateRules(guild);
      const rulesEmbed = new EmbedBuilder()
        .setColor(NexusColors.info)
        .setTitle(`📋 Regeln — ${guild.name}`)
        .setDescription(rulesText)
        .setFooter({ text: `${guild.name} • Erstellt von Nexus AI Omega v5 • Zuletzt aktualisiert` })
        .setTimestamp();

      const pinMsg = await channels.rules.send({ embeds: [rulesEmbed] });
      await pinMsg.pin().catch(() => {});
      result.rulesSet = true;
      result.created.push(`📋 Regeln in #${channels.rules.name} gesetzt & angepinnt`);
    } catch (err) {
      result.errors.push(`Regeln konnten nicht gesetzt werden: ${(err as Error).message}`);
    }
  } else {
    result.skipped.push('Kein Rules-Kanal gefunden (erstelle einen mit dem Namen "rules" oder "regeln")');
  }

  // 4. Welcome-System setzen
  if (channels.welcome) {
    try {
      const { embed: welcomeEmbed, components } = await generateWelcomeMessage(guild);
      // Willkommens-Vorschau mit Platzhalter senden
      const previewEmbed = new EmbedBuilder()
        .setColor(NexusColors.success)
        .setTitle('✅ Willkommen-System aktiviert')
        .setDescription(
          `> **Nexus AI** begrüßt neue Mitglieder automatisch in diesem Kanal.\n\n` +
          `> **Vorschau** (so sieht die Willkommensnachricht aus):`
        )
        .setFooter({ text: 'Nexus AI Omega v5 • Welcome System' })
        .setTimestamp();

      await channels.welcome.send({ embeds: [previewEmbed] });
      await channels.welcome.send({ embeds: [welcomeEmbed], components });
      result.welcomeSet = true;
      result.created.push(`👋 Welcome-System in #${channels.welcome.name} konfiguriert`);
    } catch (err) {
      result.errors.push(`Welcome-System Fehler: ${(err as Error).message}`);
    }
  } else {
    result.skipped.push('Kein Welcome-Kanal gefunden (erstelle einen mit dem Namen "welcome" oder "willkommen")');
  }

  // 5. Log-Kanal setzen
  if (channels.logs) {
    try {
      const logEmbed = new EmbedBuilder()
        .setColor(NexusColors.ai)
        .setTitle('🤖 Nexus AI Omega — Log-System aktiviert')
        .setDescription(
          `> Dieser Kanal wurde als **Log-Kanal** konfiguriert.\n` +
          `> Hier werden alle wichtigen Server-Events protokolliert:\n\n` +
          `> › Beitritt/Verlassen von Mitgliedern\n` +
          `> › Moderationsaktionen (Bans, Kicks, Timeouts)\n` +
          `> › Nachrichtenbearbeitungen & -löschungen\n` +
          `> › Rollen- & Kanaländerungen\n` +
          `> › Sicherheits-Alerts (Zero-Trust)\n` +
          `> › KI-Aktionen`
        )
        .setFooter({ text: 'Nexus AI Omega v5 • Logging System' })
        .setTimestamp();

      await channels.logs.send({ embeds: [logEmbed] });
      result.logsSet = true;
      result.created.push(`📊 Log-System in #${channels.logs.name} aktiviert`);
    } catch (err) {
      result.errors.push(`Log-Kanal Fehler: ${(err as Error).message}`);
    }
  } else {
    // Log-Kanal erstellen falls nicht vorhanden
    try {
      const logChannel = await guild.channels.create({
        name: '📋-nexus-logs',
        type: ChannelType.GuildText,
        topic: 'Nexus AI Omega v5 — Automatischer Log-Kanal',
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.SendMessages] },
        ],
        reason: 'Nexus AI Auto-Setup — Log-Kanal erstellt',
      }) as TextChannel;

      const logEmbed = new EmbedBuilder()
        .setColor(NexusColors.ai)
        .setTitle('📋 Nexus Log-Kanal erstellt')
        .setDescription('> Dieser Kanal wurde automatisch von Nexus AI erstellt.')
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
      configCache.logChannelId = logChannel.id;
      await cacheSet(`nexus:v5:guild:${guild.id}:config`, configCache, 86_400 * 7);
      result.logsSet = true;
      result.created.push(`📋 Log-Kanal #📋-nexus-logs erstellt`);
    } catch {
      result.skipped.push('Log-Kanal konnte nicht erstellt werden');
    }
  }

  // 6. Verification-Kanal einrichten
  if (channels.verify) {
    try {
      const verifyEmbed = new EmbedBuilder()
        .setColor(NexusColors.success)
        .setTitle('✅ Verifizierung')
        .setDescription(
          `> Klicke den Button unten, um dich zu verifizieren und Zugang zu allen Kanälen zu erhalten.\n\n` +
          `> 🛡️ **Warum verifizieren?** Um Bots und Spam zu verhindern.`
        )
        .setFooter({ text: `${guild.name} • Verifizierungssystem` });

      const verRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('verify:click')
          .setLabel('✅ Ich bin kein Bot — Verifizieren')
          .setStyle(ButtonStyle.Success),
      );

      const pinMsg = await channels.verify.send({ embeds: [verifyEmbed], components: [verRow] });
      await pinMsg.pin().catch(() => {});
      result.created.push(`✅ Verifizierungs-System in #${channels.verify.name} gesetzt`);
    } catch (err) {
      result.errors.push(`Verifizierung Fehler: ${(err as Error).message}`);
    }
  }

  // 7. Suggestion-Kanal einrichten
  if (channels.suggestions) {
    try {
      const suggestEmbed = new EmbedBuilder()
        .setColor(NexusColors.info)
        .setTitle('💡 Vorschläge & Ideen')
        .setDescription(
          `> Hast du eine Idee, wie wir den Server verbessern können?\n` +
          `> Nutze den Befehl \`/suggest\` um deinen Vorschlag einzureichen!\n\n` +
          `> 👍 Die Community kann für Vorschläge abstimmen.`
        )
        .setFooter({ text: `${guild.name} • Vorschlagssystem` })
        .setTimestamp();

      await channels.suggestions.send({ embeds: [suggestEmbed] });
      result.created.push(`💡 Vorschlags-System in #${channels.suggestions.name} aktiviert`);
    } catch { /* skip */ }
  }

  result.durationMs = Math.round(performance.now() - start);
  botLogger.info({ guildId: guild.id, result: { found: Object.keys(result.found), created: result.created.length, errors: result.errors.length, durationMs: result.durationMs } }, '✅ Auto-Setup abgeschlossen');

  return result;
}

// ── Setup-Ergebnis als Embed bauen ─────────────────────────────────────────────
export function buildSetupResultEmbed(result: AutoSetupResult): EmbedBuilder {
  const successCount = result.created.length;
  const hasErrors = result.errors.length > 0;

  const embed = new EmbedBuilder()
    .setColor(hasErrors ? NexusColors.warning : NexusColors.success)
    .setTitle(hasErrors ? '⚠️ Auto-Setup abgeschlossen (mit Hinweisen)' : '✅ Auto-Setup erfolgreich!')
    .setDescription(
      `> **Server:** ${result.guildName}\n` +
      `> **Dauer:** \`${result.durationMs}ms\`\n` +
      `> **Nexus AI** hat deinen Server automatisch konfiguriert.`
    )
    .setTimestamp();

  if (result.created.length > 0) {
    embed.addFields({
      name: `✅ Konfiguriert (${successCount})`,
      value: result.created.map(c => `› ${c}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  if (result.rolesCreated.length > 0) {
    embed.addFields({
      name: `🎭 Rollen erstellt (${result.rolesCreated.length})`,
      value: result.rolesCreated.map(r => `› \`${r}\``).join('\n').slice(0, 512),
      inline: true,
    });
  }

  const foundChannels = Object.entries(result.found)
    .map(([purpose, id]) => `› ${purpose}: <#${id}>`)
    .join('\n');

  if (foundChannels) {
    embed.addFields({
      name: `🔍 Erkannte Kanäle (${Object.keys(result.found).length})`,
      value: foundChannels.slice(0, 1024),
      inline: false,
    });
  }

  if (result.skipped.length > 0) {
    embed.addFields({
      name: '⏭️ Übersprungen',
      value: result.skipped.map(s => `› ${s}`).join('\n').slice(0, 512),
      inline: false,
    });
  }

  if (result.errors.length > 0) {
    embed.addFields({
      name: '❌ Fehler',
      value: result.errors.map(e => `› ${e}`).join('\n').slice(0, 512),
      inline: false,
    });
  }

  embed.addFields({
    name: '💡 Nächste Schritte',
    value:
      '› `/ticketsetup` — KI-Ticket-System einrichten\n' +
      '› `/setwelcome` — Willkommensnachricht anpassen\n' +
      '› `/setrules` — Regeln manuell bearbeiten\n' +
      '› `/setlogs` — Log-Kanal ändern\n' +
      '› `/aiprovider` — KI-Provider konfigurieren',
    inline: false,
  });

  embed.setFooter({ text: 'Nexus AI Omega v5 • Auto Setup System' });
  return embed;
}

// ── Einzelne Kanäle per Muster finden (für /setwelcome, /setrules) ─────────────
export function detectChannelByPurpose(guild: Guild, purpose: ChannelPurpose): TextChannel | null {
  return findChannel(guild, purpose);
}
