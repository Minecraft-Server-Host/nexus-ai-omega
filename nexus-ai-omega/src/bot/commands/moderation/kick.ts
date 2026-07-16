/**
 * Nexus AI Omega — /kick Command v5.2
 */
import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { globalLogger }     from '../../../global/globalLogger.js';
import { statsAggregator }  from '../../../global/statisticsAggregator.js';
import { Embeds, NexusColors } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('👟 Mitglied vom Server kicken')
    .addUserOption(o => o.setName('user').setDescription('Zu kickender User').setRequired(true))
    .addStringOption(o => o.setName('grund').setDescription('Begründung').setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const grund  = interaction.options.getString('grund') ?? 'Kein Grund angegeben';
    const guild  = interaction.guild!;

    // Selbst-Kick verhindern
    if (target.id === interaction.user.id) {
      await interaction.editReply({ embeds: [Embeds.error('Fehler', 'Du kannst dich nicht selbst kicken.')] });
      return;
    }

    // Bot-Kick verhindern
    if (target.id === interaction.client.user.id) {
      await interaction.editReply({ embeds: [Embeds.error('Fehler', 'Du kannst den Bot nicht kicken.')] });
      return;
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.editReply({ embeds: [Embeds.error('Nicht gefunden', 'Dieser User ist nicht auf dem Server.')] });
      return;
    }

    if (!member.kickable) {
      await interaction.editReply({ embeds: [Embeds.error('Keine Berechtigung', 'Ich kann diesen User nicht kicken.\nMöglicherweise hat er eine höhere Rolle.')] });
      return;
    }

    // Kick-Hierarchie prüfen
    const myHighest     = guild.members.me?.roles.highest.position ?? 0;
    const targetHighest = member.roles.highest.position;
    if (targetHighest >= myHighest) {
      await interaction.editReply({ embeds: [Embeds.error('Keine Berechtigung', 'Dieser User hat eine gleich hohe oder höhere Rolle als ich.')] });
      return;
    }

    try {
      // DM vor dem Kick
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.warning)
            .setTitle('👟  Du wurdest gekickt')
            .setDescription(
              `> Du wurdest von **${guild.name}** gekickt.\n` +
              `> **Grund:** ${grund}\n\n` +
              `> Du kannst dem Server erneut beitreten wenn du einen Invite-Link hast.`,
            )
            .setFooter({ text: `${guild.name} • Nexus AI Omega` }),
        ],
      }).catch(() => {});

      await member.kick(`${grund} | von ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setColor(NexusColors.warning)
        .setTitle('👟  User gekickt')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '👤 User',       value: `${target.tag}\n\`${target.id}\``,                    inline: true },
          { name: '🛡️ Moderator', value: `${interaction.user.tag}\n\`${interaction.user.id}\``, inline: true },
          { name: '📝 Begründung', value: grund,                                                  inline: false },
        )
        .setFooter({ text: 'Nexus AI Omega v5 • Moderation' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Stats + Log
      statsAggregator.inc('warningsToday'); // Kick zählt als warning-like action

      await globalLogger.log({
        eventType: 'KICK',
        severity:  'warning',
        guildId:    guild.id,
        guildName:  guild.name,
        userId:     target.id,
        username:   target.tag,
        moderatorId:   interaction.user.id,
        moderatorTag:  interaction.user.tag,
        reason:     grund,
      });

    } catch (err) {
      await interaction.editReply({
        embeds: [Embeds.error('Fehler', `Kick fehlgeschlagen: ${(err as Error).message}`)],
      });
    }
  },
};

export default command;
