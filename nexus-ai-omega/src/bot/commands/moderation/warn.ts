/**
 * Nexus AI Omega — /warn Command v5.0
 * Mit Warn-Zähler und Auto-Stufensystem.
 */
import {
  SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction, EmbedBuilder,
} from 'discord.js';
import { Embeds, NexusColors } from '../../../utils/embeds.js';
import { globalLogger } from '../../../global/globalLogger.js';
import { cacheGet, cacheSet, cacheIncr } from '../../../services/redisCache.js';
import { statsAggregator } from '../../../global/statisticsAggregator.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('⚠️ Verwarnung aussprechen')
    .addUserOption(o => o.setName('user').setDescription('Zu verwarnender User').setRequired(true))
    .addStringOption(o => o.setName('grund').setDescription('Begründung').setRequired(true).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user', true);
    const grund = interaction.options.getString('grund', true);
    const guild = interaction.guild!;

    if (target.id === interaction.user.id) {
      await interaction.editReply({ embeds: [Embeds.error('Fehler', 'Du kannst dich nicht selbst verwarnen.')] });
      return;
    }

    // Warn-Zähler
    const warnKey = `nexus:v5:warns:${guild.id}:${target.id}`;
    const warnCount = await cacheIncr(warnKey);
    await cacheSet(warnKey, warnCount, 86_400 * 30); // 30 Tage

    // Auto-Eskalation
    let autoAction = '';
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (member) {
      if (warnCount === 3) {
        await member.timeout(10 * 60 * 1000, `Auto-Timeout: ${warnCount} Verwarnungen`).catch(() => {});
        autoAction = '⏰ **Auto-Timeout** (10 Min) wegen 3. Verwarnung.';
      } else if (warnCount >= 5) {
        await guild.members.ban(target.id, { reason: `Auto-Ban: ${warnCount} Verwarnungen` }).catch(() => {});
        autoAction = '🔨 **Auto-Ban** wegen 5+ Verwarnungen.';
      }
    }

    const embed = new EmbedBuilder()
      .setColor(NexusColors.warning)
      .setTitle('⚠️ Verwarnung ausgesprochen')
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '👤 User',       value: `${target.tag}\n\`${target.id}\``,             inline: true },
        { name: '🛡️ Moderator', value: interaction.user.tag,                           inline: true },
        { name: '⚠️ Warnung Nr.', value: `\`${warnCount}/5\``,                         inline: true },
        { name: '📝 Grund',      value: grund,                                          inline: false },
        ...(autoAction ? [{ name: '🤖 Auto-Aktion', value: autoAction, inline: false }] : []),
      )
      .setFooter({ text: 'Nexus AI Omega v5 • Warn System • 3 Warns = Timeout, 5 Warns = Ban' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    statsAggregator.inc('warningsToday');

    target.send(`⚠️ **Verwarnung auf ${guild.name}**\n**Grund:** ${grund}\n**Verwarnung Nr.:** ${warnCount}/5\n${autoAction}`).catch(() => {});

    await globalLogger.log({
      eventType: 'WARN', severity: 'warning',
      guildId: guild.id, guildName: guild.name,
      userId: target.id, username: target.tag,
      moderatorId: interaction.user.id, moderatorTag: interaction.user.tag,
      reason: grund, metadata: { warnCount },
    });
  },
};
export default command;
