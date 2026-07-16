/**
 * Nexus AI Omega — Bewerbungs-System v5.0
 * Übernommen & massiv upgraded von discord-bot-source
 * Neu: KI-Score-Analyse, 6 Positionen, Accept/Deny mit DM + DB
 */
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
} from 'discord.js';
import { dbGet, dbRun, setGuildSetting } from '../../services/database.js';
import { aiEngine } from '../../ai-center/aiEngine.js';
import { Embeds, NexusColors } from '../../utils/embeds.js';
import { applicationReviewEmbed } from '../../utils/embeds.js';
import type { NexusCommand } from '../events/interactionCreate.js';
import type { ApplicationReview } from '../../types/index.js';

// ── Positionen (aus Original + erweitert) ─────────────────────────────────────
export const POSITIONS = [
  { label: '🛡️ Moderator',       value: 'moderator',       description: 'Hilf beim Moderieren des Servers' },
  { label: '⚙️ Administrator',    value: 'administrator',   description: 'Verwalte den Server' },
  { label: '🎨 Designer',         value: 'designer',        description: 'Erstelle Designs für den Server' },
  { label: '📢 Supporter',        value: 'supporter',       description: 'Helfe Mitgliedern bei Fragen' },
  { label: '🎬 Content Creator',  value: 'content_creator', description: 'Erstelle Content für den Server' },
  { label: '🤝 Partner Manager',  value: 'partner_manager', description: 'Verwalte Server Partnerschaften' },
] as const;

export type PositionValue = (typeof POSITIONS)[number]['value'];

// ── /bewerbung-setup Command ──────────────────────────────────────────────────
export const bewerbungSetupCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('bewerbung-setup')
    .setDescription('📋 Bewerbungssystem einrichten')
    .addChannelOption(o =>
      o.setName('bewerbungs-kanal').setDescription('Kanal wo Bewerbungen ankommen').setRequired(true)
        .addChannelTypes(ChannelType.GuildText),
    )
    .addChannelOption(o =>
      o.setName('button-kanal').setDescription('Kanal für das Bewerbungs-Panel').setRequired(true)
        .addChannelTypes(ChannelType.GuildText),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const appChannel    = interaction.options.getChannel('bewerbungs-kanal', true) as import('discord.js').TextChannel;
    const buttonChannel = interaction.options.getChannel('button-kanal', true) as import('discord.js').TextChannel;

    await setGuildSetting(interaction.guildId!, 'application_channel', appChannel.id);

    // Select-Menü für Positionen
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('apply:position_select')
      .setPlaceholder('🎯 Wähle eine Position aus…')
      .addOptions(
        POSITIONS.map(p =>
          new StringSelectMenuOptionBuilder()
            .setLabel(p.label)
            .setValue(p.value)
            .setDescription(p.description),
        ),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await buttonChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.primary)
          .setTitle('📋 Team Bewerbung')
          .setDescription('Wähle unten die Position aus, für die du dich bewerben möchtest!\n\n> 🤖 **KI-Analyse:** Alle Bewerbungen werden automatisch bewertet.\n> Schreibe ausführlich und ehrlich für die besten Chancen!')
          .addFields(
            ...POSITIONS.map(p => ({ name: p.label, value: p.description, inline: true })),
          )
          .setFooter({ text: 'Bewerbungen werden von unserem Team & der Nexus KI geprüft.' })
          .setTimestamp(),
      ],
      components: [row],
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('✅ Bewerbungssystem eingerichtet!')
          .addFields(
            { name: '📋 Bewerbungs-Kanal', value: `${appChannel}`,    inline: true },
            { name: '🖱️ Panel-Kanal',      value: `${buttonChannel}`, inline: true },
            { name: '🤖 KI-Analyse',       value: '✅ Aktiv',          inline: true },
            { name: '📊 Positionen',       value: `${POSITIONS.length} verfügbar`, inline: true },
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Bewerbungssystem' }),
      ],
    });
  },
};

// ── Position auswählen → Modal öffnen ─────────────────────────────────────────
export async function handlePositionSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const positionValue = interaction.values[0] as PositionValue;
  const position = POSITIONS.find(p => p.value === positionValue);
  if (!position) {
    await interaction.reply({ embeds: [Embeds.error('Fehler', 'Ungültige Position.')], ephemeral: true });
    return;
  }

  // Rate-Limit: Max 1 Bewerbung alle 24h
  const existing = await dbGet(
    'SELECT id FROM applications WHERE guild_id = ? AND user_id = ? AND created_at > ?',
    interaction.guildId, interaction.user.id, Date.now() - 86_400_000,
  );
  if (existing) {
    await interaction.reply({
      embeds: [Embeds.warning('Rate Limit', 'Du kannst nur **eine Bewerbung** alle 24 Stunden einreichen.')],
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`apply:modal:${positionValue}`)
    .setTitle(`Bewerbung: ${position.label}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('q_name').setLabel('Wie heißt du? (Discord-Name)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('q_age').setLabel('Wie alt bist du?').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('q_why').setLabel(`Warum möchtest du ${position.label} werden?`).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('q_exp').setLabel('Welche Erfahrungen hast du?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('q_extra').setLabel('Sonstiges (Aktivität, Zeitzonen, etc.)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500),
      ),
    );

  await interaction.showModal(modal);
}

// ── Modal-Submit → KI-Analyse → Bewerbung senden ──────────────────────────────
export async function handleApplicationSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const positionValue = interaction.customId.replace('apply:modal:', '') as PositionValue;
  const position = POSITIONS.find(p => p.value === positionValue) ?? { label: 'Unbekannt', value: positionValue };

  await interaction.deferReply({ ephemeral: true });

  const fields: Record<string, string> = {
    Name:       interaction.fields.getTextInputValue('q_name'),
    Alter:      interaction.fields.getTextInputValue('q_age'),
    Motivation: interaction.fields.getTextInputValue('q_why'),
    Erfahrung:  interaction.fields.getTextInputValue('q_exp'),
    Sonstiges:  interaction.fields.getTextInputValue('q_extra') || 'Keine Angabe',
  };

  // KI-Analyse
  let review: ApplicationReview | null = null;
  try {
    review = await aiEngine.reviewApplication(fields, interaction.guildId!);

    // Quality-Gate: Score < 4 UND fehlende Felder → Ablehnen vor Erstellung
    if (review.overall < 4 && review.missingFields.length > 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.warning)
            .setTitle('⚠️ Bewerbung benötigt Verbesserungen')
            .setDescription(
              '> Die **Nexus KI** hat deine Bewerbung analysiert und Verbesserungsbedarf festgestellt.\n' +
              '> Bitte überarbeite deine Antworten und versuche es erneut.',
            )
            .addFields(
              { name: '❌ Fehlende Felder',          value: review.missingFields.map(f => `› \`${f}\``).join('\n') || 'Keine', inline: false },
              { name: '💡 Verbesserungsvorschläge',  value: review.improvements.map(i => `› ${i}`).join('\n').slice(0, 1024) || 'Keine', inline: false },
              { name: '🤖 KI-Feedback',              value: review.feedback.slice(0, 500), inline: false },
              { name: '⭐ Gesamtnote',               value: `\`${review.overall}/10\` — Minimum: \`4/10\``, inline: true },
            )
            .setFooter({ text: 'Nexus AI Omega v5 • Bewerbungs-KI' }),
        ],
      });
      return;
    }
  } catch {
    // KI-Fehler: trotzdem weiter
  }

  // In DB speichern
  const result = await dbRun(
    'INSERT INTO applications (guild_id, user_id, position, answers, created_at) VALUES (?, ?, ?, ?, ?)',
    interaction.guildId, interaction.user.id, positionValue, JSON.stringify(fields), Date.now(),
  );
  const appId = result.lastInsertRowid;

  // Bewerbungs-Kanal finden
  const settings = await dbGet('SELECT application_channel FROM guild_settings WHERE guild_id = ?', interaction.guildId);
  if (!settings?.['application_channel']) {
    await interaction.editReply({ embeds: [Embeds.error('Fehler', 'Kein Bewerbungs-Kanal konfiguriert. Bitte `/bewerbung-setup` ausführen.')] });
    return;
  }

  const appChannel = interaction.guild!.channels.cache.get(String(settings['application_channel'])) as import('discord.js').TextChannel | undefined;
  if (!appChannel) {
    await interaction.editReply({ embeds: [Embeds.error('Fehler', 'Bewerbungs-Kanal nicht gefunden.')] });
    return;
  }

  // Haupt-Embed
  const mainEmbed = new EmbedBuilder()
    .setColor(NexusColors.primary)
    .setTitle(`📋 Bewerbung #${appId} — ${position.label}`)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .addFields(
      { name: '🎯 Position', value: position.label,              inline: true },
      { name: '👤 Benutzer', value: `${interaction.user}`,       inline: true },
      { name: '🆔 User-ID',  value: `\`${interaction.user.id}\``, inline: true },
      ...Object.entries(fields).map(([k, v]) => ({ name: k, value: v.slice(0, 1024), inline: false })),
    )
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`apply:accept:${appId}`).setLabel('✅ Annehmen').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`apply:deny:${appId}`).setLabel('❌ Ablehnen').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`apply:consider:${appId}`).setLabel('🤔 Auf Warteliste').setStyle(ButtonStyle.Secondary),
  );

  // Embeds zusammenstellen
  const embeds = [mainEmbed];
  if (review) {
    embeds.push(applicationReviewEmbed(interaction.user.tag, position.label, review));
  }

  await appChannel.send({ embeds, components: [actionRow] });

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(NexusColors.success)
        .setTitle('✅ Bewerbung eingereicht!')
        .setDescription(
          `> Deine Bewerbung als **${position.label}** wurde erfolgreich eingereicht!\n` +
          `> Du wirst per DM benachrichtigt, sobald eine Entscheidung gefallen ist.\n\n` +
          `${review ? `> **KI-Score:** \`${review.overall}/10\` — ${review.recommendation.toUpperCase()}` : ''}`,
        )
        .setFooter({ text: 'Nexus AI Omega v5 • Bewerbungssystem' }),
    ],
  });
}

// ── Accept / Deny / Consider Buttons ──────────────────────────────────────────
export async function handleApplicationDecision(
  interaction: ButtonInteraction,
  decision: 'accepted' | 'denied' | 'consider',
  appId: string,
): Promise<void> {
  const app = await dbGet('SELECT * FROM applications WHERE id = ?', parseInt(appId));
  if (!app) {
    await interaction.reply({ embeds: [Embeds.error('Fehler', 'Bewerbung nicht gefunden.')], ephemeral: true });
    return;
  }

  await dbRun('UPDATE applications SET status = ? WHERE id = ?', decision, parseInt(appId));

  // DM an Bewerber
  const user = await interaction.client.users.fetch(String(app['user_id'])).catch(() => null);
  if (user) {
    const colors: Record<string, import('discord.js').ColorResolvable> = {
      accepted: NexusColors.success,
      denied:   NexusColors.error,
      consider: NexusColors.warning,
    };
    const titles: Record<string, string> = {
      accepted: '✅ Bewerbung angenommen! 🎉',
      denied:   '❌ Bewerbung abgelehnt',
      consider: '🤔 Bewerbung auf Warteliste',
    };
    const texts: Record<string, string> = {
      accepted: `Deine Bewerbung auf **${interaction.guild!.name}** wurde angenommen! Willkommen im Team! 🎊`,
      denied:   `Deine Bewerbung auf **${interaction.guild!.name}** wurde leider abgelehnt. Versuche es später erneut.`,
      consider: `Deine Bewerbung auf **${interaction.guild!.name}** wurde auf die Warteliste gesetzt. Wir melden uns!`,
    };

    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(colors[decision])
          .setTitle(titles[decision])
          .setDescription(texts[decision])
          .setTimestamp(),
      ],
    }).catch(() => {});
  }

  // Embed updaten
  const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(decision === 'accepted' ? NexusColors.success : decision === 'denied' ? NexusColors.error : NexusColors.warning)
    .setFooter({ text: `${decision === 'accepted' ? '✅ Angenommen' : decision === 'denied' ? '❌ Abgelehnt' : '🤔 Warteliste'} von ${interaction.user.tag} • Nexus AI Omega v5` });

  await interaction.update({ embeds: [updatedEmbed], components: [] });
}
