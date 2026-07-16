/**
 * Nexus AI Omega — Statistics Aggregator v5.0
 * Daily rollover, Redis-backed, dashboard payload.
 */
import { serverRegistry } from './serverRegistry.js';
import { dbLogger } from '../services/logger.js';
import { cacheGet, cacheSet, cacheIncr } from '../services/redisCache.js';

let prisma: { globalStatsSnapshot?: { create: (opts: unknown) => Promise<unknown> } } | null = null;
try {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
} catch { /* DB optional */ }

const KEYS = {
  commandsToday:   'nexus:v5:stats:today:commands',
  aiRequestsToday: 'nexus:v5:stats:today:ai',
  warningsToday:   'nexus:v5:stats:today:warnings',
  bansToday:       'nexus:v5:stats:today:bans',
  errorsToday:     'nexus:v5:stats:today:errors',
  messagesToday:   'nexus:v5:stats:today:messages',
  ticketsToday:    'nexus:v5:stats:today:tickets',
};

type StatKey = keyof typeof KEYS;

export const statsAggregator = {
  async inc(key: StatKey, n = 1): Promise<void> {
    await cacheIncr(KEYS[key], n).catch(() => {});
  },

  async getLive(): Promise<Record<StatKey, number>> {
    const results: Record<string, number> = {};
    for (const [k, redisKey] of Object.entries(KEYS)) {
      const val = await cacheGet<number>(redisKey).catch(() => null);
      results[k] = val ?? 0;
    }
    return results as Record<StatKey, number>;
  },

  async getDashboardPayload(): Promise<Record<string, unknown>> {
    const srv = await serverRegistry.getStats();
    const live = await this.getLive();
    const mem = process.memoryUsage();

    return {
      totalServers:      srv.totalServers,
      activeServers:     srv.activeServers,
      totalMembers:      srv.totalMembers,
      commandsToday:     live.commandsToday,
      aiRequestsToday:   live.aiRequestsToday,
      warningsToday:     live.warningsToday,
      bansToday:         live.bansToday,
      messagesTotal:     live.messagesToday,
      ticketsToday:      live.ticketsToday,
      errorsToday:       live.errorsToday,
      cpuUsage:          Number((process.cpuUsage().user / 1_000_000).toFixed(2)),
      ramMb:             Math.round(mem.rss / 1024 / 1024),
      heapMb:            Math.round(mem.heapUsed / 1024 / 1024),
      uptime:            Math.floor(process.uptime()),
      timestamp:         Date.now(),
    };
  },

  async snapshot(): Promise<void> {
    const payload = await this.getDashboardPayload();
    try {
      if (prisma?.globalStatsSnapshot?.create) {
        await prisma.globalStatsSnapshot.create({ data: { ...payload, capturedAt: new Date() } });
      }
    } catch (err) {
      dbLogger.debug({ err }, 'Stats snapshot failed');
    }
  },
};
