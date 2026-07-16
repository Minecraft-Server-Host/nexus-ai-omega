/**
 * Nexus AI Omega — Ticket Commands v5.0
 * /close /add /remove /claim /unclaim /transcript
 * Übernommen & upgraded von discord-bot-source
 */
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { dbGet, dbRun } from '../../services/database.js';
import { globalLogger } from '../../global/globalLogger.js';
import { Embeds, NexusColors } from '../../utils/embeds.js';
import type { NexusCommand } from '../events/interactionCreate.js';

// ── /close ────────────────────────────────────────────────────────────────────
export const closeCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('🔒 Aktuelles Ticket schließen')
    .addStringOption(o =>
      o.setName('grund').setDescription('Schließungs-Grund (optional)').setMaxLength(300),
    )
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ticket = await dbGet(
      'SELECT * FROM tickets WHERE channel_id = ? AND status = ?',
      interaction.channelId, 'open',
    );

    if (!ticket) {
      await interaction.reply({ embeds: [Embeds.error('Kein Ticket', 'Dies ist kein offenes Ticket.')], ephemeral: true });
      return;
    }

    const grund = interaction.options.getString('grund') ?? 'Kein Grund angegeben';
    await interaction.deferReply();

    // Transcript erstellen
    const messages = await interaction.channel!.messages.fetch({ limit: 100 });
    const transcript = [...messages.values()]
      .reverse()
      .map(m => `[${new Date(m.createdTimestamp).toLocaleString('de-DE')}] ${m.author.tag}: ${m.content || '[Embed/Anhang]'}`)
      .join('\n');

    // Ticket in DB schließen
    await dbRun(
      'UPDATE tickets SET status = ?, transcript = ?, closed_at = ? WHERE id = ?',
      'closed', transcript, Date.now(), ticket['id'],
    );

    // Creator per DM benachrichtigen
    const creator = await interaction.client.users.fetch(String(ticket['user_id'])).catch(() => null);
    if (creator) {
      await creator.send({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.error)
            .setTitle('🔒 Dein Ticket wurde geschlossen')
            .addFields(
              { name: '🏰 Server', value: interaction.guild!.name, inline: true },
              { name: '📝 Grund', value: grund, inline: true },
              { name: '🛡️ Geschlossen von', value: interaction.user.tag, inline: true },
            )
            .setTimestamp(),
        ],
      }).catch(() => {});
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.warning)
          .setTitle('🔒 Ticket wird geschlossen…')
          .setDescription(`> **Grund:** ${grund}\n> Kanal wird in **5 Sekunden** gelöscht.`),
      ],
    });

    await globalLogger.log({
      eventType: 'TICKET_CLOSE',
      severity: 'info',
      guildId: interaction.guildId!,
      guildName: interaction.guild!.name,
      userId: interaction.user.id,
      username: interaction.user.tag,
      action: 'TICKET_CLOSED',
      reason: grund,
      metadata: { ticketId: ticket['id'], channelId: interaction.channelId },
    });

    setTimeout(() => interaction.channel?.delete().catch(() => {}), 5000);
  },
};

// ── /add ─────────────────────────────────────────────────────────────────────
export const addCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('➕ Benutzer zum Ticket hinzufügen')
    .addUserOption(o => o.setName('benutzer').setDescription('Benutzer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ticket = await dbGet('SELECT * FROM tickets WHERE channel_id = ?', interaction.channelId);
    if (!ticket) {
      await interaction.reply({ embeds: [Embeds.error('Fehler', 'Dies ist kein Ticket-Kanal.')], ephemeral: true });
      return;
    }

    const member = interaction.options.getMember('benutzer') as import('discord.js').GuildMember;
    await interaction.channel!.permissionOverwrites.edit(member, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setDescription(`✅ ${member} wurde zum Ticket hinzugefügt.`),
      ],
    });
  },
};

// ── /remove ───────────────────────────────────────────────────────────────────
export const removeCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('➖ Benutzer aus Ticket entfernen')
    .addUserOption(o => o.setName('benutzer').setDescription('Benutzer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ticket = await dbGet('SELECT * FROM tickets WHERE channel_id = ?', interaction.channelId);
    if (!ticket) {
      await interaction.reply({ embeds: [Embeds.error('Fehler', 'Dies ist kein Ticket-Kanal.')], ephemeral: true });
      return;
    }

    const member = interaction.options.getMember('benutzer') as import('discord.js').GuildMember;
    await interaction.channel!.permissionOverwrites.edit(member, { ViewChannel: false });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.error)
          .setDescription(`✅ ${member} wurde aus dem Ticket entfernt.`),
      ],
    });
  },
};

// ── /claim ────────────────────────────────────────────────────────────────────
export const claimCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('✋ Ticket übernehmen')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ticket = await dbGet(
      'SELECT * FROM tickets WHERE channel_id = ? AND status = ?',
      interaction.channelId, 'open',
    );
    if (!ticket) {
      await interaction.reply({ embeds: [Embeds.error('Fehler', 'Kein offenes Ticket in diesem Kanal.')], ephemeral: true });
      return;
    }

    await dbRun('UPDATE tickets SET claimed_by = ?, status = ? WHERE channel_id = ?',
      interaction.user.id, 'claimed', interaction.channelId);

    await interaction.channel!.permissionOverwrites.edit(interaction.user, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true,
    });

    // Kanal-Topic updaten
    if ('setTopic' in interaction.channel!) {
      await (interaction.channel as import('discord.js').TextChannel)
        .setTopic(`Ticket von <@${ticket['user_id']}> | Übernommen von ${interaction.user.tag}`)
        .catch(() => {});
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('✅ Ticket übernommen!')
          .setDescription(`> ${interaction.user} ist jetzt für dieses Ticket zuständig!\n> Bitte helfe dem User so schnell wie möglich.`)
          .setTimestamp(),
      ],
    });
  },
};

// ── /unclaim ──────────────────────────────────────────────────────────────────
export const unclaimCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('unclaim')
    .setDescription('🔄 Ticket abgeben')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ticket = await dbGet('SELECT * FROM tickets WHERE channel_id = ? AND status = ?',
      interaction.channelId, 'claimed');
    if (!ticket) {
      await interaction.reply({ embeds: [Embeds.error('Fehler', 'Kein claimed Ticket in diesem Kanal.')], ephemeral: true });
      return;
    }

    await dbRun('UPDATE tickets SET claimed_by = NULL, status = ? WHERE channel_id = ?', 'open', interaction.channelId);
    await interaction.channel!.permissionOverwrites.delete(interaction.user).catch(() => {});

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.warning)
          .setTitle('🔄 Ticket abgegeben')
          .setDescription(`> ${interaction.user} hat das Ticket abgegeben.\n> Es kann jetzt von jemand anderem übernommen werden.`)
          .setTimestamp(),
      ],
    });
  },
};

// ── /transcript ───────────────────────────────────────────────────────────────
export const transcriptCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('📄 Ticket-Transcript erstellen')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ticket = await dbGet('SELECT * FROM tickets WHERE channel_id = ?', interaction.channelId);
    if (!ticket) {
      await interaction.reply({ embeds: [Embeds.error('Fehler', 'Kein Ticket in diesem Kanal.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const messages = await interaction.channel!.messages.fetch({ limit: 100 });
    const transcript = [...messages.values()]
      .reverse()
      .map(m => `[${new Date(m.createdTimestamp).toLocaleString('de-DE')}] ${m.author.tag}: ${m.content || '[Embed/Anhang]'}`)
      .join('\n');

    const buffer = Buffer.from(transcript, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, {
      name: `transcript-${interaction.channelId}.txt`,
    });

    await interaction.editReply({
      embeds: [Embeds.success('📄 Transcript erstellt', '> Der Transcript wurde als Datei angehängt.')],
      files: [attachment],
    });
  },
};
