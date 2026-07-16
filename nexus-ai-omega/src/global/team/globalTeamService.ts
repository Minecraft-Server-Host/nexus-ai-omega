/**
 * Nexus AI Omega — Global Team Service v5.0
 */
import { dbLogger } from '../../services/logger.js';
import { cacheGet, cacheSet } from '../../services/redisCache.js';
import { NEXUS_RANKS, TEAM_IDS, ALL_TEAM_IDS, getEffectivePermissions, type NexusRank, type TeamStatus } from './types.js';

let prisma: {
  nexusTeamMember?: {
    findUnique: (opts: unknown) => Promise<unknown>;
    upsert: (opts: unknown) => Promise<unknown>;
    findMany: (opts: unknown) => Promise<unknown[]>;
  };
} | null = null;

try {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
} catch { /* optional */ }

const memTeam = new Map<string, Record<string, unknown>>();

// Pre-populate from TEAM_IDS
for (const rank of NEXUS_RANKS) {
  for (const id of TEAM_IDS[rank]) {
    memTeam.set(id, { userId: id, rank, status: 'ACTIVE', permissions: getEffectivePermissions(rank) });
  }
}

export class GlobalTeamService {
  private static instance: GlobalTeamService;
  private cache = new Map<string, { rec: unknown; exp: number }>();
  private readonly TTL = 45_000;

  static getInstance(): GlobalTeamService {
    if (!GlobalTeamService.instance) GlobalTeamService.instance = new GlobalTeamService();
    return GlobalTeamService.instance;
  }

  async getMember(userId: string): Promise<Record<string, unknown> | null> {
    const cached = this.cache.get(userId);
    if (cached && cached.exp > Date.now()) return cached.rec as Record<string, unknown>;

    let rec: unknown = null;
    try {
      if (prisma?.nexusTeamMember?.findUnique) {
        rec = await prisma.nexusTeamMember.findUnique({ where: { userId } } as Parameters<typeof prisma.nexusTeamMember.findUnique>[0]);
      }
    } catch { /* ignore */ }

    if (!rec) rec = memTeam.get(userId) ?? null;
    if (rec) this.cache.set(userId, { rec, exp: Date.now() + this.TTL });
    return rec as Record<string, unknown> | null;
  }

  async getRank(userId: string): Promise<NexusRank | null> {
    const m = await this.getMember(userId);
    if (!m) return null;
    return (m['rank'] as NexusRank) ?? (m['role'] as NexusRank) ?? null;
  }

  async isTeamMember(userId: string): Promise<{ isTeam: boolean; rank?: NexusRank }> {
    if (ALL_TEAM_IDS.has(userId)) {
      const m = await this.getMember(userId);
      return { isTeam: true, rank: (m?.['rank'] as NexusRank) ?? 'TEAM' };
    }
    const m = await this.getMember(userId);
    if (!m || m['status'] === 'REMOVED' || m['status'] === 'SUSPENDED') {
      return { isTeam: false };
    }
    return { isTeam: !!m, rank: m['rank'] as NexusRank };
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const m = await this.getMember(userId);
    if (!m) return false;
    const perms = (m['permissions'] as string[]) ?? [];
    return perms.includes('*') || perms.includes(permission);
  }

  async getAllMembers(): Promise<unknown[]> {
    try {
      if (prisma?.nexusTeamMember?.findMany) {
        return await prisma.nexusTeamMember.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { rank: 'asc' },
        } as Parameters<typeof prisma.nexusTeamMember.findMany>[0]);
      }
    } catch { /* fallback */ }
    return [...memTeam.values()];
  }
}

export const globalTeamService = GlobalTeamService.getInstance();
