/**
 * Nexus AI Omega — Global Server Registry v5.0
 * Tracks every Discord server the bot is in.
 */
import { dbLogger } from '../services/logger.js';

let prisma: {
  globalServer?: {
    upsert: (opts: unknown) => Promise<unknown>;
    findMany: (opts: unknown) => Promise<unknown[]>;
    count: (opts: unknown) => Promise<number>;
    update: (opts: unknown) => Promise<unknown>;
  };
} | null = null;

try {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
} catch { dbLogger.debug('Prisma unavailable — using memory fallback'); }

const memServers = new Map<string, Record<string, unknown>>();

export interface GlobalServerInput {
  guildId: string;
  name: string;
  icon?: string | null;
  ownerId: string;
  ownerTag?: string;
  memberCount: number;
  premium?: boolean;
  locale?: string;
  region?: string | null;
}

export class ServerRegistry {
  private static instance: ServerRegistry;
  static getInstance(): ServerRegistry {
    if (!ServerRegistry.instance) ServerRegistry.instance = new ServerRegistry();
    return ServerRegistry.instance;
  }

  async upsertServer(data: GlobalServerInput): Promise<void> {
    const payload = {
      guildId:      data.guildId,
      name:         data.name,
      icon:         data.icon ?? null,
      ownerId:      data.ownerId,
      ownerTag:     data.ownerTag ?? null,
      memberCount:  data.memberCount,
      premium:      data.premium ?? false,
      locale:       data.locale ?? 'en-US',
      region:       data.region ?? null,
      active:       true,
      lastActivity: new Date(),
      botVersion:   '5.0.0',
    };

    try {
      if (prisma?.globalServer?.upsert) {
        await prisma.globalServer.upsert({
          where:  { guildId: data.guildId },
          update: { name: payload.name, icon: payload.icon, memberCount: payload.memberCount, lastActivity: new Date(), active: true },
          create: payload,
        } as Parameters<typeof prisma.globalServer.upsert>[0]);
      } else {
        memServers.set(data.guildId, payload);
      }
    } catch (err) {
      dbLogger.error({ err }, 'upsertServer failed');
      memServers.set(data.guildId, payload);
    }
  }

  async markLeft(guildId: string): Promise<void> {
    try {
      if (prisma?.globalServer?.update) {
        await prisma.globalServer.update({
          where:  { guildId },
          data:   { active: false, leftAt: new Date() },
        } as Parameters<typeof prisma.globalServer.update>[0]);
      } else {
        const s = memServers.get(guildId);
        if (s) { s['active'] = false; s['leftAt'] = new Date(); }
      }
    } catch (err) {
      dbLogger.error({ err }, 'markLeft failed');
    }
  }

  async getAllActive(): Promise<unknown[]> {
    try {
      if (prisma?.globalServer?.findMany) {
        return await prisma.globalServer.findMany({
          where:   { active: true },
          orderBy: { lastActivity: 'desc' },
          take:    500,
        } as Parameters<typeof prisma.globalServer.findMany>[0]);
      }
    } catch { /* fallback */ }
    return [...memServers.values()].filter(s => s['active'] !== false);
  }

  async getStats(): Promise<{ totalServers: number; activeServers: number; totalMembers: number }> {
    try {
      if (prisma?.globalServer?.count) {
        const [total, active] = await Promise.all([
          prisma.globalServer.count({} as Parameters<typeof prisma.globalServer.count>[0]),
          prisma.globalServer.count({ where: { active: true } } as Parameters<typeof prisma.globalServer.count>[0]),
        ]);
        const servers = await this.getAllActive() as Array<{ memberCount?: number }>;
        const members = servers.reduce((s, g) => s + (g.memberCount ?? 0), 0);
        return { totalServers: total, activeServers: active, totalMembers: members };
      }
    } catch { /* fallback */ }

    const servers = [...memServers.values()];
    const active  = servers.filter(s => s['active'] !== false);
    return {
      totalServers:  servers.length,
      activeServers: active.length,
      totalMembers:  active.reduce((s, g) => s + ((g['memberCount'] as number) ?? 0), 0),
    };
  }
}

export const serverRegistry = ServerRegistry.getInstance();
