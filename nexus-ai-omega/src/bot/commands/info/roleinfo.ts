/**
 * Nexus AI Omega — /roleinfo Command v5.0
 */
import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { NexusColors } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('🎭 Informationen über eine Rolle anzeigen')
    .addRoleOption(o => o.setName('rolle').setDescription('Rolle auswählen').setRequired(true))
    .setDMPermission(false),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const role = interaction.options.getRole('rolle', true);
    const guildRole = await interaction.guild!.roles.fetch(role.id);
    if (!guildRole) { await interaction.reply({ content: '❌ Rolle nicht gefunden.', ephemeral: true }); return; }

    const members = guildRole.members.size;
    const perms = guildRole.permissions.toArray().slice(0, 10).join(', ') || 'Keine';
    const color = guildRole.hexColor !== '#000000' ? guildRole.hexColor : '#6b7280';

    const embed = new EmbedBuilder()
      .setColor(color as import('discord.js').ColorResolvable)
      .setTitle(`🎭 Rollen-Info — ${guildRole.name}`)
      .addFields(
        { name: '🆔 Rollen-ID',     value: `\`${guildRole.id}\``,                       inline: true },
        { name: '🎨 Farbe',          value: `\`${color}\``,                              inline: true },
        { name: '📍 Position',       value: `\`${guildRole.position}\``,                 inline: true },
        { name: '👥 Mitglieder',     value: `\`${members.toLocaleString('de-DE')}\``,    inline: true },
        { name: '📌 Angeheftet',     value: guildRole.hoist ? '✅ Ja' : '❌ Nein',       inline: true },
        { name: '💬 Erwähnbar',      value: guildRole.mentionable ? '✅ Ja' : '❌ Nein', inline: true },
        { name: '🤖 Verwaltet',      value: guildRole.managed ? '✅ (Bot/Integration)' : '❌ Nein', inline: true },
        { name: '📅 Erstellt',       value: `<t:${Math.floor(guildRole.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '🔑 Berechtigungen', value: `\`${perms}\``, inline: false },
      )
      .setFooter({ text: 'Nexus AI Omega v5 • Role Info' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
export default command;
