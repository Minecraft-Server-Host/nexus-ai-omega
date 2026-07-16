/**
 * Nexus AI Omega — AI Server Builder v5.1
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Flow:
 *  1. /serverbuild → KI generiert Plan → Preview Embed
 *  2. [✅ Erstellen] → Fragt: "Alles löschen?" mit vollständiger
 *     Liste aller vorhandenen Kanäle/Kategorien/Voice/Rollen
 *  3. User wählt:
 *       [🗑️ Alles löschen & neu bauen]  → löscht ALLES, dann baut
 *       [➕ Behalten & hinzufügen]       → löscht nichts, fügt nur hinzu
 *       [❌ Abbrechen]                   → nichts passiert
 *  4. Live-Fortschritts-Embed während des Baus
 *  5. Abschlussbericht mit Statistiken
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import {
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  PermissionsBitField,
  type Guild,
  type GuildChannel,
  type CategoryChannel,
  type TextChannel,
  type VoiceChannel,
  type Role,
} from 'discord.js';
import { aiEngine } from '../../ai-center/aiEngine.js';
import {
  serverBuildPreviewEmbed,
  serverBuildActionRow,
  Embeds,
  NexusColors,
} from '../../utils/embeds.js';
import { builderLogger } from '../../services/logger.js';
import { cacheGet, cacheSet } from '../../services/redisCache.js';
import { CacheKeys } from '../../types/index.js';
import type { ServerBuildPlan } from '../../types/index.js';

// ── Typen ─────────────────────────────────────────────────────────────────────
type BuildMode = 'delete_all' | 'keep_add';

interface ServerSnapshot {
  categories:    { id: string; name: string }[];
  textChannels:  { id: string; name: string; parent: string | null }[];
  voiceChannels: { id: string; name: string; parent: string | null }[];
  forumChannels: { id: string; name: string; parent: string | null }[];
  stageChannels: { id: string; name: string; parent: string | null }[];
  roles:         { id: string; name: string; managed: boolean }[];
  totalChannels: number;
  totalRoles:    number;
}

// ── Aktuellen Server-Stand erfassen ───────────────────────────────────────────
function snapshotGuild(guild: Guild): ServerSnapshot {
  const categories    = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
  const textChannels  = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
  const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);
  const forumChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildForum);
  const stageChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildStageVoice);
  const userRoles     = guild.roles.cache.filter(r => !r.managed && r.id !== guild.roles.everyone.id);

  return {
    categories:    [...categories.values()].map(c => ({ id: c.id, name: c.name })),
    textChannels:  [...textChannels.values()].map(c => ({ id: c.id, name: c.name, parent: (c as TextChannel).parentId })),
    voiceChannels: [...voiceChannels.values()].map(c => ({ id: c.id, name: c.name, parent: (c as VoiceChannel).parentId })),
    forumChannels: [...forumChannels.values()].map(c => ({ id: c.id, name: c.name, parent: (c as GuildChannel).parentId })),
    stageChannels: [...stageChannels.values()].map(c => ({ id: c.id, name: c.name, parent: (c as GuildChannel).parentId })),
    roles:         [...userRoles.values()].map(r => ({ id: r.id, name: r.name, managed: r.managed })),
    totalChannels: textChannels.size + voiceChannels.size + forumChannels.size + stageChannels.size,
    totalRoles:    userRoles.size,
  };
}

// ── "Lösch-Bestätigung" Embed bauen ─────────────────────────────────────────
function buildDeleteConfirmEmbed(snapshot: ServerSnapshot, plan: ServerBuildPlan): EmbedBuilder {
  // Kanal-Vorschau (max 15 pro Typ)
  const formatList = (items: { name: string }[], emoji: string, max = 12): string => {
    if (!items.length) return '`Keine`';
    const shown = items.slice(0, max).map(i => `› \`${i.name}\``).join('\n');
    const rest  = items.length > max ? `\n› *…und ${items.length - max} weitere*` : '';
    return shown + rest;
  };

  const embed = new EmbedBuilder()
    .setColor(NexusColors.error)
    .setTitle('⚠️ Achtung — Server-Inhalte werden gelöscht!')
    .setDescription(
      '> **Nexus AI** hat einen Server-Plan erstellt und ist bereit zu bauen.\n' +
      '> Bevor der Bau beginnt, musst du entscheiden:\n\n' +
      '> 🗑️ **Alles löschen** — Alle bestehenden Kanäle, Kategorien und Voice-Chats\n' +
      '> werden gelöscht. Danach wird der neue Server-Plan gebaut.\n\n' +
      '> ➕ **Nur hinzufügen** — Der neue Plan wird zum bestehenden Server\n' +
      '> hinzugefügt, ohne etwas zu löschen.\n\n' +
      '> ❌ **Abbrechen** — Es wird nichts verändert.',
    );

  // Was würde gelöscht werden
  embed.addFields(
    {
      name: `🗑️ Wird gelöscht bei "Alles löschen" (${snapshot.totalChannels} Kanäle, ${snapshot.categories.length} Kategorien)`,
      value: '\u200b',
      inline: false,
    },
  );

  if (snapshot.categories.length > 0) {
    embed.addFields({
      name: `📂 Kategorien (${snapshot.categories.length})`,
      value: formatList(snapshot.categories, '📂'),
      inline: true,
    });
  }

  if (snapshot.textChannels.length > 0) {
    embed.addFields({
      name: `💬 Text-Kanäle (${snapshot.textChannels.length})`,
      value: formatList(snapshot.textChannels, '💬'),
      inline: true,
    });
  }

  if (snapshot.voiceChannels.length > 0) {
    embed.addFields({
      name: `🎙️ Voice-Kanäle (${snapshot.voiceChannels.length})`,
      value: formatList(snapshot.voiceChannels, '🎙️'),
      inline: true,
    });
  }

  if (snapshot.forumChannels.length > 0) {
    embed.addFields({
      name: `💭 Forum-Kanäle (${snapshot.forumChannels.length})`,
      value: formatList(snapshot.forumChannels, '💭'),
      inline: true,
    });
  }

  if (snapshot.stageChannels.length > 0) {
    embed.addFields({
      name: `🎭 Stage-Kanäle (${snapshot.stageChannels.length})`,
      value: formatList(snapshot.stageChannels, '🎭'),
      inline: true,
    });
  }

  if (snapshot.roles.length > 0) {
    embed.addFields({
      name: `🎨 Rollen (${snapshot.roles.length}) — werden NICHT gelöscht`,
      value: formatList(snapshot.roles.slice(0, 8), '🎨') + '\n*Rollen bleiben erhalten*',
      inline: false,
    });
  }

  // Was neu kommt
  const newChannelCount = plan.categories.reduce((sum, c) => sum + c.channels.length, 0);
  embed.addFields(
    {
      name: `✨ Neuer Server-Plan: "${plan.theme}"`,
      value:
        `› 📂 **${plan.categories.length}** Kategorien\n` +
        `› 💬 **${newChannelCount}** Kanäle (Text, Voice, Forum)\n` +
        `› 🎨 **${plan.roles.length}** neue Rollen\n` +
        `› 🎨 Farbpalette: ${plan.palette.map(c => `\`${c}\``).join(' ')}`,
      inline: false,
    },
    {
      name: '⚠️ WARNUNG',
      value:
        '> **Diese Aktion kann nicht rückgängig gemacht werden!**\n' +
        '> Alle Nachrichten in gelöschten Kanälen gehen **unwiederbringlich verloren**.\n' +
        '> Stelle sicher, dass du wichtige Inhalte gesichert hast.',
      inline: false,
    },
  );

  embed.setFooter({ text: 'Nexus AI Omega v5 • Server Builder • Bitte wähle eine Option' });
  embed.setTimestamp();
  return embed;
}

// ── Lösch-Bestätigung Action Row ─────────────────────────────────────────────
function buildDeleteConfirmRow(hasExistingContent: boolean): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (hasExistingContent) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('serverbuild:delete_all')
        .setLabel('🗑️ Alles löschen & neu bauen')
        .setStyle(ButtonStyle.Danger),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('serverbuild:keep_add')
      .setLabel('➕ Behalten & hinzufügen')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('serverbuild:cancel')
      .setLabel('❌ Abbrechen')
      .setStyle(ButtonStyle.Secondary),
  );

  return row;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleServerBuildCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const theme   = interaction.options.getString('theme', true);
  const style   = interaction.options.getString('style') ?? 'auto';
  const guildId = interaction.guildId!;

  await interaction.reply({
    embeds: [Embeds.loading(`Server-Plan für "${theme}" wird generiert…`, `Stil: ${style} • KI analysiert dein Thema…`)],
    ephemeral: false,
  });

  try {
    const plan = await aiEngine.generateServerBuildPlan(theme, style, guildId);
    await cacheSet(CacheKeys.buildPlan(interaction.user.id, guildId), plan, 900); // 15min

    await interaction.editReply({
      embeds: [serverBuildPreviewEmbed(plan)],
      components: [serverBuildActionRow()],
    });
  } catch (err) {
    builderLogger.error({ err }, 'Server build plan generation failed');
    await interaction.editReply({
      embeds: [Embeds.error('Generierung fehlgeschlagen', 'Die KI konnte keinen Server-Plan erstellen. Bitte versuche es erneut.')],
      components: [],
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleServerBuildButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const action  = interaction.customId.split(':')[1] as
    'confirm' | 'edit' | 'regenerate' | 'cancel' | 'delete_all' | 'keep_add';
  const guildId = interaction.guildId!;

  switch (action) {

    // ── [✅ Erstellen] — zeigt Lösch-Bestätigung ─────────────────────────────
    case 'confirm': {
      await interaction.deferUpdate();

      const plan = await cacheGet<ServerBuildPlan>(CacheKeys.buildPlan(interaction.user.id, guildId));
      if (!plan) {
        await interaction.editReply({
          embeds: [Embeds.error('Plan abgelaufen', 'Bitte `/serverbuild` erneut ausführen.')],
          components: [],
        });
        return;
      }

      const guild    = interaction.guild!;
      const snapshot = snapshotGuild(guild);
      const hasContent = snapshot.totalChannels > 0 || snapshot.categories.length > 0;

      const confirmEmbed = buildDeleteConfirmEmbed(snapshot, plan);
      const confirmRow   = buildDeleteConfirmRow(hasContent);

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [confirmRow],
      });
      break;
    }

    // ── [🗑️ Alles löschen & neu bauen] ──────────────────────────────────────
    case 'delete_all': {
      await interaction.deferUpdate();

      const plan = await cacheGet<ServerBuildPlan>(CacheKeys.buildPlan(interaction.user.id, guildId));
      if (!plan) {
        await interaction.editReply({
          embeds: [Embeds.error('Plan abgelaufen', 'Bitte `/serverbuild` erneut ausführen.')],
          components: [],
        });
        return;
      }

      await executeBuild(interaction, guildId, plan, 'delete_all');
      break;
    }

    // ── [➕ Behalten & hinzufügen] ───────────────────────────────────────────
    case 'keep_add': {
      await interaction.deferUpdate();

      const plan = await cacheGet<ServerBuildPlan>(CacheKeys.buildPlan(interaction.user.id, guildId));
      if (!plan) {
        await interaction.editReply({
          embeds: [Embeds.error('Plan abgelaufen', 'Bitte `/serverbuild` erneut ausführen.')],
          components: [],
        });
        return;
      }

      await executeBuild(interaction, guildId, plan, 'keep_add');
      break;
    }

    // ── [✏️ Bearbeiten] ──────────────────────────────────────────────────────
    case 'edit':
      await interaction.reply({
        embeds: [Embeds.info(
          '✏️ Plan bearbeiten',
          '> Um den Plan zu bearbeiten, starte `/serverbuild` erneut mit einem genaueren Thema.\n' +
          '> **Beispiel:** `"Valorant Esports 10.000 Spieler neon lila cyber"`',
        )],
        ephemeral: true,
      });
      break;

    // ── [🔄 Neu generieren] ──────────────────────────────────────────────────
    case 'regenerate': {
      await interaction.deferUpdate();

      const existing = await cacheGet<ServerBuildPlan>(CacheKeys.buildPlan(interaction.user.id, guildId));
      const theme    = existing?.theme ?? 'Community Server';
      const style    = existing?.style ?? 'auto';

      await interaction.editReply({
        embeds: [Embeds.loading(`Neuen einzigartigen Plan für "${theme}" generieren…`)],
        components: [],
      });

      try {
        const newPlan = await aiEngine.generateServerBuildPlan(
          `${theme} ${Date.now().toString(36)}`,
          style,
          guildId,
        );
        await cacheSet(CacheKeys.buildPlan(interaction.user.id, guildId), newPlan, 900);
        await interaction.editReply({
          embeds: [serverBuildPreviewEmbed(newPlan)],
          components: [serverBuildActionRow()],
        });
      } catch {
        await interaction.editReply({
          embeds: [Embeds.error('Fehler', 'Regenerierung fehlgeschlagen. Bitte versuche es erneut.')],
          components: [],
        });
      }
      break;
    }

    // ── [❌ Abbrechen] ───────────────────────────────────────────────────────
    case 'cancel':
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.dark)
            .setTitle('❌ Server-Build abgebrochen')
            .setDescription('> Der Bau wurde abgebrochen. **Es wurden keine Änderungen vorgenommen.**')
            .setFooter({ text: 'Nexus AI Omega v5 • Server Builder' })
            .setTimestamp(),
        ],
        components: [],
      });
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD EXECUTION (mit optionalem Löschen)
// ═══════════════════════════════════════════════════════════════════════════════

async function executeBuild(
  interaction: ButtonInteraction,
  guildId: string,
  plan: ServerBuildPlan,
  mode: BuildMode,
): Promise<void> {
  const guild = interaction.guild!;

  // ── Live Fortschritts-Embed ───────────────────────────────────────────────
  const progressEmbed = new EmbedBuilder()
    .setColor(NexusColors.primary)
    .setTitle('🏗️ Server wird gebaut…')
    .setDescription(
      `> **Modus:** ${mode === 'delete_all' ? '🗑️ Alles löschen & neu bauen' : '➕ Hinzufügen'}\n` +
      `> **Thema:** ${plan.theme}`,
    )
    .addFields(
      { name: '🗑️ Löschung',     value: mode === 'delete_all' ? '⏳ Wartet…' : '⏭️ Übersprungen', inline: true },
      { name: '🎨 Rollen',        value: '⏳ Wartet…', inline: true },
      { name: '📂 Kategorien',    value: '⏳ Wartet…', inline: true },
      { name: '💬 Text-Kanäle',   value: '⏳ Wartet…', inline: true },
      { name: '🎙️ Voice-Kanäle',  value: '⏳ Wartet…', inline: true },
      { name: '✅ Gesamt',         value: '⏳ Läuft…',  inline: true },
    )
    .setFooter({ text: 'Nexus AI Omega v5 • Server Builder • Bitte warten…' });

  await interaction.editReply({ embeds: [progressEmbed], components: [] });

  const stats = {
    deleted: { channels: 0, categories: 0 },
    created: { roles: 0, categories: 0, textChannels: 0, voiceChannels: 0, otherChannels: 0 },
    errors: [] as string[],
  };

  // ════════════════════════════════════════════════════════════════
  // PHASE 1 — ALLES LÖSCHEN (nur wenn mode === 'delete_all')
  // ════════════════════════════════════════════════════════════════
  if (mode === 'delete_all') {
    progressEmbed.spliceFields(0, 1, { name: '🗑️ Löschung', value: '🔄 Läuft…', inline: true });
    await interaction.editReply({ embeds: [progressEmbed] });

    // Alle Kanäle (Text, Voice, Forum, Stage, Announcement) löschen
    const allChannels = guild.channels.cache.filter(
      c => c.type !== ChannelType.GuildCategory,
    );

    for (const [, channel] of allChannels) {
      try {
        await channel.delete('Nexus AI Server Builder — Neubau');
        stats.deleted.channels++;
      } catch (err) {
        stats.errors.push(`Kanal "${channel.name}" konnte nicht gelöscht werden`);
      }
      await sleep(300); // Rate-Limit vermeiden
    }

    // Alle Kategorien löschen (erst nachdem Kanäle weg sind)
    const allCategories = guild.channels.cache.filter(
      c => c.type === ChannelType.GuildCategory,
    );
    for (const [, category] of allCategories) {
      try {
        await category.delete('Nexus AI Server Builder — Neubau');
        stats.deleted.categories++;
      } catch (err) {
        stats.errors.push(`Kategorie "${category.name}" konnte nicht gelöscht werden`);
      }
      await sleep(300);
    }

    progressEmbed.spliceFields(0, 1, {
      name: '🗑️ Löschung',
      value: `✅ ${stats.deleted.channels} Kanäle\n✅ ${stats.deleted.categories} Kategorien`,
      inline: true,
    });
    await interaction.editReply({ embeds: [progressEmbed] });

    builderLogger.info(
      { guildId, deleted: stats.deleted },
      '🗑️ Alle Kanäle & Kategorien gelöscht',
    );
  }

  // ════════════════════════════════════════════════════════════════
  // PHASE 2 — ROLLEN ERSTELLEN
  // ════════════════════════════════════════════════════════════════
  progressEmbed.spliceFields(1, 1, { name: '🎨 Rollen', value: '🔄 Erstelle…', inline: true });
  await interaction.editReply({ embeds: [progressEmbed] });

  for (const roleDef of plan.roles ?? []) {
    try {
      // Im keep_add Modus: schauen ob Rolle bereits existiert
      if (mode === 'keep_add') {
        const exists = guild.roles.cache.find(
          r => r.name.toLowerCase() === roleDef.name.toLowerCase(),
        );
        if (exists) continue; // Rolle schon vorhanden → überspringen
      }

      const colorNum = parseInt(roleDef.color.replace('#', ''), 16);
      await guild.roles.create({
        name: roleDef.name,
        color: isNaN(colorNum) ? undefined : colorNum,
        hoist: roleDef.hoist ?? false,
        mentionable: roleDef.mentionable ?? false,
        permissions: buildPermissions(roleDef.permissions ?? []),
        reason: `Nexus AI Server Builder — ${plan.theme}`,
      });
      stats.created.roles++;
    } catch (err) {
      stats.errors.push(`Rolle "${roleDef.name}": ${(err as Error).message}`);
    }
    await sleep(200);
  }

  progressEmbed.spliceFields(1, 1, {
    name: '🎨 Rollen',
    value: `✅ ${stats.created.roles} erstellt`,
    inline: true,
  });
  await interaction.editReply({ embeds: [progressEmbed] });

  // ════════════════════════════════════════════════════════════════
  // PHASE 3 — KATEGORIEN & KANÄLE ERSTELLEN
  // ════════════════════════════════════════════════════════════════
  let catIndex = 0;

  for (const catDef of plan.categories ?? []) {
    catIndex++;
    try {
      // Im keep_add Modus: schauen ob Kategorie schon existiert
      let category: CategoryChannel | null = null;

      if (mode === 'keep_add') {
        category = guild.channels.cache.find(
          c =>
            c.type === ChannelType.GuildCategory &&
            c.name.toLowerCase() === catDef.name.toLowerCase(),
        ) as CategoryChannel | null;
      }

      if (!category) {
        category = await guild.channels.create({
          name: catDef.name.slice(0, 100),
          type: ChannelType.GuildCategory,
          reason: `Nexus AI Server Builder — ${plan.theme}`,
        }) as CategoryChannel;
        stats.created.categories++;
      }

      progressEmbed.spliceFields(2, 1, {
        name: '📂 Kategorien',
        value: `🔄 ${catIndex}/${plan.categories.length} — "${catDef.name}"`,
        inline: true,
      });
      await interaction.editReply({ embeds: [progressEmbed] });

      // Kanäle in dieser Kategorie erstellen
      for (const chDef of catDef.channels ?? []) {
        try {
          // Im keep_add Modus: schauen ob Kanal schon existiert
          if (mode === 'keep_add') {
            const safeName = sanitizeChannelName(chDef.name);
            const exists = guild.channels.cache.find(
              c => c.name.toLowerCase() === safeName.toLowerCase() &&
                   (c as GuildChannel).parentId === category!.id,
            );
            if (exists) continue;
          }

          const chType = resolveChannelType(chDef.type);
          const safeName = sanitizeChannelName(chDef.name);

          const createOpts: Parameters<typeof guild.channels.create>[0] = {
            name: safeName,
            type: chType,
            parent: category!.id,
            reason: `Nexus AI Server Builder — ${plan.theme}`,
          };

          if (chDef.topic && chType === ChannelType.GuildText) {
            (createOpts as Record<string, unknown>).topic = chDef.topic.slice(0, 1024);
          }
          if (chDef.slowmode && chType === ChannelType.GuildText) {
            (createOpts as Record<string, unknown>).rateLimitPerUser = chDef.slowmode;
          }
          if (chDef.nsfw && chType === ChannelType.GuildText) {
            (createOpts as Record<string, unknown>).nsfw = true;
          }

          await guild.channels.create(createOpts);

          // Statistiken je nach Typ
          if (chType === ChannelType.GuildVoice || chType === ChannelType.GuildStageVoice) {
            stats.created.voiceChannels++;
          } else if (chType === ChannelType.GuildText || chType === ChannelType.GuildAnnouncement) {
            stats.created.textChannels++;
          } else {
            stats.created.otherChannels++;
          }

          // Live Fortschritt aktualisieren
          progressEmbed.spliceFields(3, 1, {
            name: '💬 Text-Kanäle',
            value: `✅ ${stats.created.textChannels}`,
            inline: true,
          });
          progressEmbed.spliceFields(4, 1, {
            name: '🎙️ Voice-Kanäle',
            value: `✅ ${stats.created.voiceChannels}`,
            inline: true,
          });
          await interaction.editReply({ embeds: [progressEmbed] });

        } catch (err) {
          stats.errors.push(`Kanal "${chDef.name}": ${(err as Error).message}`);
        }

        await sleep(350); // Rate-Limit Puffer (Discord: max ~5 req/s pro Guild)
      }

    } catch (err) {
      stats.errors.push(`Kategorie "${catDef.name}": ${(err as Error).message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // PHASE 4 — ABSCHLUSSBERICHT
  // ════════════════════════════════════════════════════════════════
  const totalCreated =
    stats.created.textChannels +
    stats.created.voiceChannels +
    stats.created.otherChannels;

  const hasErrors  = stats.errors.length > 0;
  const modeLabel  = mode === 'delete_all' ? '🗑️ Alles gelöscht & neu gebaut' : '➕ Hinzugefügt';

  const finalEmbed = new EmbedBuilder()
    .setColor(hasErrors ? NexusColors.warning : NexusColors.success)
    .setTitle(
      hasErrors
        ? '⚠️ Server erfolgreich gebaut (mit kleinen Problemen)'
        : '✅ Server erfolgreich gebaut!',
    )
    .setDescription(
      `> **Thema:** ${plan.theme}\n` +
      `> **Stil:** ${plan.style}\n` +
      `> **Modus:** ${modeLabel}`,
    )
    .addFields(
      // Lösch-Statistik (nur bei delete_all)
      ...(mode === 'delete_all'
        ? [{
            name: '🗑️ Gelöscht',
            value:
              `› \`${stats.deleted.channels}\` Kanäle\n` +
              `› \`${stats.deleted.categories}\` Kategorien`,
            inline: true,
          }]
        : []),
      // Erstell-Statistik
      {
        name: '🏗️ Neu erstellt',
        value:
          `› \`${stats.created.roles}\` Rollen\n` +
          `› \`${stats.created.categories}\` Kategorien\n` +
          `› \`${stats.created.textChannels}\` Text-Kanäle\n` +
          `› \`${stats.created.voiceChannels}\` Voice-Kanäle\n` +
          `› \`${stats.created.otherChannels}\` Sonstige Kanäle`,
        inline: true,
      },
      // Farbpalette
      {
        name: '🎨 Farbpalette',
        value: plan.palette.map(c => `\`${c}\``).join(' '),
        inline: true,
      },
      // Fehler (falls vorhanden)
      ...(hasErrors
        ? [{
            name: `⚠️ Probleme (${stats.errors.length})`,
            value: stats.errors.slice(0, 5).map(e => `› ${e}`).join('\n').slice(0, 1024),
            inline: false,
          }]
        : []),
      // Nächste Schritte
      {
        name: '💡 Nächste Schritte',
        value:
          '› `/ticketsetup` — KI-Ticket-System einrichten\n' +
          '› `/setwelcome` — Willkommensnachricht konfigurieren\n' +
          '› `/setrules` — Regeln setzen\n' +
          '› `/setlogs` — Log-Kanal einrichten',
        inline: false,
      },
    )
    .setFooter({ text: `Nexus AI Omega v5 • Server Builder • Seed: ${plan.seed}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [finalEmbed], components: [] });

  builderLogger.info(
    {
      guildId,
      theme: plan.theme,
      mode,
      deleted: stats.deleted,
      created: stats.created,
      errors: stats.errors.length,
    },
    '✅ Server Build abgeschlossen',
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════════════════════

/** Kanal-Typ String → Discord ChannelType */
function resolveChannelType(type?: string): ChannelType {
  switch (type) {
    case 'voice':        return ChannelType.GuildVoice;
    case 'forum':        return ChannelType.GuildForum;
    case 'stage':        return ChannelType.GuildStageVoice;
    case 'announcement': return ChannelType.GuildAnnouncement;
    default:             return ChannelType.GuildText;
  }
}

/** Kanal-Namen für Discord bereinigen */
function sanitizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöü]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[c] ?? c)
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'kanal';
}

/** Berechtigungen aus String-Array bauen */
function buildPermissions(perms: string[]): PermissionsBitField {
  const bits = new PermissionsBitField();
  for (const p of perms) {
    if (p === '*' || p === 'ADMINISTRATOR') {
      bits.add(PermissionFlagsBits.Administrator);
      continue;
    }
    const key = p.toUpperCase().replace(/\s/g, '_') as keyof typeof PermissionFlagsBits;
    if (key in PermissionFlagsBits) {
      bits.add(PermissionFlagsBits[key] as bigint);
    }
  }
  return bits;
}

/** Rate-Limit freundliche Pause */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
