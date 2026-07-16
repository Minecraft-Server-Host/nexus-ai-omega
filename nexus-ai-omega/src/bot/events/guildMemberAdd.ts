/**
 * Nexus AI Omega — GuildMemberAdd Event v5.2
 * Professionelle Begrüßung · Anti-Raid · Member-Rolle · Account-Check
 */
import {
  Events, type GuildMember, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { botLogger }        from '../../services/logger.js';
import { globalLogger }     from '../../global/globalLogger.js';
import { securityManager }  from '../../security-center/securityManager.js';
import { findChannel }      from '../systems/autoSetup.js';
import { cacheGet }         from '../../services/redisCache.js';
import { NexusColors }      from '../../utils/embeds.js';
import { statsAggregator }  from '../../global/statisticsAggregator.js';

function formatAge(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 365)  return `${Math.floor(d / 365)} Jahre`;
  if (d > 30)   return `${Math.floor(d / 30)} Monate`;
  if (d > 0)    return `${d} Tage`;
  return `${h} Stunden`;
}

export default {
  name: Events.GuildMemberAdd,

  async execute(member: GuildMember): Promise<void> {
    const guild   = member.guild;
    const guildId = guild.id;

    // 1. Anti-Raid Velocity-Check
    const alert = await securityManager.evaluateEvent(guildId, member.id, 'MEMBER_JOIN');
    if (alert) {
      botLogger.warn({ guildId, userId: member.id }, '🚨 Raid-Verdacht bei Beitritt — kein Welcome');
      return;
    }

    const accountAgeMs = Date.now() - member.user.createdTimestamp;
    const isNewAccount = accountAgeMs < 7 * 24 * 60 * 60 * 1000;
    const accountLabel = formatAge(accountAgeMs);

    // 2. Gespeicherte Konfiguration laden
    const config = await cacheGet<{
      welcomeChannelId?: string;
      memberRoleId?:     string;
    }>(`nexus:v5:guild:${guildId}:config`);

    // 3. Member-Rolle vergeben
    if (config?.memberRoleId && !isNewAccount) {
      const role = guild.roles.cache.get(config.memberRoleId);
      if (role) await member.roles.add(role, 'Nexus Auto-Rolle').catch(() => {});
    }

    // 4. Welcome-Kanal finden
    const welcomeCh = (config?.welcomeChannelId
      ? guild.channels.cache.get(config.welcomeChannelId) as import('discord.js').TextChannel | undefined
      : undefined) ?? findChannel(guild, 'welcome') ?? undefined;

    // 5. Welcome-Embed senden
    if (welcomeCh) {
      const embed = new EmbedBuilder()
        .setColor(isNewAccount ? NexusColors.warning : NexusColors.success)
        .setTitle(`👋  Willkommen auf ${guild.name}!`)
        .setDescription(
          `Hey ${member}! Schön, dass du hier bist! 🎉\n\n` +
          `> Du bist Mitglied **#${guild.memberCount.toLocaleString('de-DE')}**!\n` +
          `> 📋 Bitte lies zuerst die **Regeln** durch.\n` +
          `> 🎫 Bei Fragen: einfach ein **Ticket** öffnen.\n` +
          (isNewAccount
            ? `\n> ⚠️ *Dein Account ist erst ${accountLabel} alt — bitte beachte unsere Regeln.*`
            : ''),
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '👤 User',          value: `${member.user.tag}\n\`${member.user.id}\``,            inline: true },
          { name: '📅 Account-Alter', value: accountLabel,                                            inline: true },
          { name: '👥 Mitglied Nr.',  value: `#${guild.memberCount.toLocaleString('de-DE')}`,        inline: true },
        )
        .setFooter({ text: `${guild.name} • Nexus AI Omega v5` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('welcome:rules')          .setLabel('📋 Regeln').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket:open:sonstiges')  .setLabel('🎫 Ticket').setStyle(ButtonStyle.Secondary),
      );

      await welcomeCh.send({ embeds: [embed], components: [row] }).catch(err =>
        botLogger.warn({ err: (err as Error).message, guildId }, 'Welcome-Nachricht fehlgeschlagen'),
      );
    }

    // 6. Global log
    await globalLogger.log({
      eventType: 'MEMBER_JOIN',
      severity:  'info',
      guildId,
      guildName: guild.name,
      userId:    member.id,
      username:  member.user.tag,
      metadata:  { memberCount: guild.memberCount, isNewAccount, accountAge: accountLabel },
    });

    statsAggregator.inc('messagesToday');
  },
};
