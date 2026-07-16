/**
 * Nexus AI Omega — /purge Command v5.0
 */
import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import { Embeds } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('🗑️ Nachrichten in Massen löschen')
    .addIntegerOption(o => o.setName('amount').setDescription('Anzahl (1–100)').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('Nur von diesem User (optional)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;
    if (!channel || !('bulkDelete' in channel)) {
      await interaction.editReply({ embeds: [Embeds.error('Fehler', 'Dieser Channel unterstützt kein Bulk-Delete.')] });
      return;
    }

    try {
      let messages = await channel.messages.fetch({ limit: amount });
      if (targetUser) messages = messages.filter(m => m.author.id === targetUser.id);

      // Bulk delete only works for messages < 14 days old
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const deletable = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

      const deleted = await channel.bulkDelete(deletable, true);

      await interaction.editReply({
        embeds: [Embeds.success(
          'Nachrichten gelöscht',
          `> **${deleted.size}** Nachrichten wurden gelöscht.${targetUser ? `\n> Gefiltert nach: ${targetUser.tag}` : ''}\n> ${messages.size - deleted.size > 0 ? `⚠️ ${messages.size - deleted.size} Nachrichten waren zu alt (> 14 Tage).` : ''}`,
        )],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [Embeds.error('Fehler', `Purge fehlgeschlagen: ${(err as Error).message}`)] });
    }
  },
};

export default command;
