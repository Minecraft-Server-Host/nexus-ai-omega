/**
 * Nexus AI Omega — Permission Service v5.0
 */
import { globalTeamService } from './globalTeamService.js';
import { type NexusRank, canAct } from './types.js';

export class PermissionService {
  private static instance: PermissionService;
  static getInstance(): PermissionService {
    if (!PermissionService.instance) PermissionService.instance = new PermissionService();
    return PermissionService.instance;
  }

  async has(userId: string, permission: string): Promise<boolean> {
    return globalTeamService.hasPermission(userId, permission);
  }

  async getRank(userId: string): Promise<NexusRank | null> {
    return globalTeamService.getRank(userId);
  }

  async canManage(
    actorId: string,
    targetId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const [actor, target] = await Promise.all([
      globalTeamService.getMember(actorId),
      globalTeamService.getMember(targetId),
    ]);

    if (!actor) return { allowed: false, reason: 'Actor not in Nexus Team' };
    if (actor['status'] === 'SUSPENDED' || actor['status'] === 'REMOVED') {
      return { allowed: false, reason: 'Actor account suspended' };
    }

    const actorRank = (actor['rank'] ?? actor['role']) as NexusRank;
    if (['OWNER', 'CO_OWNER'].includes(actorRank)) return { allowed: true };
    if (!target) return { allowed: true };

    const targetRank = (target['rank'] ?? target['role']) as NexusRank;
    if (!canAct(actorRank, targetRank)) {
      return { allowed: false, reason: `Insufficient rank — ${actorRank} cannot manage ${targetRank}` };
    }
    return { allowed: true };
  }

  async require(userId: string, perm: string): Promise<true> {
    const ok = await this.has(userId, perm);
    if (!ok) throw new Error(`Missing global permission: ${perm}`);
    return true;
  }
}

export const permissionService = PermissionService.getInstance();
