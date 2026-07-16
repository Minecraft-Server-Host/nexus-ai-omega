/**
 * Nexus AI Omega — GuildMemberRemove Event v5.2
 * Professionelles Leave-Log mit Zeit auf Server & Rollen.
 */
import { Events, type GuildMember, EmbedBuilder } from 'discord.js';
import { botLogger }    from '../../services/logger.js';
import { globalLogger } from '../../global/globalLogger.js';
import { findChannel }  from '../systems/autoSetup.js';
import { NexusColors }  from '../../utils/embeds.js';

function formatDuration(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 365) return `${Math.floor(d / 365)} Jahre, ${Math.floor((d % 365) / 30)} Monate`;
  if (d > 30)  return `${Math.floor(d / 30)} Monate, ${d % 30} Tage`;
  if (d > 0)   return `${d} Tage, ${h} Stunden`;
  return `${h} Stunden`;
}

export default {
  name: Events.GuildMemberRemove,

  async execute(member: GuildMember): Promise<void> {
    const guild   = member.guild;
    const guildId = guild.id;

    // Log-Kanal finden
    const logCh = findChannel(guild, 'logs') ?? findChannel(guild, 'modlog');

    if (logCh) {
      const timeOnServer = member.joinedAt
        ? formatDuration(Date.now() - member.joinedAt.getTime())
        : 'Unbekannt';

      const userRoles = member.roles.cache
        .filter(r => r.id !== guild.roles.everyone.id)
        .sort((a, b) => b.position - a.position);

      const embed = new EmbedBuilder()
        .setColor(NexusColors.warning)
        .setTitle('👋  Mitglied verlassen')
        .setDescription(`> **${member.user.tag}** hat den Server verlassen.`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: '👤 User',           value: `${member.user.tag}\n\`${member.user.id}\``,                     inline: true },
          { name: '⏱️ Zeit auf Server', value: timeOnServer,                                                   inline: true },
          { name: '👥 Mitglieder',     value: `\`${guild.memberCount.toLocaleString('de-DE')}\``,             inline: true },
          { name: '🎭 Hatte Rollen',
            value: userRoles.size > 0
              ? userRoles.first(8)?.map(r => r.toString()).join(', ') ?? '*Keine*'
              : '*Keine Rollen*',
            inline: false,
          },
        )
        .setFooter({ text: `${guild.name} • Nexus AI Omega v5` })
        .setTimestamp();

      await (logCh as import('discord.js').TextChannel).send({ embeds: [embed] }).catch(err =>
        botLogger.warn({ err: (err as Error).message, guildId }, 'Leave-Log fehlgeschlagen'),
      );
    }

    await globalLogger.log({
      eventType: 'MEMBER_LEAVE',
      severity:  'warning',
      guildId,
      guildName: guild.name,
      userId:    member.id,
      username:  member.user.tag,
      metadata:  { memberCount: guild.memberCount },
    });
  },
};
