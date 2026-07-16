/**
 * Nexus AI Omega — AI Ticket System v5.0
 * Full redesign: 6 ticket types, AI analysis, rate limiting,
 * application quality gate, duplicate detection, auto-priority.
 */
import {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits,
  type ButtonInteraction, type ModalSubmitInteraction, type Guild, type GuildMember,
} from 'discord.js';
import { aiEngine } from '../../ai-center/aiEngine.js';
import { ticketLogger } from '../../services/logger.js';
import {
  ticketOpenedEmbed, applicationReviewEmbed, ticketActionRow,
  Embeds, NexusColors, PriorityColors,
} from '../../utils/embeds.js';
import { cacheGet, cacheSet } from '../../services/redisCache.js';
import { globalLogger } from '../../global/globalLogger.js';
import { statsAggregator } from '../../global/statisticsAggregator.js';
import { randomUUID } from 'node:crypto';
import type { TicketType, TicketPriority, ApplicationReview, SupportAnalysis } from '../../types/index.js';

// ── Ticket config ──────────────────────────────────────────────────────────────
const TICKET_CONFIG: Record<TicketType, { label: string; emoji: string; category: string; color: number }> = {
  bewerbung:     { label: 'Bewerbung',     emoji: '📋', category: '📋 BEWERBUNGEN',     color: 0xa855f7 },
  support:       { label: 'Support',       emoji: '🛠️', category: '🛠️ SUPPORT',         color: 0x0ea5e9 },
  feedback:      { label: 'Feedback',      emoji: '💡', category: '💡 FEEDBACK',          color: 0x06ffa5 },
  bug:           { label: 'Bug Report',    emoji: '🐞', category: '🐞 BUG REPORTS',       color: 0xf43f5e },
  partnerschaft: { label: 'Partnerschaft', emoji: '🤝', category: '🤝 PARTNERSCHAFTEN',  color: 0xfbbf24 },
  sonstiges:     { label: 'Sonstiges',     emoji: '❓', category: '❓ SONSTIGES',         color: 0x6b7280 },
};

// ── Ticket ID ─────────────────────────────────────────────────────────────────
function generateTicketId(type: TicketType): string {
  const prefix = type.slice(0, 3).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// ── Rate limit: 1 ticket per type per 24h ────────────────────────────────────
async function isRateLimited(userId: string, type: TicketType): Promise<boolean> {
  const key = `nexus:v5:rl:ticket:${userId}:${type}`;
  const exists = await cacheGet<boolean>(key);
  if (exists) return true;
  await cacheSet(key, true, 86_400);
  return false;
}

// ── Build modal for each ticket type ─────────────────────────────────────────
function buildModal(type: TicketType): ModalBuilder {
  const cfg = TICKET_CONFIG[type];
  const modal = new ModalBuilder()
    .setCustomId(`ticket:modal:${type}`)
    .setTitle(`${cfg.emoji} ${cfg.label}`);

  const row = <T extends TextInputBuilder>(comp: T) =>
    new ActionRowBuilder<T>().addComponents(comp);

  switch (type) {
    case 'bewerbung':
      return modal.addComponents(
        row(new TextInputBuilder().setCustomId('discord_name').setLabel('Discord Name & Tag').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('z.B. YourName oder @yourname')),
        row(new TextInputBuilder().setCustomId('alter_erfahrung').setLabel('Alter & Erfahrung').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800).setPlaceholder('Alter: 18\nErfahrung: 2 Jahre Moderator auf Server X mit 5.000 Mitgliedern…')),
        row(new TextInputBuilder().setCustomId('gewuenschte_rolle').setLabel('Gewünschte Rolle & Begründung').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800).setPlaceholder('Welche Rolle möchtest du, und warum passt du dazu?')),
        row(new TextInputBuilder().setCustomId('warum_wir').setLabel('Warum sollten wir dich nehmen?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800).setPlaceholder('Was macht dich besonders? Was kannst du beitragen?')),
        row(new TextInputBuilder().setCustomId('aktivitaet').setLabel('Aktivität & Verfügbarkeit').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300).setPlaceholder('Wie viele Stunden täglich? Wann bist du erreichbar?')),
      );

    case 'support':
      return modal.addComponents(
        row(new TextInputBuilder().setCustomId('name').setLabel('Dein Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('Wie sollen wir dich nennen?')),
        row(new TextInputBuilder().setCustomId('kategorie').setLabel('Kategorie').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('z.B. Bot-Fehler, Rolle, Channel, Account, Zahlung…')),
        row(new TextInputBuilder().setCustomId('problem').setLabel('Problem-Beschreibung').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Beschreibe das Problem so genau wie möglich…')),
        row(new TextInputBuilder().setCustomId('bereits_versucht').setLabel('Was hast du bereits versucht?').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500).setPlaceholder('Hast du schon Lösungen ausprobiert?')),
        row(new TextInputBuilder().setCustomId('screenshot').setLabel('Screenshot / Fehlermeldung (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500).setPlaceholder('Link zu Screenshot oder Fehlermeldungstext')),
      );

    case 'feedback':
      return modal.addComponents(
        row(new TextInputBuilder().setCustomId('bereich').setLabel('Bereich / Feature').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150).setPlaceholder('Worüber möchtest du Feedback geben?')),
        row(new TextInputBuilder().setCustomId('bewertung').setLabel('Bewertung (1–10) + Begründung').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50).setPlaceholder('z.B. 8/10 — sehr gut, aber…')),
        row(new TextInputBuilder().setCustomId('feedback').setLabel('Dein Feedback').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Teile uns dein Feedback mit. Je detaillierter, desto hilfreicher!')),
        row(new TextInputBuilder().setCustomId('verbesserung').setLabel('Verbesserungsvorschlag').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500).setPlaceholder('Wie könnten wir es besser machen?')),
      );

    case 'bug':
      return modal.addComponents(
        row(new TextInputBuilder().setCustomId('bug_title').setLabel('Bug-Titel').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150).setPlaceholder('Kurze Beschreibung des Fehlers')),
        row(new TextInputBuilder().setCustomId('beschreibung').setLabel('Fehlerbeschreibung').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Was passiert genau? Was wird erwartet? Wann tritt es auf?')),
        row(new TextInputBuilder().setCustomId('schritte').setLabel('Schritte zum Reproduzieren').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500).setPlaceholder('1. Öffne…\n2. Klicke auf…\n3. Fehler tritt auf…')),
        row(new TextInputBuilder().setCustomId('umgebung').setLabel('Umgebung (OS, Browser, Version)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200).setPlaceholder('z.B. Windows 11, Chrome 125, App v2.4')),
        row(new TextInputBuilder().setCustomId('screenshot').setLabel('Screenshot / Video-Link (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500).setPlaceholder('Link zu Beweis-Material')),
      );

    case 'partnerschaft':
      return modal.addComponents(
        row(new TextInputBuilder().setCustomId('server_name').setLabel('Server-Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150).setPlaceholder('Name deines Discord-Servers')),
        row(new TextInputBuilder().setCustomId('server_info').setLabel('Mitglieder & Thema').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500).setPlaceholder('Anzahl Mitglieder, Server-Thema, Sprache, Zielgruppe…')),
        row(new TextInputBuilder().setCustomId('angebot').setLabel('Dein Partnerschafts-Angebot').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500).setPlaceholder('Was bietest du als Partner an? (Werbung, Events, gemeinsame Aktionen…)')),
        row(new TextInputBuilder().setCustomId('invite_link').setLabel('Server-Invite-Link').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200).setPlaceholder('https://discord.gg/…')),
      );

    default: // sonstiges
      return modal.addComponents(
        row(new TextInputBuilder().setCustomId('betreff').setLabel('Betreff').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150).setPlaceholder('Worum geht es?')),
        row(new TextInputBuilder().setCustomId('nachricht').setLabel('Deine Nachricht').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Schreibe alles, was du uns mitteilen möchtest…')),
        row(new TextInputBuilder().setCustomId('kontakt').setLabel('Kontakt (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200).setPlaceholder('E-Mail oder andere Kontaktmöglichkeit')),
      );
  }
}

// ── Handle ticket button ──────────────────────────────────────────────────────
export async function handleTicketButton(interaction: ButtonInteraction): Promise<void> {
  const type = interaction.customId.split(':')[2] as TicketType;
  if (!TICKET_CONFIG[type]) return;

  const limited = await isRateLimited(interaction.user.id, type);
  if (limited) {
    await interaction.reply({
      embeds: [Embeds.warning('Rate Limit', `Du kannst nur **1 ${TICKET_CONFIG[type].label}**-Ticket alle 24 Stunden erstellen.`)],
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(buildModal(type));
}

// ── Handle modal submit ────────────────────────────────────────────────────────
export async function handleTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  const type = interaction.customId.split(':')[2] as TicketType;
  if (!TICKET_CONFIG[type]) return;

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild as Guild;
  const member = interaction.member as GuildMember;
  const cfg = TICKET_CONFIG[type];
  const ticketId = generateTicketId(type);

  // Collect fields
  const fields: Record<string, string> = {};
  for (const component of interaction.components) {
    for (const field of component.components) {
      if ('value' in field) fields[field.customId] = field.value as string;
    }
  }

  ticketLogger.info({ ticketId, type, userId: interaction.user.id, guildId: guild.id }, '🎫 Ticket opened');

  // ── AI Analysis ────────────────────────────────────────────────────────────
  let aiSummary = '';
  let priority: TicketPriority = 'medium';
  let appReview: ApplicationReview | null = null;

  try {
    if (type === 'bewerbung') {
      appReview = await aiEngine.reviewApplication(fields, guild.id);

      // Quality gate: block if overall < 4 AND missing fields
      if (appReview.overall < 4 && appReview.missingFields.length > 0) {
        const improveEmbed = new EmbedBuilder()
          .setColor(NexusColors.warning)
          .setTitle('⚠️ Bewerbung benötigt Verbesserungen')
          .setDescription(
            '> **Die KI hat deine Bewerbung analysiert und Verbesserungsbedarf festgestellt.**\n' +
            '> Bitte überarbeite deine Antworten und versuche es erneut.',
          )
          .addFields(
            { name: '❌ Fehlende / unvollständige Felder', value: appReview.missingFields.map(f => `› \`${f}\``).join('\n') || 'Keine', inline: false },
            { name: '💡 Verbesserungsvorschläge',           value: appReview.improvements.map(i => `› ${i}`).join('\n').slice(0, 1024) || 'Keine', inline: false },
            { name: '🤖 KI-Feedback',                       value: appReview.feedback.slice(0, 800), inline: false },
            { name: `⭐ Gesamtnote`,                        value: `\`${appReview.overall}/10\` — Minimum: \`4/10\``, inline: true },
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Application Quality Check' });

        await interaction.editReply({ embeds: [improveEmbed] });
        return;
      }

      aiSummary = `KI-Score: ${appReview.overall}/10 — ${appReview.recommendation.toUpperCase()}`;
      priority = appReview.overall >= 8 ? 'high' : appReview.overall >= 5 ? 'medium' : 'low';

    } else if (type === 'support' || type === 'bug') {
      const analysisResult = await aiEngine.infer({
        module: 'AI_TICKET_SYSTEM',
        prompt: `Analyze this ${type} ticket and return ONLY valid JSON:
${JSON.stringify(fields, null, 2)}

JSON format: {
  "priority": "low"|"medium"|"high"|"critical",
  "category": "string (max 50 chars)",
  "summary": "one clear sentence describing the issue",
  "possibleSolutions": ["solution 1", "solution 2", "solution 3"],
  "duplicate": false,
  "estimatedResolutionTime": "e.g. 30 minutes",
  "requiredInfo": ["any missing info needed"]
}`,
        guildId: guild.id,
        userId: interaction.user.id,
        maxTokens: 500,
        temperature: 0.1,
      });

      try {
        const match = String(analysisResult.text).match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as SupportAnalysis;
          priority = parsed.priority ?? 'medium';
          aiSummary = parsed.summary ?? '';
          if (parsed.possibleSolutions?.length) {
            aiSummary += `\n\n**💡 Mögliche Lösungen:**\n${parsed.possibleSolutions.slice(0, 3).map(s => `› ${s}`).join('\n')}`;
          }
          if (parsed.estimatedResolutionTime) {
            aiSummary += `\n\n**⏱️ Geschätzte Lösung:** ${parsed.estimatedResolutionTime}`;
          }
        }
      } catch { /* use defaults */ }
    }
  } catch (err) {
    ticketLogger.warn({ err, ticketId }, 'AI analysis failed — continuing without AI summary');
  }

  // ── Create ticket channel ──────────────────────────────────────────────────
  try {
    // Find or create category
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.includes(cfg.category),
    );
    if (!category) {
      category = await guild.channels.create({
        name: cfg.category,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] }],
      });
    }

    // Create ticket channel
    const channelName = `${cfg.emoji}${type}-${ticketId.split('-')[2]}`.replace(/[^a-z0-9\-]/gi, '').toLowerCase();
    const channel = await guild.channels.create({
      name: channelName.slice(0, 100),
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Ticket ${ticketId} | ${type} | ${interaction.user.tag} | Priorität: ${priority}`,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
      ],
    });

    // Build field embed
    const fieldEmbed = new EmbedBuilder()
      .setColor(cfg.color as import('discord.js').ColorResolvable)
      .setTitle(`📋 Ticket-Details — ${cfg.emoji} ${cfg.label}`)
      .addFields(
        Object.entries(fields).slice(0, 25).map(([k, v]) => ({
          name: `📝 ${k.replace(/_/g, ' ')}`,
          value: (v || '*Keine Angabe*').slice(0, 1024),
          inline: false,
        })),
      )
      .setFooter({ text: `Ticket ID: ${ticketId}` })
      .setTimestamp();

    // Send to ticket channel
    await channel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [ticketOpenedEmbed(cfg.label, interaction.user.id, ticketId, priority, aiSummary), fieldEmbed],
      components: [ticketActionRow(ticketId)],
    });

    // Send application review in channel if exists
    if (type === 'bewerbung' && appReview) {
      const reviewEmbed = applicationReviewEmbed(
        interaction.user.tag,
        fields.gewuenschte_rolle ?? 'Team',
        appReview,
      );
      await channel.send({ embeds: [reviewEmbed] });
    }

    // Reply to user
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle(`${cfg.emoji} Ticket erstellt — ${cfg.label}`)
          .setDescription(
            `> Dein Ticket wurde erstellt: ${channel}\n` +
            `> **Ticket-ID:** \`${ticketId}\`\n` +
            `> **Priorität:** \`${priority.toUpperCase()}\`\n\n` +
            `> Unser Team wird sich so schnell wie möglich bei dir melden.`,
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Ticket System' }),
      ],
    });

    await globalLogger.log({
      eventType: 'TICKET_OPEN',
      severity: 'info',
      guildId: guild.id,
      guildName: guild.name,
      userId: interaction.user.id,
      username: interaction.user.tag,
      channelId: channel.id,
      channelName: channel.name,
      action: 'TICKET_CREATED',
      result: `${type} ticket created`,
      metadata: { ticketId, priority, type, aiAnalyzed: !!aiSummary },
    });

    ticketLogger.info({ ticketId, channelId: channel.id, priority }, '✅ Ticket channel created');
    statsAggregator.inc('ticketsToday');
  } catch (err) {
    ticketLogger.error({ err, ticketId }, '❌ Ticket channel creation failed');
    await interaction.editReply({ embeds: [Embeds.error('Fehler', 'Das Ticket konnte nicht erstellt werden. Bitte versuche es erneut.')] });
  }
}

// ── Handle ticket close ────────────────────────────────────────────────────────
export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const ticketId = interaction.customId.split(':')[2];

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(NexusColors.warning)
        .setTitle('🔒 Ticket wird geschlossen…')
        .setDescription(`> Ticket \`${ticketId}\` wird in **5 Sekunden** archiviert.\n> Erstellt von: ${interaction.user.tag}`),
    ],
  });

  await globalLogger.log({
    eventType: 'TICKET_CLOSE',
    severity: 'info',
    guildId: interaction.guildId ?? '',
    userId: interaction.user.id,
    username: interaction.user.tag,
    action: 'TICKET_CLOSED',
    metadata: { ticketId },
  });

  setTimeout(async () => {
    try {
      if (interaction.channel && 'delete' in interaction.channel) {
        await (interaction.channel as { delete: (reason: string) => Promise<void> }).delete(
          `Ticket ${ticketId} closed by ${interaction.user.tag}`,
        );
      }
    } catch { /* already deleted */ }
  }, 5000);
}

// ── Handle ticket claim ────────────────────────────────────────────────────────
export async function handleTicketClaim(interaction: ButtonInteraction): Promise<void> {
  const ticketId = interaction.customId.split(':')[2];

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(NexusColors.success)
        .setTitle('✋ Ticket angenommen')
        .setDescription(`> ${interaction.user} hat dieses Ticket angenommen.\n> **Ticket-ID:** \`${ticketId}\``),
    ],
  });

  // Update channel topic to show claimed status
  if (interaction.channel && 'setTopic' in interaction.channel) {
    const ch = interaction.channel as { topic?: string; setTopic: (topic: string) => Promise<void> };
    const current = ch.topic ?? '';
    await ch.setTopic(`${current} | Angenommen von: ${interaction.user.tag}`).catch(() => {});
  }
}
