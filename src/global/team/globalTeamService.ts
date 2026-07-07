/**
 * Nexus AI Omega — GlobalTeamService v2
 * Secure Global Nexus Team Database — source of truth
 */
import { logger } from '../../services/logger.js';
import { NEXUS_RANKS, NexusRank, TEAM_IDS, ALL_TEAM_IDS, RANK_META, getEffectivePermissions, TeamStatus } from './types.js';
import { globalLogger } from '../globalLogger.js';

let prisma: any = null;
try{ const { PrismaClient } = await import('@prisma/client'); prisma = new PrismaClient(); }catch{}
const memTeam = new Map<string, any>();

export interface TeamMemberRecord {
  userId: string;
  username: string;
  discriminator?: string;
  avatar?: string | null;
  globalName?: string | null;
  rank: NexusRank;
  status: TeamStatus;
  joinDate?: Date;
  addedBy?: string | null;
  addedByTag?: string | null;
  notes?: string | null;
  permissions?: string[];
  verified?: boolean;
}

export class GlobalTeamService {
  private static instance: GlobalTeamService;
  private cache = new Map<string, {rec:any, exp:number}>();
  private CACHE_TTL = 45_000;

  private constructor(){}
  static getInstance(){ if(!GlobalTeamService.instance) GlobalTeamService.instance = new GlobalTeamService(); return GlobalTeamService.instance; }

  async bootstrapDefaultTeam(){
    // Auto-register default IDs from TEAM_IDS
    let inserted = 0;
    for(const rank of NEXUS_RANKS){
      const ids = TEAM_IDS[rank] || [];
      for(const userId of ids){
        const exists = await this.getMember(userId);
        if(!exists){
          await this.addMember({
            userId,
            username: `nexus-${rank.toLowerCase()}`,
            rank,
            status: 'ACTIVE',
            addedBy: 'SYSTEM_BOOTSTRAP',
            addedByTag: 'Nexus AI Omega',
            notes: 'Auto-registered default Nexus Team — Global Team System v2',
            permissions: getEffectivePermissions(rank),
            verified: true
          }, { silent: true });
          inserted++;
        }
      }
    }
    if(inserted) logger.info({inserted}, '🌐 Nexus Team bootstrap — default IDs registered');
    return inserted;
  }

  private cacheSet(userId:string, rec:any){
    this.cache.set(userId, { rec, exp: Date.now()+this.CACHE_TTL });
  }
  private cacheGet(userId:string){
    const c = this.cache.get(userId);
    if(!c) return null;
    if(c.exp < Date.now()){ this.cache.delete(userId); return null; }
    return c.rec;
  }

  async getMember(userId:string){
    const cached = this.cacheGet(userId);
    if(cached) return cached;
    try{
      if(prisma?.nexusTeamMember?.findUnique){
        const r = await prisma.nexusTeamMember.findUnique({ where:{ userId }});
        if(r){ this.cacheSet(userId, r); return r; }
      }
    }catch{}
    const m = memTeam.get(userId) || null;
    if(m) this.cacheSet(userId, m);
    return m;
  }

  async isTeamMember(userId:string): Promise<{isTeam:boolean, rank?:NexusRank, status?:string, record?:any}>{
    // fast set check first
    const rec = await this.getMember(userId);
    if(!rec) return { isTeam: false };
    const status = rec.status || (rec.active ? 'ACTIVE' : 'SUSPENDED');
    const isTeam = status === 'ACTIVE';
    return { isTeam, rank: (rec.rank || rec.role) as NexusRank, status, record: rec };
  }

  async addMember(data: Partial<TeamMemberRecord> & {userId:string, rank:NexusRank}, opts?:{silent?:boolean}){
    const record = {
      userId: data.userId,
      username: data.username || 'unknown',
      discriminator: data.discriminator ?? '0',
      avatar: data.avatar ?? null,
      globalName: data.globalName ?? null,
      rank: data.rank,
      role: data.rank, // legacy compat
      status: data.status || 'ACTIVE',
      active: (data.status || 'ACTIVE') === 'ACTIVE',
      joinDate: data.joinDate || new Date(),
      addedBy: data.addedBy || null,
      addedByTag: data.addedByTag || null,
      notes: data.notes || null,
      permissions: data.permissions || getEffectivePermissions(data.rank),
      verified: data.verified ?? true,
      twoFactorEnabled: false,
      lastSeen: new Date(),
      lastActive: new Date(),
      badges: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    try{
      if(prisma?.nexusTeamMember?.upsert){
        await prisma.nexusTeamMember.upsert({
          where:{ userId: data.userId },
          update:{
            username: record.username,
            rank: record.rank,
            role: record.rank,
            status: record.status,
            active: record.active,
            permissions: record.permissions,
            updatedAt: new Date()
          },
          create: record
        });
        // history
        if(prisma?.nexusTeamHistory?.create){
          await prisma.nexusTeamHistory.create({
            data:{
              userId: record.userId,
              action:'ADD',
              newRank: record.rank,
              reason: data.notes || 'Team member added',
              moderatorId: data.addedBy || 'SYSTEM',
              moderatorTag: data.addedByTag || 'System',
              metadata:{ source:'GlobalTeamService' }
            }
          });
        }
      }
    }catch(e:any){ logger.warn(e.message); }
    memTeam.set(data.userId, record);
    this.cache.set(data.userId, { rec: record, exp: Date.now()+this.CACHE_TTL });
    if(!opts?.silent){
      await globalLogger.log({
        eventType:'AUDIT',
        severity:'success',
        userId: record.userId,
        username: record.username,
        moderatorId: data.addedBy || undefined,
        moderatorTag: data.addedByTag || undefined,
        action:'TEAM_ADD',
        result:`${record.rank} — ${RANK_META[record.rank as NexusRank]?.label}`,
        reason: data.notes || undefined,
        metadata:{ rank: record.rank }
      });
    }
    return record;
  }

  async removeMember(userId:string, moderatorId:string, moderatorTag:string, reason?:string){
    try{
      if(prisma?.nexusTeamMember?.update){
        await prisma.nexusTeamMember.update({ where:{ userId }, data:{ status:'REMOVED', active:false, updatedAt:new Date() }});
        await prisma.nexusTeamHistory.create({ data:{ userId, action:'REMOVE', reason: reason||'removed', moderatorId, moderatorTag }});
      }
    }catch{}
    const m = memTeam.get(userId); if(m){ m.status='REMOVED'; m.active=false; }
    this.cache.delete(userId);
    await globalLogger.log({
      eventType:'AUDIT', severity:'warning',
      userId, moderatorId, moderatorTag,
      action:'TEAM_REMOVE',
      reason: reason || 'removed from Nexus Team',
      result:'status=REMOVED — role will be stripped globally'
    });
    return { ok:true };
  }

  async setRank(userId:string, newRank:NexusRank, moderatorId:string, moderatorTag:string, reason?:string){
    const existing = await this.getMember(userId);
    const oldRank = existing?.rank || existing?.role || null;
    try{
      if(prisma?.nexusTeamMember?.update){
        await prisma.nexusTeamMember.update({
          where:{ userId },
          data:{ rank:newRank, role:newRank, permissions: getEffectivePermissions(newRank), updatedAt:new Date() }
        });
        await prisma.nexusTeamHistory.create({
          data:{ userId, action: 'PROMOTE', oldRank, newRank, reason: reason||'rank change', moderatorId, moderatorTag }
        });
      }
    }catch{}
    const mem = memTeam.get(userId); if(mem){ mem.rank=newRank; mem.role=newRank; mem.permissions=getEffectivePermissions(newRank); }
    this.cache.delete(userId);
    await globalLogger.log({
      eventType:'AUDIT', severity:'info',
      userId, moderatorId, moderatorTag,
      action: 'TEAM_PROMOTE',
      result:`${oldRank} → ${newRank}`,
      reason,
      metadata:{ oldRank, newRank }
    });
    return { ok:true, oldRank, newRank };
  }

  async setStatus(userId:string, status:TeamStatus, moderatorId:string, moderatorTag:string, reason?:string){
    const active = status === 'ACTIVE';
    try{
      if(prisma?.nexusTeamMember?.update){
        await prisma.nexusTeamMember.update({ where:{ userId }, data:{ status, active, updatedAt:new Date() }});
        await prisma.nexusTeamHistory.create({ data:{ userId, action: status, reason, moderatorId, moderatorTag }});
      }
    }catch{}
    const mem = memTeam.get(userId); if(mem){ mem.status=status; mem.active=active; }
    this.cache.delete(userId);
    await globalLogger.log({
      eventType:'AUDIT', severity: status==='SUSPENDED' ? 'warning' : 'success',
      userId, moderatorId, moderatorTag,
      action:`TEAM_${status}`,
      reason,
      result:`status → ${status}`
    });
    return { ok:true };
  }

  async listAll(){
    try{
      if(prisma?.nexusTeamMember?.findMany){
        return await prisma.nexusTeamMember.findMany({ orderBy:[{ rank:'asc' },{ createdAt:'asc' }]});
      }
    }catch{}
    return [...memTeam.values()];
  }

  async getHistory(userId:string, limit=25){
    try{
      if(prisma?.nexusTeamHistory?.findMany){
        return await prisma.nexusTeamHistory.findMany({ where:{ userId }, orderBy:{ createdAt:'desc' }, take: limit });
      }
    }catch{}
    return [];
  }

  // permission check
  async hasPermission(userId:string, requiredPerm:string): Promise<boolean>{
    const m = await this.getMember(userId);
    if(!m) return false;
    if((m.status|| (m.active?'ACTIVE':'SUSPENDED')) !== 'ACTIVE') return false;
    const rank = (m.rank || m.role) as NexusRank;
    const perms = m.permissions?.length ? m.permissions : getEffectivePermissions(rank);
    return perms.includes('*') || perms.includes(requiredPerm) || perms.some((p:string)=> requiredPerm.startsWith(p.replace('.*','')) );
  }

  async getRank(userId:string): Promise<NexusRank | null> {
    const m = await this.getMember(userId);
    if(!m) return null;
    return (m.rank || m.role) as NexusRank;
  }
}

export const globalTeamService = GlobalTeamService.getInstance();
