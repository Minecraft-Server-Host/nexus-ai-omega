/**
 * Nexus AI Omega — /avatar Command v5.0
 */
import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { NexusColors } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('🖼️ Profilbild eines Users anzeigen')
    .addUserOption(o => o.setName('user').setDescription('User (leer = du selbst)')),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;

    const globalAvatar = target.displayAvatarURL({ size: 4096, extension: 'png' });
    const serverAvatar = member?.avatarURL({ size: 4096, extension: 'png' });

    const embed = new EmbedBuilder()
      .setColor(NexusColors.primary)
      .setTitle(`🖼️ Avatar — ${target.tag}`)
      .setImage(serverAvatar ?? globalAvatar)
      .setFooter({ text: 'Nexus AI Omega v5 • Avatar' })
      .setTimestamp();

    if (serverAvatar && serverAvatar !== globalAvatar) {
      embed.setDescription(`> [Globaler Avatar](${globalAvatar}) | [Server-Avatar](${serverAvatar})`);
    } else {
      embed.setDescription(`> [Avatar herunterladen](${globalAvatar})`);
    }

    await interaction.reply({ embeds: [embed] });
  },
};
export default command;
