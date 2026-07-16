/**
 * Nexus AI Omega — Nexus Control Center v5.0
 * Routes log embeds to the Nexus Control Guild channels.
 */
import {
  type Client,
  type Guild,
  type TextChannel,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} from 'discord.js';
import { logger } from '../services/logger.js';

export const NEXUS_CONTROL_GUILD_ID =
  process.env.NEXUS_CONTROL_GUILD_ID || '1523481048149921883';

export const NEXUS_TEAM_ROLE_IDS =
  (process.env.NEXUS_TEAM_ROLE_IDS || '').split(',').filter(Boolean);

export class NexusControlCenter {
  private client: Client;
  private channelCache = new Map<string, string>(); // logicalName → channelId
  private ready = false;

  constructor(client: Client) {
    this.client = client;
  }

  async initialize(): Promise<void> {
    try {
      const guild = await this.client.guilds
        .fetch(NEXUS_CONTROL_GUILD_ID)
        .catch(() => null) as Guild | null;

      if (!guild) {
        logger.warn({ guildId: NEXUS_CONTROL_GUILD_ID }, 'Control Guild not found — log routing disabled');
        return;
      }

      // Map existing channels by name
      for (const [, channel] of guild.channels.cache) {
        if (channel.type === ChannelType.GuildText) {
          this.channelCache.set(channel.name, channel.id);
        }
      }

      this.ready = true;
      logger.info({ channels: this.channelCache.size }, '✅ Nexus Control Center ready');
    } catch (err) {
      logger.error({ err }, 'Control Center init failed');
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getChannelId(logicalName: string): string | null {
    return (
      this.channelCache.get(logicalName) ??
      this.channelCache.get(logicalName.replace(/_/g, '-')) ??
      null
    );
  }

  async sendTo(
    channelName: string,
    embedData: {
      color?: number;
      title?: string;
      description?: string;
      fields?: { name: string; value: string; inline?: boolean }[];
      footer?: string;
    },
  ): Promise<boolean> {
    if (!this.ready) return false;

    try {
      const guild = this.client.guilds.cache.get(NEXUS_CONTROL_GUILD_ID);
      if (!guild) return false;

      const chId = this.getChannelId(channelName);
      if (!chId) return false;

      const ch = guild.channels.cache.get(chId) as TextChannel | undefined;
      if (!ch?.isTextBased()) return false;

      await ch.send({
        embeds: [{
          color:       embedData.color ?? 0x7c3aed,
          title:       embedData.title,
          description: embedData.description,
          fields:      embedData.fields,
          timestamp:   new Date().toISOString(),
          footer:      { text: embedData.footer ?? 'Nexus AI Omega v5 • Global Control Center' },
        }],
      });
      return true;
    } catch (err) {
      logger.debug({ err, channelName }, 'Control Center send failed');
      return false;
    }
  }

  listChannels(): Record<string, string> {
    return Object.fromEntries(this.channelCache);
  }
}
