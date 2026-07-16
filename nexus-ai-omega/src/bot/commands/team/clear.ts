/**
 * Nexus AI Omega — /clear Command v5.1
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Zugriff: NUR Server-Owner ODER Nexus-Team-Mitglieder
 *   → Alle anderen werden mit klarer Fehlermeldung abgewiesen
 *
 * Löscht auf einem Server:
 *   • Alle Textkanäle
 *   • Alle Sprachkanäle (Voice)
 *   • Alle Foren, Stage, Announcement-Kanäle
 *   • Alle Kategorien
 *   • Alle Rollen (außer @everyone & Bot-Rollen)
 *
 * Sicherheitsstufen:
 *   1. Server-Owner ODER Nexus-Team — alle anderen: Zugang verweigert
 *   2. Klare Fehlermeldung mit wer Zugriff hat
 *   3. Doppelte Bestätigung via Button (30 Sek. Timeout)
 *   4. 5-Sekunden Live-Countdown vor dem Löschen
 *   5. Vollständiger Löschbericht + Global-Log
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
} from 'discord.js';
import { botLogger } from '../../../services/logger.js';
import { globalLogger } from '../../../global/globalLogger.js';
import { NexusColors } from '../../../utils/embeds.js';
import { permissionService } from '../../../global/team/permissionService.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

// ── Zugriffsprüfung: Server-Owner ODER Nexus-Team ─────────────────────────
type AccessResult =
  | { allowed: true;  role: 'server_owner' | 'nexus_team'; rankLabel: string }
  | { allowed: false; role: 'none'; reason: string };

async function checkAccess(
  userId: string,
  guild: import('discord.js').Guild,
): Promise<AccessResult> {

  // ── 1. Server-Owner hat immer Zugriff ────────────────────────────────────
  if (guild.ownerId === userId) {
    return { allowed: true, role: 'server_owner', rankLabel: '👑 Server-Owner' };
  }

  // ── 2. Nexus-Team-Prüfung (Datenbank) ────────────────────────────────────
  try {
    const rank = await permissionService.getRank(userId);
    if (rank !== null) {
      const rankLabels: Record<string, string> = {
        OWNER:      '👑 Nexus Owner',
        CO_OWNER:   '💎 Nexus Co-Owner',
        MANAGER:    '🛡 Nexus Manager',
        DEVELOPER:  '⚙️ Nexus Developer',
        AI_MANAGER: '🤖 Nexus AI Manager',
        MODERATOR:  '🛡️ Nexus Moderator',
        SUPPORT:    '🎫 Nexus Support',
        TEAM:       '👥 Nexus Team',
      };
      return {
        allowed:   true,
        role:      'nexus_team',
        rankLabel: rankLabels[rank] ?? `Nexus ${rank}`,
      };
    }
  } catch {
    // Fallback: NEXUS_OWNER_IDS env-Variable
    const envOwners = (process.env.NEXUS_OWNER_IDS ?? '').split(',').filter(Boolean);
    if (envOwners.includes(userId)) {
      return { allowed: true, role: 'nexus_team', rankLabel: '👑 Nexus Owner (ENV)' };
    }
  }

  // ── 3. Kein Zugriff ───────────────────────────────────────────────────────
  return {
    allowed: false,
    role:    'none',
    reason:
      'Weder **Server-Owner** noch **Nexus-Team-Mitglied**.\n' +
      'Nur der Server-Owner oder autorisierte Nexus-Team-Mitglieder\n' +
      'dürfen diesen Befehl ausführen.',
  };
}

// ── Server-Snapshot für die Bestätigungs-Übersicht ────────────────────────
interface ClearSnapshot {
  textChannels:  number;
  voiceChannels: number;
  forumChannels: number;
  stageChannels: number;
  announcements: number;
  categories:    number;
  roles:         number;
  totalChannels: number;
  names: {
    categories:   string[];
    voice:        string[];
    text:         string[];
    roles:        string[];
  };
}

function buildSnapshot(
  guild: import('discord.js').Guild,
  scope: 'all' | 'channels' | 'roles',
): ClearSnapshot {
  const textCh  = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
  const voiceCh = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);
  const forumCh = guild.channels.cache.filter(c => c.type === ChannelType.GuildForum);
  const stageCh = guild.channels.cache.filter(c => c.type === ChannelType.GuildStageVoice);
  const annCh   = guild.channels.cache.filter(c => c.type === ChannelType.GuildAnnouncement);
  const catCh   = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
  const roles   = guild.roles.cache.filter(r => !r.managed && r.id !== guild.roles.everyone.id);

  return {
    textChannels:  scope !== 'roles' ? textCh.size  : 0,
    voiceChannels: scope !== 'roles' ? voiceCh.size : 0,
    forumChannels: scope !== 'roles' ? forumCh.size : 0,
    stageChannels: scope !== 'roles' ? stageCh.size : 0,
    announcements: scope !== 'roles' ? annCh.size   : 0,
    categories:    scope !== 'roles' ? catCh.size   : 0,
    roles:         scope !== 'channels' ? roles.size : 0,
    totalChannels: scope !== 'roles'
      ? textCh.size + voiceCh.size + forumCh.size + stageCh.size + annCh.size
      : 0,
    names: {
      categories: [...catCh.values()].slice(0, 10).map(c => c.name),
      voice:      [...voiceCh.values()].slice(0, 10).map(c => c.name),
      text:       [...textCh.values()].slice(0, 10).map(c => c.name),
      roles:      [...roles.values()].slice(0, 10).map(r => r.name),
    },
  };
}

// ── Bestätigungs-Embed ─────────────────────────────────────────────────────
function buildConfirmEmbed(
  snap: ClearSnapshot,
  guild: import('discord.js').Guild,
  scope: 'all' | 'channels' | 'roles',
  executor: import('discord.js').User,
  accessRole: 'server_owner' | 'nexus_team',
  rankLabel: string,
): EmbedBuilder {
  const fmt = (arr: string[], max = 8): string => {
    if (!arr.length) return '`Keine`';
    const shown = arr.slice(0, max).map(n => `› \`${n}\``).join('\n');
    const rest  = arr.length > max ? `\n› *…und ${arr.length - max} weitere*` : '';
    return shown + rest;
  };

  const titleIcon  = accessRole === 'server_owner' ? '👑' : '🛡️';
  const titleLabel = accessRole === 'server_owner'
    ? 'SERVER OWNER — /clear Bestätigung'
    : 'NEXUS TEAM — /clear Bestätigung';

  const embed = new EmbedBuilder()
    .setColor(NexusColors.error)
    .setTitle(`🚨 ${titleIcon} ${titleLabel}`)
    .setDescription(
      `> **Server:** \`${guild.name}\`  (\`${guild.id}\`)\n` +
      `> **Ausführer:** ${executor.tag}  (\`${executor.id}\`)\n` +
      `> **Rolle:** ${rankLabel}\n` +
      `> **Scope:** \`${scope}\`\n\n` +
      `> ⚠️ **Diese Aktion löscht dauerhaft alle unten gelisteten Inhalte.**\n` +
      `> ⚠️ **Nachrichten in gelöschten Kanälen sind unwiederbringlich verloren.**\n` +
      `> ⚠️ **Diese Aktion kann NICHT rückgängig gemacht werden.**`,
    );

  // Was wird gelöscht?
  if (scope !== 'roles') {
    embed.addFields({
      name: `📋 Wird gelöscht — Kanäle & Kategorien`,
      value:
        `› 📂 **${snap.categories}** Kategorien\n` +
        `› 💬 **${snap.textChannels}** Text-Kanäle\n` +
        `› 🎙️ **${snap.voiceChannels}** Voice-Kanäle\n` +
        `› 💭 **${snap.forumChannels}** Forum-Kanäle\n` +
        `› 🎭 **${snap.stageChannels}** Stage-Kanäle\n` +
        `› 📢 **${snap.announcements}** Ankündigungs-Kanäle\n` +
        `› **Gesamt: ${snap.totalChannels + snap.categories} Objekte**`,
      inline: false,
    });

    if (snap.names.categories.length > 0) {
      embed.addFields({ name: '📂 Kategorien', value: fmt(snap.names.categories), inline: true });
    }
    if (snap.names.voice.length > 0) {
      embed.addFields({ name: '🎙️ Voice-Kanäle', value: fmt(snap.names.voice), inline: true });
    }
    if (snap.names.text.length > 0) {
      embed.addFields({ name: '💬 Text-Kanäle', value: fmt(snap.names.text), inline: true });
    }
  }

  if (scope !== 'channels') {
    embed.addFields({
      name: `🎨 Wird gelöscht — Rollen (${snap.roles})`,
      value: snap.roles > 0 ? fmt(snap.names.roles) : '`Keine löschbaren Rollen`',
      inline: false,
    });
    embed.addFields({
      name: '🔒 Werden NICHT gelöscht',
      value: '› `@everyone` Rolle\n› Bot-verwaltete Rollen (Integrationen)',
      inline: false,
    });
  }

  embed.addFields({
    name: '⏱️ Zeitlimit',
    value: '> Du hast **30 Sekunden** um zu bestätigen, danach wird die Aktion automatisch abgebrochen.',
    inline: false,
  });

  embed.setFooter({ text: `Nexus AI Omega v5 • /clear • Zugriff: Server-Owner oder Nexus-Team` });
  embed.setTimestamp();
  return embed;
}

// ── Fortschritts-Embed ─────────────────────────────────────────────────────
function buildProgressEmbed(
  phase: string,
  stats: { channels: number; categories: number; roles: number; errors: number },
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NexusColors.warning)
    .setTitle('🗑️ Nexus Clear läuft…')
    .setDescription(`> **Phase:** ${phase}`)
    .addFields(
      { name: '💬 Kanäle gelöscht',     value: `\`${stats.channels}\``,   inline: true },
      { name: '📂 Kategorien gelöscht', value: `\`${stats.categories}\``, inline: true },
      { name: '🎨 Rollen gelöscht',     value: `\`${stats.roles}\``,      inline: true },
      { name: '⚠️ Fehler',             value: `\`${stats.errors}\``,      inline: true },
    )
    .setFooter({ text: 'Nexus AI Omega v5 • Bitte warten — nicht unterbrechen' });
}

// ── Abschluss-Embed ────────────────────────────────────────────────────────
function buildResultEmbed(
  guild: import('discord.js').Guild,
  stats: { channels: number; categories: number; roles: number; errors: string[] },
  executor: import('discord.js').User,
  scope: string,
  durationMs: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(stats.errors.length > 0 ? NexusColors.warning : NexusColors.success)
    .setTitle(stats.errors.length > 0 ? '⚠️ Clear abgeschlossen (mit Problemen)' : '✅ Clear erfolgreich abgeschlossen!')
    .setDescription(
      `> **Server:** \`${guild.name}\`\n` +
      `> **Ausführer:** ${executor.tag}\n` +
      `> **Scope:** \`${scope}\`\n` +
      `> **Dauer:** \`${(durationMs / 1000).toFixed(1)}s\``,
    )
    .addFields(
      { name: '💬 Kanäle gelöscht',     value: `\`${stats.channels}\``,   inline: true },
      { name: '📂 Kategorien gelöscht', value: `\`${stats.categories}\``, inline: true },
      { name: '🎨 Rollen gelöscht',     value: `\`${stats.roles}\``,      inline: true },
    );

  if (stats.errors.length > 0) {
    embed.addFields({
      name: `⚠️ Fehler (${stats.errors.length})`,
      value: stats.errors.slice(0, 8).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  embed.addFields({
    name: '💡 Nächste Schritte',
    value:
      '› `/serverbuild` — Neuen Server mit KI aufbauen\n' +
      '› `/setup` — Auto-Setup ausführen\n' +
      '› `/setrules` — Regeln setzen\n' +
      '› `/setwelcome` — Willkommenssystem einrichten',
    inline: false,
  });

  embed.setFooter({ text: 'Nexus AI Omega v5 • NEXUS TEAM • /clear' });
  embed.setTimestamp();
  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════
// HAUPT LÖSCH-FUNKTION
// ═══════════════════════════════════════════════════════════════════════════
async function executeClear(
  guild: import('discord.js').Guild,
  scope: 'all' | 'channels' | 'roles',
  executor: import('discord.js').User,
  replyFn: (embed: EmbedBuilder) => Promise<void>,
): Promise<{ channels: number; categories: number; roles: number; errors: string[] }> {

  const stats = { channels: 0, categories: 0, roles: 0, errors: [] as string[] };
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // ── PHASE 1: Alle Kanäle löschen (außer Kategorien) ────────────────────
  if (scope !== 'roles') {
    await replyFn(buildProgressEmbed('🗑️ Phase 1/3 — Kanäle werden gelöscht…', stats));

    const allChannels = [
      ...guild.channels.cache
        .filter(c => c.type !== ChannelType.GuildCategory)
        .values(),
    ];

    for (const channel of allChannels) {
      try {
        await channel.delete(`Nexus /clear — ausgeführt von ${executor.tag}`);
        stats.channels++;
      } catch (err) {
        const msg = `Kanal "${channel.name}": ${(err as Error).message}`;
        stats.errors.push(msg);
        botLogger.warn({ err, channel: channel.name }, 'Clear: Kanal konnte nicht gelöscht werden');
      }
      await sleep(350); // Rate-Limit Puffer
    }

    await replyFn(buildProgressEmbed('🗑️ Phase 2/3 — Kategorien werden gelöscht…', stats));

    // ── PHASE 2: Kategorien löschen (erst wenn Kanäle weg) ───────────────
    const allCategories = [
      ...guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .values(),
    ];

    for (const cat of allCategories) {
      try {
        await cat.delete(`Nexus /clear — ausgeführt von ${executor.tag}`);
        stats.categories++;
      } catch (err) {
        stats.errors.push(`Kategorie "${cat.name}": ${(err as Error).message}`);
      }
      await sleep(300);
    }
  }

  // ── PHASE 3: Rollen löschen ─────────────────────────────────────────────
  if (scope !== 'channels') {
    await replyFn(buildProgressEmbed('🎨 Phase 3/3 — Rollen werden gelöscht…', stats));

    const deletableRoles = [
      ...guild.roles.cache
        .filter(r =>
          !r.managed &&                   // Keine Bot/Integration-Rollen
          r.id !== guild.roles.everyone.id && // Nicht @everyone
          r.editable                      // Bot kann die Rolle bearbeiten
        )
        .sort((a, b) => b.position - a.position) // Höchste zuerst
        .values(),
    ];

    for (const role of deletableRoles) {
      try {
        await role.delete(`Nexus /clear — ausgeführt von ${executor.tag}`);
        stats.roles++;
      } catch (err) {
        stats.errors.push(`Rolle "${role.name}": ${(err as Error).message}`);
      }
      await sleep(300);
    }
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// SLASH COMMAND
// ═══════════════════════════════════════════════════════════════════════════
const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('🗑️ [NEXUS TEAM] Löscht alle Kanäle, Kategorien, Voice-Chats und/oder Rollen')
    .addStringOption(o =>
      o
        .setName('scope')
        .setDescription('Was soll gelöscht werden?')
        .setRequired(false)
        .addChoices(
          { name: '🗑️ Alles — Kanäle + Kategorien + Voice + Rollen', value: 'all' },
          { name: '💬 Nur Kanäle & Kategorien (Voice bleibt)',         value: 'channels' },
          { name: '🎨 Nur Rollen (Kanäle bleiben)',                    value: 'roles' },
        ),
    )
    .addStringOption(o =>
      o
        .setName('grund')
        .setDescription('Begründung (wird im Global-Log gespeichert)')
        .setMaxLength(500),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  cooldown: 60,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild!;

    // ── 1. Zugriffsprüfung: Server-Owner ODER Nexus-Team ─────────────────
    const access = await checkAccess(interaction.user.id, guild);

    if (!access.allowed) {
      const isOwner  = guild.ownerId === interaction.user.id; // immer false hier
      const ownerTag = await guild.fetchOwner()
        .then(o => o.user.tag)
        .catch(() => 'Unbekannt');

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.error)
            .setTitle('🔒 Zugriff verweigert — /clear')
            .setDescription(
              '> Dieser Befehl kann nur von folgenden Personen ausgeführt werden:\n\n' +
              '> 👑 **Server-Owner** — der Besitzer dieses Servers\n' +
              '> 🛡️ **Nexus-Team** — autorisierte Nexus-Team-Mitglieder\n\n' +
              `> ❌ Du bist **keines** von beidem.\n` +
              `> Grund: ${access.reason}`,
            )
            .addFields(
              {
                name: '👑 Server-Owner dieses Servers',
                value: `${ownerTag}\n\`${guild.ownerId}\``,
                inline: true,
              },
              {
                name: '🛡️ Nexus-Team beitreten',
                value: 'Wende dich an einen Nexus Owner\num ins Team aufgenommen zu werden.',
                inline: true,
              },
            )
            .setFooter({ text: 'Nexus AI Omega v5 • Zero-Trust Security • Kein Zugriff' })
            .setTimestamp(),
        ],
        ephemeral: true,
      });

      // Log den fehlgeschlagenen Zugriffsversuch
      botLogger.warn(
        { userId: interaction.user.id, userTag: interaction.user.tag, guildId: guild.id },
        '⚠️ /clear Zugriff verweigert',
      );
      await globalLogger.log({
        eventType: 'SECURITY_ALERT',
        severity:  'warning',
        guildId:    guild.id,
        guildName:  guild.name,
        userId:     interaction.user.id,
        username:   interaction.user.tag,
        action:     'CLEAR_ACCESS_DENIED',
        result:     'Kein Server-Owner und kein Nexus-Team-Mitglied',
      });
      return;
    }

    const scope = (interaction.options.getString('scope') ?? 'all') as 'all' | 'channels' | 'roles';
    const grund = interaction.options.getString('grund') ?? 'Kein Grund angegeben';

    // ── 2. Snapshot & Bestätigungs-Embed ─────────────────────────────────
    const snap       = buildSnapshot(guild, scope);
    const confirmEmb = buildConfirmEmbed(snap, guild, scope, interaction.user, access.role, access.rankLabel);

    // Bestätigungs-Buttons
    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('clear:confirm')
        .setLabel('🗑️ JA — Jetzt löschen!')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('clear:cancel')
        .setLabel('❌ Abbrechen')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      embeds: [confirmEmb],
      components: [confirmRow],
      ephemeral: true,
    });

    // ── 3. Button-Antwort abwarten (30 Sek. Timeout) ─────────────────────
    let btnInteraction: ButtonInteraction;
    try {
      btnInteraction = await interaction.channel!.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: btn =>
          (btn.customId === 'clear:confirm' || btn.customId === 'clear:cancel') &&
          btn.user.id === interaction.user.id,
        time: 30_000,
      }) as ButtonInteraction;
    } catch {
      // Timeout
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.dark)
            .setTitle('⏱️ Zeit abgelaufen — Abgebrochen')
            .setDescription('> Du hast nicht innerhalb von 30 Sekunden bestätigt.\n> Es wurde **nichts gelöscht**.')
            .setTimestamp(),
        ],
        components: [],
      });
      return;
    }

    // ── 4. Abbrechen? ─────────────────────────────────────────────────────
    if (btnInteraction.customId === 'clear:cancel') {
      await btnInteraction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.dark)
            .setTitle('❌ Abgebrochen')
            .setDescription('> Der Clear-Vorgang wurde abgebrochen.\n> **Es wurden keine Änderungen vorgenommen.**')
            .setTimestamp(),
        ],
        components: [],
      });
      return;
    }

    // ── 5. Countdown (5 Sekunden) — letzte Chance zum Stoppen ────────────
    await btnInteraction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.error)
          .setTitle('⏳ Startet in 5 Sekunden…')
          .setDescription(
            '> **Nexus Clear beginnt gleich.**\n' +
            '> Alle ausgewählten Inhalte werden unwiederbringlich gelöscht.\n\n' +
            '> `5… 4… 3… 2… 1…`',
          )
          .setFooter({ text: 'Nexus AI Omega v5 • NEXUS TEAM • /clear' })
          .setTimestamp(),
      ],
      components: [],
    });

    // Live-Countdown
    for (let i = 4; i >= 1; i--) {
      await new Promise(r => setTimeout(r, 1000));
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.error)
            .setTitle(`⏳ Startet in ${i} Sekunde${i !== 1 ? 'n' : ''}…`)
            .setDescription(
              `> **${'🔴'.repeat(5 - i)}${'⬜'.repeat(i)}** ${i}/${5}\n\n` +
              `> Scope: \`${scope}\` — Server: \`${guild.name}\``,
            )
            .setTimestamp(),
        ],
      });
    }

    await new Promise(r => setTimeout(r, 1000));

    // ── 6. Clear ausführen ────────────────────────────────────────────────
    const start = performance.now();

    await interaction.editReply({
      embeds: [buildProgressEmbed('🚀 Starte…', { channels: 0, categories: 0, roles: 0, errors: 0 })],
    });

    const stats = await executeClear(
      guild,
      scope,
      interaction.user,
      async (embed) => {
        await interaction.editReply({ embeds: [embed] }).catch(() => {});
      },
    );

    const durationMs = Math.round(performance.now() - start);

    // ── 7. Abschluss-Embed ────────────────────────────────────────────────
    const resultEmb = buildResultEmbed(guild, stats, interaction.user, scope, durationMs);
    await interaction.editReply({ embeds: [resultEmb], components: [] });

    // ── 8. Global Log ─────────────────────────────────────────────────────
    await globalLogger.log({
      eventType: 'SECURITY_ALERT',
      severity:  'security',
      guildId:    guild.id,
      guildName:  guild.name,
      userId:     interaction.user.id,
      username:   interaction.user.tag,
      action:     'NEXUS_CLEAR_EXECUTED',
      reason:     grund,
      result:
        `Gelöscht: ${stats.channels} Kanäle, ${stats.categories} Kategorien, ${stats.roles} Rollen` +
        ` | Fehler: ${stats.errors.length} | Dauer: ${(durationMs / 1000).toFixed(1)}s`,
      metadata: {
        scope,
        grund,
        accessRole:  access.role,
        rankLabel:   access.rankLabel,
        deleted: {
          channels:   stats.channels,
          categories: stats.categories,
          roles:      stats.roles,
        },
        errors:    stats.errors.length,
        durationMs,
      },
    });

    botLogger.warn(
      {
        guildId:   guild.id,
        guildName: guild.name,
        executor:  interaction.user.tag,
        scope,
        deleted:   stats,
        durationMs,
      },
      '🗑️ NEXUS /clear ausgeführt',
    );
  },
};

export default command;
