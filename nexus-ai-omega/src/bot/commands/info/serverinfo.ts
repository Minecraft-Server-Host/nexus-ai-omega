/**
 * Nexus AI Omega — /serverinfo Command v5.0
 */
import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { NexusColors } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('🏰 Informationen über diesen Server anzeigen')
    .setDMPermission(false),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild!;
    await guild.fetch();

    const owner = await guild.fetchOwner().catch(() => null);
    const createdAt = Math.floor(guild.createdTimestamp / 1000);

    const textChannels  = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
    const categories    = guild.channels.cache.filter(c => c.type === 4).size;
    const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline' && m.presence?.status != null).size;

    const boostEmoji = ['', '🥉', '🥈', '🥇', '💎'][guild.premiumTier] ?? '💎';

    const embed = new EmbedBuilder()
      .setColor(NexusColors.primary)
      .setTitle(`🏰 Server-Info — ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .setImage(guild.bannerURL({ size: 1024 }) ?? null)
      .addFields(
        { name: '🆔 Server-ID',        value: `\`${guild.id}\``,                              inline: true },
        { name: '👑 Owner',             value: owner ? `${owner.user.tag}` : '`Unbekannt`',     inline: true },
        { name: '📅 Erstellt',          value: `<t:${createdAt}:D>\n<t:${createdAt}:R>`,       inline: true },
        { name: '👥 Mitglieder',        value: `\`${guild.memberCount.toLocaleString('de-DE')}\` gesamt`, inline: true },
        { name: '🟢 Online',            value: `\`${onlineMembers.toLocaleString('de-DE')}\``, inline: true },
        { name: '🎭 Rollen',            value: `\`${guild.roles.cache.size}\``,                inline: true },
        { name: '💬 Text-Kanäle',       value: `\`${textChannels}\``,                          inline: true },
        { name: '🎙️ Voice-Kanäle',      value: `\`${voiceChannels}\``,                         inline: true },
        { name: '📂 Kategorien',        value: `\`${categories}\``,                            inline: true },
        { name: '😀 Emojis',            value: `\`${guild.emojis.cache.size}\``,               inline: true },
        { name: '💎 Boosts',            value: `${boostEmoji} \`${guild.premiumSubscriptionCount ?? 0}\` Boosts (Tier ${guild.premiumTier})`, inline: true },
        { name: '🔒 Verifizierung',     value: `\`${['Keine', 'Niedrig', 'Mittel', 'Hoch', 'Höchste'][guild.verificationLevel]}\``, inline: true },
        { name: '🌐 Sprache',           value: `\`${guild.preferredLocale}\``,                 inline: true },
        { name: '🔞 NSFW-Level',        value: `\`${['Deaktiviert', 'Standard', 'Sicher', 'Sehr sicher'][guild.nsfwLevel]}\``, inline: true },
      )
      .setFooter({ text: 'Nexus AI Omega v5 • Server Info' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
export default command;
