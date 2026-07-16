/**
 * Nexus AI Omega — Global Logger v5.0
 * Routes every event to DB + Discord Control Center.
 * Buffer if control center not ready.
 */
import type { Client } from 'discord.js';
import { logger } from '../services/logger.js';
import { NexusControlCenter } from './nexusControlCenter.js';
import { buildGlobalLogEmbed, colorForEvent } from '../utils/embeds.js';
import type { GlobalLogInput, Severity } from '../types/index.js';

let prisma: { globalLog?: { create: (opts: unknown) => Promise<unknown> } } | null = null;
try { const { PrismaClient } = await import('@prisma/client'); prisma = new PrismaClient(); } catch { /* optional */ }

const EVENT_CHANNEL_MAP: Record<string, string> = {
  SERVER_JOIN: 'server-join',        SERVER_LEAVE: 'server-leave',
  BAN: 'ban-logs',                   UNBAN: 'unban-logs',
  KICK: 'kick-logs',                 WARN: 'warn-logs',
  TIMEOUT: 'timeout-logs',           MESSAGE_DELETE: 'message-delete-logs',
  CHANNEL_CREATE: 'channel-logs',    CHANNEL_DELETE: 'channel-logs',
  ROLE_CREATE: 'role-logs',          ROLE_DELETE: 'role-logs',
  MEMBER_JOIN: 'join-logs',          MEMBER_LEAVE: 'leave-logs',
  TICKET_OPEN: 'ticket-logs',        TICKET_CLOSE: 'ticket-logs',
  AI_ACTION: 'ai-logs',              AI_ERROR: 'ai-errors',
  SECURITY_ALERT: 'security-logs',   RAID_DETECTED: 'raid-detection',
  SCAM_DETECTED: 'scam-detection',   TOKEN_LEAK: 'token-alerts',
  COMMAND_EXECUTED: 'command-logs',   LEVEL_UP: 'level-logs',
  DATABASE_ERROR: 'error-logs',      SYSTEM: 'system-logs',
};

const SEVERITY_ICON: Record<Severity | string, string> = {
  success: '🟢', warning: '🟡', error: '🔴', ai: '🟣', security: '⚫', info: '🔵',
};

export class GlobalLogger {
  private static instance: GlobalLogger;
  private controlCenter: NexusControlCenter | null = null;
  private buffer: GlobalLogInput[] = [];
  private client: Client | null = null;
  private logCount = 0;

  private constructor() {}

  static getInstance(): GlobalLogger {
    if (!GlobalLogger.instance) GlobalLogger.instance = new GlobalLogger();
    return GlobalLogger.instance;
  }

  attach(client: Client, controlCenter: NexusControlCenter): void {
    this.client = client;
    this.controlCenter = controlCenter;
    logger.info('🌐 GlobalLogger attached to control center');
  }

  private channelFor(eventType: string): string {
    return EVENT_CHANNEL_MAP[eventType.toUpperCase()] ?? 'system-logs';
  }

  async log(input: GlobalLogInput): Promise<boolean> {
    const ts = new Date();
    this.logCount++;

    // 1. Persist to DB (non-blocking, best effort)
    if (prisma?.globalLog?.create) {
      prisma.globalLog.create({
        data: {
          eventType: input.eventType,
          severity: input.severity ?? 'info',
          guildId: input.guildId ?? null,
          guildName: input.guildName ?? null,
          channelId: input.channelId ?? null,
          channelName: input.channelName ?? null,
          userId: input.userId ?? null,
          username: input.username ?? null,
          moderatorId: input.moderatorId ?? null,
          moderatorTag: input.moderatorTag ?? null,
          action: input.action ?? null,
          command: input.command ?? null,
          reason: input.reason ?? null,
          result: input.result ?? null,
          metadata: input.metadata ?? {},
          shardId: input.shardId ?? null,
          latencyMs: input.latencyMs ?? null,
          success: input.severity !== 'error',
          logChannel: this.channelFor(input.eventType),
          createdAt: ts,
        },
      }).catch(() => {});
    }

    // 2. Send to control center
    if (this.controlCenter?.isReady()) {
      const channelName = this.channelFor(input.eventType);
      const icon = SEVERITY_ICON[input.severity ?? 'info'] ?? '🔵';
      const embed = buildGlobalLogEmbed({
        eventTitle: `${icon} ${input.eventType.replace(/_/g, ' ')}`,
        timestamp: ts,
        guildName: input.guildName,
        guildId: input.guildId,
        user: input.userId ? { tag: input.username ?? 'Unknown', id: input.userId, avatar: input.userAvatar } : undefined,
        moderator: input.moderatorId ? { tag: input.moderatorTag ?? 'System', id: input.moderatorId } : undefined,
        channel: input.channelName ? { name: input.channelName, id: input.channelId } : undefined,
        action: input.action,
        command: input.command,
        reason: input.reason,
        result: input.result,
        metadata: input.metadata,
        color: colorForEvent(input.eventType),
      });

      const ok = await this.controlCenter.sendTo(channelName, {
        color: Number(embed.data.color),
        title: embed.data.title ?? undefined,
        description: embed.data.description ?? undefined,
        fields: embed.data.fields as { name: string; value: string; inline?: boolean }[] | undefined,
        footer: embed.data.footer?.text,
      });

      if (!ok) {
        this.buffer.push(input);
        if (this.buffer.length > 500) this.buffer.shift();
      }
      return ok;
    }

    // 3. Buffer until control center ready
    this.buffer.push(input);
    if (this.buffer.length > 500) this.buffer.shift();
    logger.debug({ eventType: input.eventType }, 'Log buffered (control center not ready)');
    return false;
  }

  async flushBuffer(): Promise<void> {
    if (!this.controlCenter?.isReady() || this.buffer.length === 0) return;
    const copy = [...this.buffer];
    this.buffer = [];
    for (const item of copy) await this.log(item);
  }

  // ── Convenience shortcuts ─────────────────────────────────────────────────
  serverJoin(g: { id: string; name: string; memberCount: number; ownerId: string }): Promise<boolean> {
    return this.log({
      eventType: 'SERVER_JOIN', severity: 'success',
      guildId: g.id, guildName: g.name,
      metadata: { members: g.memberCount, ownerId: g.ownerId },
      result: 'Bot joined server',
    });
  }

  serverLeave(g: { id: string; name: string }): Promise<boolean> {
    return this.log({ eventType: 'SERVER_LEAVE', severity: 'warning', guildId: g.id, guildName: g.name, result: 'Bot removed' });
  }

  commandExec(interaction: { user: { id: string; tag: string }; guildId: string | null; guild?: { name?: string } | null; channelId?: string | null; commandName: string; options?: { data?: { name: string; value: unknown }[] } }, latencyMs?: number): Promise<boolean> {
    return this.log({
      eventType: 'COMMAND_EXECUTED', severity: 'info',
      guildId: interaction.guildId ?? undefined,
      guildName: interaction.guild?.name,
      userId: interaction.user.id,
      username: interaction.user.tag,
      command: interaction.commandName,
      latencyMs,
      metadata: { options: interaction.options?.data?.map(o => `${o.name}:${o.value}`).join(', ') },
    });
  }

  ban(o: Partial<GlobalLogInput>): Promise<boolean> {
    return this.log({ eventType: 'BAN', severity: 'error', ...o });
  }

  aiAction(o: Partial<GlobalLogInput>): Promise<boolean> {
    return this.log({ eventType: 'AI_ACTION', severity: 'ai', ...o });
  }

  securityAlert(o: Partial<GlobalLogInput>): Promise<boolean> {
    return this.log({ eventType: 'SECURITY_ALERT', severity: 'security', ...o });
  }

  getStats(): { logCount: number; bufferSize: number } {
    return { logCount: this.logCount, bufferSize: this.buffer.length };
  }
}

export const globalLogger = GlobalLogger.getInstance();
