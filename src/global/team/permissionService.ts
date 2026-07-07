/**
 * Nexus AI Omega — Global Permission Service v2
 * Rank-based • inherits downwards • no per-server config
 */
import { globalTeamService } from './globalTeamService.js';
import { getEffectivePermissions, NexusRank, canAct } from './types.js';

export class PermissionService {
  private static instance: PermissionService;
  static getInstance(){ if(!PermissionService.instance) PermissionService.instance = new PermissionService(); return PermissionService.instance; }

  async has(userId:string, permission:string): Promise<boolean>{
    return globalTeamService.hasPermission(userId, permission);
  }

  async getRank(userId:string): Promise<NexusRank | null>{
    return globalTeamService.getRank(userId);
  }

  async canManage(actorId:string, targetId:string): Promise<{allowed:boolean, reason?:string}>{
    const [actor, target] = await Promise.all([
      globalTeamService.getMember(actorId),
      globalTeamService.getMember(targetId)
    ]);
    if(!actor) return { allowed:false, reason:'Actor not in Nexus Team' };
    if(actor.status !== 'ACTIVE') return { allowed:false, reason:'Actor not active' };
    const actorRank = (actor.rank || actor.role) as NexusRank;
    // owner / co-owner bypass
    if(['OWNER','CO_OWNER'].includes(actorRank)) return { allowed:true };
    if(!target) return { allowed:true }; // adding new member
    const targetRank = (target.rank || target.role) as NexusRank;
    if(!canAct(actorRank, targetRank)){
      return { allowed:false, reason:`Insufficient rank — ${actorRank} cannot manage ${targetRank}` };
    }
    return { allowed:true };
  }

  async require(userId:string, perm:string){
    const ok = await this.has(userId, perm);
    if(!ok) throw new Error(`Missing global permission: ${perm}`);
    return true;
  }

  // helper maps for UI
  describeRank(rank:NexusRank){
    const { RANK_META, getEffectivePermissions } = require('./types.js');
    const meta = RANK_META[rank];
    return {
      rank,
      ...meta,
      permissions: getEffectivePermissions(rank)
    };
  }
}

export const permissionService = PermissionService.getInstance();
