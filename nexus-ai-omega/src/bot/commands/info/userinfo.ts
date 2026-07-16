/**
 * Nexus AI Omega — /userinfo Command v5.0
 */
import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { NexusColors } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('👤 Informationen über einen User anzeigen')
    .addUserOption(o => o.setName('user').setDescription('User (leer = du selbst)'))
    .setDMPermission(false),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);

    const createdAt = Math.floor(target.createdTimestamp / 1000);
    const joinedAt = member?.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;

    const flags = target.flags?.toArray() ?? [];
    const badges = flags.map(f => {
      const map: Record<string, string> = {
        Staff: '👨‍💼 Discord Staff',
        Partner: '🤝 Discord Partner',
        Hypesquad: '🏠 HypeSquad',
        BugHunterLevel1: '🐛 Bug Hunter',
        BugHunterLevel2: '🐛 Bug Hunter Gold',
        HypeSquadOnlineHouse1: '🏡 Bravery',
        HypeSquadOnlineHouse2: '🏡 Brilliance',
        HypeSquadOnlineHouse3: '🏡 Balance',
        PremiumEarlySupporter: '⭐ Early Supporter',
        TeamPseudoUser: '👥 Team User',
        VerifiedBot: '✅ Verified Bot',
        VerifiedDeveloper: '👨‍💻 Verified Developer',
        CertifiedModerator: '🛡️ Certified Moderator',
        ActiveDeveloper: '💻 Active Developer',
      };
      return map[f] ?? f;
    });

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor as import('discord.js').ColorResolvable : NexusColors.primary)
      .setTitle(`👤 User-Info — ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🆔 User-ID',        value: `\`${target.id}\``,                                                     inline: true },
        { name: '📅 Account erstellt', value: `<t:${createdAt}:F>\n<t:${createdAt}:R>`,                             inline: true },
        { name: '🤖 Bot?',            value: target.bot ? '✅ Ja' : '❌ Nein',                                       inline: true },
        ...(joinedAt ? [{ name: '📥 Server beigetreten', value: `<t:${joinedAt}:F>\n<t:${joinedAt}:R>`, inline: true }] : []),
        ...(member?.nickname ? [{ name: '📝 Nickname', value: member.nickname, inline: true }] : []),
        ...(badges.length > 0 ? [{ name: '🏅 Badges', value: badges.join('\n'), inline: true }] : []),
        ...(member?.roles.cache.size && member.roles.cache.size > 1 ? [{
          name: `🎭 Rollen (${member.roles.cache.size - 1})`,
          value: member.roles.cache
            .filter(r => r.id !== interaction.guild!.roles.everyone.id)
            .sort((a, b) => b.position - a.position)
            .first(15)
            .map(r => r.toString())
            .join(', ')
            .slice(0, 1024) || '*Keine*',
          inline: false,
        }] : []),
      )
      .setFooter({ text: 'Nexus AI Omega v5 • User Info' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
export default command;
