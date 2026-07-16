/**
 * Nexus AI Omega — /setlogs Command v5.0
 */
import {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
  type ChatInputCommandInteraction, EmbedBuilder,
} from 'discord.js';
import { Embeds, NexusColors } from '../../../utils/embeds.js';
import { findChannel } from '../../systems/autoSetup.js';
import { cacheGet, cacheSet } from '../../../services/redisCache.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('📊 Log-Kanal einrichten (automatisch oder manuell)')
    .addChannelOption(o =>
      o.setName('kanal').setDescription('Log-Kanal (leer = automatisch erkennen)').addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(o =>
      o.setName('events').setDescription('Welche Events loggen?').addChoices(
        { name: '📊 Alles (Standard)', value: 'all' },
        { name: '🛡️ Nur Moderation', value: 'moderation' },
        { name: '🚨 Nur Security', value: 'security' },
        { name: '👥 Nur Mitglieder', value: 'members' },
        { name: '💬 Nachrichten', value: 'messages' },
      )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const manualChannel = interaction.options.getChannel('kanal') as import('discord.js').TextChannel | null;
    const events = interaction.options.getString('events') ?? 'all';

    const targetChannel = manualChannel ?? findChannel(guild, 'logs') ?? findChannel(guild, 'modlog');

    if (!targetChannel) {
      await interaction.editReply({
        embeds: [Embeds.error('Kein Log-Kanal gefunden',
          '> Erstelle einen Kanal namens `logs`, `log`, `mod-log`, `audit-log` o.ä.\n> Oder gib einen manuell an.')],
      });
      return;
    }

    const config = await cacheGet<Record<string, unknown>>(`nexus:v5:guild:${guild.id}:config`) ?? {};
    config.logChannelId = targetChannel.id;
    config.logEvents = events;
    await cacheSet(`nexus:v5:guild:${guild.id}:config`, config, 86_400 * 7);

    const eventLabels: Record<string, string> = {
      all: 'Alle Events',
      moderation: 'Nur Moderationsaktionen (Ban, Kick, Timeout, Warn)',
      security: 'Nur Sicherheits-Alerts (Raid, Phishing, Nuke)',
      members: 'Mitglieder-Events (Join, Leave)',
      messages: 'Nachrichten-Events (Edit, Delete)',
    };

    await (targetChannel as import('discord.js').TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.ai)
          .setTitle('📊 Nexus Log-System aktiviert')
          .setDescription(
            `> Dieser Kanal wurde als **Log-Kanal** konfiguriert.\n` +
            `> **Geloggte Events:** ${eventLabels[events] ?? events}\n\n` +
            `> Alle konfigurierten Events werden hier protokolliert.`
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Logging System' })
          .setTimestamp(),
      ],
    }).catch(() => {});

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('✅ Log-System konfiguriert')
          .addFields(
            { name: '📊 Kanal', value: `${targetChannel}`, inline: true },
            { name: '📋 Events', value: eventLabels[events] ?? events, inline: true },
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Log System' })
          .setTimestamp(),
      ],
    });
  },
};

export default command;
