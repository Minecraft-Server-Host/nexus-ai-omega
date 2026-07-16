/**
 * Nexus AI Omega — /ban Command v5.0
 */
import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import { globalLogger } from '../../../global/globalLogger.js';
import { statsAggregator } from '../../../global/statisticsAggregator.js';
import { Embeds, NexusColors } from '../../../utils/embeds.js';
import { EmbedBuilder } from 'discord.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🔨 Bannt ein Mitglied vom Server')
    .addUserOption(o => o.setName('user').setDescription('Zu bannender User').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Begründung').setMaxLength(500))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Nachrichten löschen (Tage)').setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'Kein Grund angegeben';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    await interaction.deferReply({ ephemeral: true });

    if (target.id === interaction.user.id) {
      await interaction.editReply({ embeds: [Embeds.error('Fehler', 'Du kannst dich nicht selbst bannen.')] });
      return;
    }
    if (target.id === interaction.client.user.id) {
      await interaction.editReply({ embeds: [Embeds.error('Fehler', 'Ich kann mich nicht selbst bannen.')] });
      return;
    }

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (member) {
      if (!member.bannable) {
        await interaction.editReply({ embeds: [Embeds.error('Keine Berechtigung', 'Ich kann diesen User nicht bannen (höhere Rolle?).')] });
        return;
      }
      const myHighest = interaction.guild!.members.me!.roles.highest.position;
      const targetHighest = member.roles.highest.position;
      if (targetHighest >= myHighest) {
        await interaction.editReply({ embeds: [Embeds.error('Keine Berechtigung', 'Dieser User hat eine gleich hohe oder höhere Rolle.')] });
        return;
      }
    }

    try {
      await interaction.guild!.members.ban(target.id, {
        reason: `${reason} | von ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400,
      });

      const embed = new EmbedBuilder()
        .setColor(NexusColors.error)
        .setTitle('🔨 User gebannt')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '👤 User',        value: `${target.tag}\n\`${target.id}\``,         inline: true },
          { name: '🛡️ Moderator',   value: `${interaction.user.tag}\n\`${interaction.user.id}\``, inline: true },
          { name: '📝 Begründung',  value: reason,                                     inline: false },
          { name: '🗑️ Nachrichten', value: `${deleteDays} Tage gelöscht`,              inline: true },
        )
        .setFooter({ text: 'Nexus AI Omega v5 • Moderation' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      statsAggregator.inc('bansToday');

      // DM the banned user
      target.send(`🔨 **Du wurdest von ${interaction.guild!.name} gebannt.**\n**Grund:** ${reason}`).catch(() => {});

      // Global log
      await globalLogger.ban({
        guildId: interaction.guildId!,
        guildName: interaction.guild!.name,
        userId: target.id,
        username: target.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [Embeds.error('Fehler', `Ban fehlgeschlagen: ${(err as Error).message}`)] });
    }
  },
};

export default command;
