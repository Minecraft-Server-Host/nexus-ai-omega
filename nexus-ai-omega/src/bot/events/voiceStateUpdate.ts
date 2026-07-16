/**
 * Nexus AI Omega — VoiceStateUpdate Event v5.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Erkennt wenn ein User dem Support-Warteraum beitritt oder verlässt.
 *
 * Beitritt → Bot joint, TTS-Begrüßung, Musik, Team-Ping
 * Verlassen → User-Counter decrementieren, Bot verlässt wenn leer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import {
  Events,
  type VoiceState,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { dbGet, dbRun } from '../../services/database.js';
import { botLogger } from '../../services/logger.js';
import { NexusColors } from '../../utils/embeds.js';
import {
  joinSupportWaitroom,
  userLeftWaitroom,
  DEFAULT_WELCOME_TEXT,
} from '../commands/support/supportSetup.js';

export default {
  name: Events.VoiceStateUpdate,

  async execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
    // Bots ignorieren
    if (newState.member?.user.bot || oldState.member?.user.bot) return;

    const guild   = newState.guild ?? oldState.guild;
    const guildId = guild.id;
    const userId  = newState.member?.id ?? oldState.member?.id;
    if (!userId) return;

    // Support-Settings laden
    const settings = await dbGet(
      'SELECT * FROM support_settings WHERE guild_id = ?',
      guildId,
    );
    if (!settings?.['wait_channel_id']) return;

    const waitChannelId = String(settings['wait_channel_id']);

    // ── User betritt Warteraum ─────────────────────────────────────────────
    if (newState.channelId === waitChannelId && oldState.channelId !== waitChannelId) {
      const member = newState.member!;
      botLogger.info({ guildId, userId, username: member.user.tag }, '🎤 User betritt Support-Warteraum');

      // Doppel-Session verhindern
      const existingSession = await dbGet(
        'SELECT id FROM support_sessions WHERE guild_id = ? AND user_id = ? AND status = ?',
        guildId, userId, 'waiting',
      );
      if (existingSession) {
        botLogger.debug({ guildId, userId }, 'Support-Session existiert bereits');
        return;
      }

      // Session erstellen
      const result = await dbRun(
        'INSERT INTO support_sessions (guild_id, user_id, wait_channel_id, status, created_at) VALUES (?, ?, ?, ?, ?)',
        guildId, userId, waitChannelId, 'waiting', Date.now(),
      );
      const sessionId = result.lastInsertRowid;

      // Team-Benachrichtigung senden
      const notifyChannel = guild.channels.cache.get(String(settings['notify_channel_id'])) as import('discord.js').TextChannel | undefined;

      if (notifyChannel) {
        const notifyEmbed = new EmbedBuilder()
          .setColor(NexusColors.warning)
          .setTitle('🎫 Neuer Support-Anruf!')
          .setDescription(`**${member.user.tag}** wartet im Support-Warteraum und braucht Hilfe!`)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: '👤 Benutzer',   value: `${member.user.tag}\n\`${member.user.id}\``,                     inline: true },
            { name: '⏰ Wartet seit', value: `<t:${Math.floor(Date.now() / 1000)}:R>`,                        inline: true },
            { name: '🎤 Warteraum',  value: `<#${waitChannelId}>`,                                           inline: true },
            { name: '🆔 Session',    value: `\`#${sessionId}\``,                                             inline: true },
          )
          .setTimestamp()
          .setFooter({ text: 'Nexus AI Omega v5 • Support System • Klicke zum Übernehmen' });

        const claimRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`support:claim:${sessionId}:${userId}`)
            .setLabel('✅ Übernehmen')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`support:ignore:${sessionId}`)
            .setLabel('❌ Ignorieren')
            .setStyle(ButtonStyle.Danger),
        );

        await notifyChannel.send({
          content: `<@&${settings['admin_role_id']}> 🔔 **Neuer Support-Anruf** von **${member.user.tag}**!`,
          embeds: [notifyEmbed],
          components: [claimRow],
        }).catch(err => botLogger.warn({ err: (err as Error).message }, 'Benachrichtigung fehlgeschlagen'));
      }

      // Bot joint Warteraum und spielt TTS + Musik
      await joinSupportWaitroom({
        guildId,
        channelId: waitChannelId,
        userId,
        welcomeText: String(settings['welcome_text'] ?? DEFAULT_WELCOME_TEXT),
        musicUrl: settings['music_url'] ? String(settings['music_url']) : null,
        guild,
      });
    }

    // ── User verlässt Warteraum ────────────────────────────────────────────
    if (oldState.channelId === waitChannelId && newState.channelId !== waitChannelId) {
      botLogger.info({ guildId, userId }, '🎤 User verlässt Support-Warteraum');

      // Session auf "left" setzen
      await dbRun(
        'UPDATE support_sessions SET status = ? WHERE guild_id = ? AND user_id = ? AND status = ?',
        'left', guildId, userId, 'waiting',
      );

      // Voice-Engine benachrichtigen
      userLeftWaitroom(guildId, userId);
    }
  },
};
