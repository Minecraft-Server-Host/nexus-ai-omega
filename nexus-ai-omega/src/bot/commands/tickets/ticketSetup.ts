/**
 * Nexus AI Omega — Ticket Setup Command v5.0
 * Übernommen & massiv upgraded von discord-bot-source
 * Neue Features: 6 Ticket-Typen, KI-Analyse, Rate-Limiting, Auto-Priority
 */
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';
import { ticketPanelEmbed, ticketButtonRows, Embeds, NexusColors } from '../../utils/embeds.js';
import { setGuildSetting } from '../../services/database.js';
import type { NexusCommand } from '../events/interactionCreate.js';
import { EmbedBuilder } from 'discord.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('🎫 KI-Ticket-System einrichten')
    .addChannelOption(o =>
      o.setName('kanal').setDescription('Kanal für das Ticket-Panel').setRequired(true)
        .addChannelTypes(ChannelType.GuildText),
    )
    .addRoleOption(o =>
      o.setName('support-rolle').setDescription('Support-Rolle (erhält Zugriff auf Tickets)').setRequired(true),
    )
    .addChannelOption(o =>
      o.setName('kategorie').setDescription('Kategorie für Ticket-Kanäle (optional)')
        .addChannelTypes(ChannelType.GuildCategory),
    )
    .addStringOption(o =>
      o.setName('titel').setDescription('Titel des Panels (optional)').setMaxLength(100),
    )
    .addStringOption(o =>
      o.setName('beschreibung').setDescription('Beschreibung des Panels (optional)').setMaxLength(500),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const channel     = interaction.options.getChannel('kanal', true) as import('discord.js').TextChannel;
    const role        = interaction.options.getRole('support-rolle', true);
    const category    = interaction.options.getChannel('kategorie') as import('discord.js').CategoryChannel | null;
    const titel       = interaction.options.getString('titel') ?? '🎫 Support Center';
    const description = interaction.options.getString('beschreibung');

    // Einstellungen speichern
    await setGuildSetting(interaction.guildId!, 'ticket_support_role', role.id);
    await setGuildSetting(interaction.guildId!, 'ticket_category', category?.id ?? null);

    // Panel senden
    const panelEmbed = ticketPanelEmbed(titel, description ?? undefined);
    const rows = ticketButtonRows();

    try {
      await channel.send({ embeds: [panelEmbed], components: rows });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.success)
            .setTitle('✅ Ticket-System eingerichtet!')
            .setDescription(
              `> **Kanal:** ${channel}\n` +
              `> **Support-Rolle:** ${role}\n` +
              `> **Kategorie:** ${category ?? '`Automatisch erstellt`'}\n\n` +
              `> **6 Ticket-Typen verfügbar:**\n` +
              `> 📋 Bewerbung · 🛠️ Support · 💡 Feedback\n` +
              `> 🐞 Bug Report · 🤝 Partnerschaft · ❓ Sonstiges\n\n` +
              `> **KI-Funktionen aktiv:**\n` +
              `> › Bewerbungsanalyse (Score 0–10)\n` +
              `> › Prioritätsvergabe\n` +
              `> › Duplikat-Erkennung\n` +
              `> › Lösungs-Vorschläge`,
            )
            .setFooter({ text: 'Nexus AI Omega v5 • Ticket System' })
            .setTimestamp(),
        ],
      });
    } catch (err) {
      await interaction.editReply({
        embeds: [Embeds.error('Fehler', `Panel konnte nicht gesendet werden: ${(err as Error).message}`)],
      });
    }
  },
};

export default command;
