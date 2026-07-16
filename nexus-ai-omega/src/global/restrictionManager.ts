/**
 * Nexus AI Omega — Global Restriction Manager v5.0
 * Cross-server global bans enforced before every command.
 */
import { dbLogger } from '../services/logger.js';
import { globalLogger } from './globalLogger.js';
import { cacheGet, cacheSet } from '../services/redisCache.js';
import { CacheKeys } from '../types/index.js';
import type { Interaction } from 'discord.js';

let prisma: {
  globalBan?: {
    findUnique: (opts: unknown) => Promise<unknown>;
    create: (opts: unknown) => Promise<unknown>;
    update: (opts: unknown) => Promise<unknown>;
    findMany: (opts: unknown) => Promise<unknown[]>;
    count: (opts: unknown) => Promise<number>;
  };
  globalBanHistory?: {
    create: (opts: unknown) => Promise<unknown>;
  };
} | null = null;

try {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
} catch { dbLogger.debug('Prisma unavailable — using memory fallback'); }

const memBan = new Map<string, Record<string, unknown>>();

export interface GlobalBanRecord {
  userId: string;
  username: string;
  reason: string;
  bannedBy: string;
  moderatorTag: string;
  severity?: number;
  evidence?: string;
  expiresAt?: Date | null;
  appealable?: boolean;
}

export class RestrictionManager {
  private static instance: RestrictionManager;
  private cache = new Map<string, { banned: boolean; record?: unknown; expires: number }>();
  private readonly CACHE_TTL = 60_000;

  private constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (v.expires < now) this.cache.delete(k);
      }
    }, 60_000);
  }

  static getInstance(): RestrictionManager {
    if (!RestrictionManager.instance) RestrictionManager.instance = new RestrictionManager();
    return RestrictionManager.instance;
  }

  async isRestricted(userId: string): Promise<{ restricted: boolean; record?: unknown }> {
    const cached = this.cache.get(userId);
    if (cached && cached.expires > Date.now()) return { restricted: cached.banned, record: cached.record };

    // Check Redis first
    const redisCached = await cacheGet<{ banned: boolean; record?: unknown }>(CacheKeys.globalBan(userId));
    if (redisCached !== null) {
      this.cache.set(userId, { ...redisCached, expires: Date.now() + this.CACHE_TTL });
      return { restricted: redisCached.banned, record: redisCached.record };
    }

    let rec: unknown = null;
    try {
      if (prisma?.globalBan?.findUnique) {
        rec = await prisma.globalBan.findUnique({ where: { userId } });
      } else {
        rec = memBan.get(userId) ?? null;
      }
    } catch { rec = memBan.get(userId) ?? null; }

    const r = rec as { active?: boolean; expiresAt?: string } | null;
    const banned = !!r && r.active !== false && (!r.expiresAt || new Date(r.expiresAt) > new Date());

    this.cache.set(userId, { banned, record: rec, expires: Date.now() + this.CACHE_TTL });
    await cacheSet(CacheKeys.globalBan(userId), { banned, record: rec }, 60);
    return { restricted: banned, record: rec };
  }

  async ban(data: GlobalBanRecord): Promise<Record<string, unknown>> {
    const record: Record<string, unknown> = {
      userId: data.userId, username: data.username,
      reason: data.reason, bannedBy: data.bannedBy,
      moderatorTag: data.moderatorTag, severity: data.severity ?? 5,
      evidence: data.evidence ?? null, expiresAt: data.expiresAt ?? null,
      appealable: data.appealable ?? true, active: true,
      createdAt: new Date(),
    };

    try {
      if (prisma?.globalBan?.create) {
        await prisma.globalBan.create({ data: record });
      } else {
        memBan.set(data.userId, record);
      }
    } catch (err) {
      dbLogger.error({ err }, 'Global ban DB write failed — using memory');
      memBan.set(data.userId, record);
    }

    // Invalidate cache
    this.cache.delete(data.userId);
    await cacheSet(CacheKeys.globalBan(data.userId), { banned: true, record }, 60);

    await globalLogger.log({
      eventType: 'BAN',
      severity: 'error',
      userId: data.userId,
      username: data.username,
      moderatorId: data.bannedBy,
      moderatorTag: data.moderatorTag,
      reason: data.reason,
      metadata: { severity: data.severity, evidence: data.evidence },
    });

    return record;
  }

  async unban(userId: string, moderatorId: string, moderatorTag: string, reason: string): Promise<{ ok: boolean }> {
    try {
      if (prisma?.globalBan?.update) {
        await prisma.globalBan.update({
          where: { userId },
          data: { active: false, unbannedAt: new Date(), unbannedBy: moderatorId, unbanReason: reason },
        });
      } else {
        const rec = memBan.get(userId);
        if (rec) rec['active'] = false;
      }
    } catch (err) {
      dbLogger.error({ err }, 'Global unban failed');
      return { ok: false };
    }

    this.cache.delete(userId);
    await cacheSet(CacheKeys.globalBan(userId), { banned: false }, 60);

    await globalLogger.log({
      eventType: 'UNBAN', severity: 'success',
      userId, moderatorId, moderatorTag,
      reason, action: 'GLOBAL_BAN_LIFTED',
    });

    return { ok: true };
  }

  async getInfo(userId: string): Promise<{ userId: string; restricted: boolean; record?: unknown; history: unknown[] }> {
    const { restricted, record } = await this.isRestricted(userId);
    let history: unknown[] = [];
    try {
      if (prisma?.globalBanHistory) {
        history = await (prisma.globalBanHistory as { findMany: (opts: unknown) => Promise<unknown[]> }).findMany({
          where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
        });
      }
    } catch { /* ignore */ }
    return { userId, restricted, record, history };
  }

  async listBlacklist(
    page = 1,
    pageSize = 25,
    search?: string,
  ): Promise<{ items: unknown[]; total: number; page: number; pageSize: number; pages: number }> {
    try {
      if (prisma?.globalBan) {
        const where: Record<string, unknown> = { active: true };
        if (search) {
          where['OR'] = [
            { userId: { contains: search } },
            { username: { contains: search, mode: 'insensitive' } },
          ];
        }
        const [items, total] = await Promise.all([
          prisma.globalBan.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize } as unknown as Parameters<typeof prisma.globalBan.findMany>[0]),
          prisma.globalBan.count({ where } as Parameters<typeof prisma.globalBan.count>[0]),
        ]);
        return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
      }
    } catch (err) { dbLogger.error({ err }, 'listBlacklist failed'); }

    const items = [...memBan.values()].filter(b =>
      (b['active'] !== false) && (!search || String(b['userId']).includes(search) || String(b['username']).toLowerCase().includes(search.toLowerCase()))
    );
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize, pages: Math.ceil(items.length / pageSize) };
  }

  async validateInteraction(interaction: Interaction): Promise<{ allowed: boolean; message?: string }> {
    const userId = interaction.user?.id;
    if (!userId) return { allowed: true };

    const { restricted, record } = await this.isRestricted(userId);
    if (!restricted) return { allowed: true };

    const r = record as { reason?: string; id?: string } | null;

    await globalLogger.log({
      eventType: 'SECURITY_ALERT', severity: 'warning',
      userId, username: interaction.user.tag,
      guildId: interaction.guildId ?? undefined,
      action: 'BLOCKED_COMMAND_ATTEMPT',
      command: 'commandName' in interaction ? String(interaction.commandName) : 'unknown',
      result: 'denied — global restriction active',
      metadata: { banReason: r?.reason },
    });

    return {
      allowed: false,
      message:
        `⛔ **Du bist global gesperrt.**\n\n` +
        `**Grund:** ${r?.reason ?? 'Verstoß gegen die Nexus-Nutzungsbedingungen'}\n` +
        `**Fall-ID:** \`${r?.id ?? userId}\`\n\n` +
        `Wenn du glaubst, dass dies ein Fehler ist, kontaktiere das Nexus-Team.`,
    };
  }
}

export const restrictionManager = RestrictionManager.getInstance();
