/**
 * Nexus AI Omega — /timeout Command v5.0
 */
import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { globalLogger } from '../../../global/globalLogger.js';
import { Embeds, NexusColors } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('⏰ Timeout für ein Mitglied setzen')
    .addUserOption(o => o.setName('user').setDescription('Ziel-User').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Minuten (1–40320)').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Begründung').setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') ?? 'Kein Grund angegeben';

    await interaction.deferReply({ ephemeral: true });

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.editReply({ embeds: [Embeds.error('Nicht gefunden', 'User nicht auf diesem Server.')] });
      return;
    }
    if (!member.moderatable) {
      await interaction.editReply({ embeds: [Embeds.error('Keine Berechtigung', 'Dieser User kann nicht getimeoutet werden.')] });
      return;
    }

    try {
      await member.timeout(minutes * 60 * 1000, `${reason} | von ${interaction.user.tag}`);

      const durationText = minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${minutes}m`;

      const embed = new EmbedBuilder()
        .setColor(NexusColors.warning)
        .setTitle('⏰ Timeout gesetzt')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '👤 User',       value: `${target.tag}\n\`${target.id}\``,                         inline: true },
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`,                                  inline: true },
          { name: '⏱️ Dauer',     value: `\`${durationText}\``,                                      inline: true },
          { name: '📝 Begründung', value: reason,                                                     inline: false },
          { name: '🔓 Aufhebung', value: `<t:${Math.floor((Date.now() + minutes * 60000) / 1000)}:R>`, inline: true },
        )
        .setFooter({ text: 'Nexus AI Omega v5 • Moderation' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      await globalLogger.log({
        eventType: 'TIMEOUT',
        severity: 'warning',
        guildId: interaction.guildId!,
        guildName: interaction.guild!.name,
        userId: target.id,
        username: target.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason,
        metadata: { minutes, durationText },
      });
    } catch (err) {
      await interaction.editReply({ embeds: [Embeds.error('Fehler', `Timeout fehlgeschlagen: ${(err as Error).message}`)] });
    }
  },
};

export default command;
