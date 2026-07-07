/**
 * Nexus AI Omega — Global User Restriction System v3.2
 * Cross-server ban — enforced BEFORE any slash command
 */
import { logger } from '../services/logger.js';
import { globalLogger } from './globalLogger.js';

// Prisma optional fallback to memory
let prisma: any = null;
try{ const { PrismaClient } = await import('@prisma/client'); prisma = new PrismaClient(); }catch{}
const memBan = new Map<string, any>();

export interface GlobalBanRecord {
  userId: string;
  username: string;
  reason: string;
  bannedBy: string;
  moderatorTag: string;
  severity?: number;
  evidence?: string;
  expiresAt?: Date | null;
}

export class RestrictionManager {
  private static instance: RestrictionManager;
  private cache = new Map<string, {banned:boolean, expires:number}>();
  private CACHE_TTL = 60_000;

  private constructor(){
    setInterval(()=>this.gc(), 60_000);
  }
  static getInstance(){ if(!RestrictionManager.instance) RestrictionManager.instance = new RestrictionManager(); return RestrictionManager.instance; }

  private gc(){ const now=Date.now(); for(const [k,v] of this.cache){ if(v.expires < now) this.cache.delete(k); } }

  async isRestricted(userId: string): Promise<{restricted:boolean, record?:any}>{
    // cache
    const c = this.cache.get(userId);
    if(c) return { restricted: c.banned };
    let rec: any = null;
    try{
      if(prisma?.globalBan?.findUnique){
        rec = await prisma.globalBan.findUnique({ where:{ userId } });
      } else {
        rec = memBan.get(userId) || null;
      }
    }catch{ rec = memBan.get(userId) || null; }
    const banned = !!rec && rec.active !== false && (!rec.expiresAt || new Date(rec.expiresAt) > new Date());
    this.cache.set(userId, { banned, expires: Date.now()+this.CACHE_TTL });
    return { restricted: banned, record: rec };
  }

  async ban(data: GlobalBanRecord){
    const record = {
      userId: data.userId,
      username: data.username,
      reason: data.reason,
      bannedBy: data.bannedBy,
      moderatorTag: data.moderatorTag,
      severity: data.severity ?? 5,
      evidence: data.evidence ?? null,
      active: true,
      banCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: data.expiresAt ?? null
    };
    try{
      if(prisma?.globalBan?.upsert){
        await prisma.globalBan.upsert({
          where:{ userId: data.userId },
          update:{ active:true, reason:data.reason, bannedBy:data.bannedBy, moderatorTag:data.moderatorTag, updatedAt:new Date(), banCount:{ increment:1 } },
          create: record
        });
        if(prisma?.globalBanHistory?.create){
          await prisma.globalBanHistory.create({ data:{ userId:data.userId, action:'BAN', reason:data.reason, moderatorId:data.bannedBy, moderatorTag:data.moderatorTag, metadata:{ severity:record.severity, evidence: record.evidence } }});
        }
      } else {
        memBan.set(data.userId, record);
      }
    }catch(e:any){ memBan.set(data.userId, record); logger.warn(e.message); }
    this.cache.set(data.userId, { banned:true, expires: Date.now()+this.CACHE_TTL });
    // global log
    await globalLogger.log({
      eventType:'BLACKLIST_EVENTS',
      severity:'security',
      userId: data.userId,
      username: data.username,
      moderatorId: data.bannedBy,
      moderatorTag: data.moderatorTag,
      action:'GLOBAL_BAN',
      reason: data.reason,
      result:`User globally banned across ${'all'} Nexus servers`,
      metadata:{ severity: record.severity, evidence: record.evidence }
    });
    logger.warn({userId:data.userId, mod:data.moderatorTag}, 'GLOBAL_BAN applied');
    return record;
  }

  async unban(userId:string, moderatorId:string, moderatorTag:string, reason?:string){
    try{
      if(prisma?.globalBan?.update){
        await prisma.globalBan.update({ where:{ userId }, data:{ active:false, unbannedAt:new Date(), unbannedBy:moderatorId, unbanReason:reason??null, updatedAt:new Date() }});
        await prisma.globalBanHistory.create({ data:{ userId, action:'UNBAN', reason: reason||'appeal accepted', moderatorId, moderatorTag }});
      }
      memBan.delete(userId);
    }catch{}
    this.cache.set(userId, { banned:false, expires: Date.now()+this.CACHE_TTL });
    await globalLogger.log({
      eventType:'BLACKLIST_EVENTS',
      severity:'success',
      userId,
      moderatorId,
      moderatorTag,
      action:'GLOBAL_UNBAN',
      reason: reason || 'manual unban',
      result:'User restriction lifted globally'
    });
    return { ok:true };
  }

  async getInfo(userId:string){
    const { restricted, record } = await this.isRestricted(userId);
    let history:any[]=[];
    try{
      if(prisma?.globalBanHistory?.findMany){
        history = await prisma.globalBanHistory.findMany({ where:{ userId }, orderBy:{ createdAt:'desc' }, take:20 });
      }
    }catch{}
    return { userId, restricted, record, history };
  }

  async listBlacklist(page=1, pageSize=25, search?:string){
    try{
      if(prisma?.globalBan?.findMany){
        const where:any = { active:true };
        if(search){ where.OR = [{ userId:{ contains: search }},{ username:{ contains: search, mode:'insensitive' }}]; }
        const [items,total] = await Promise.all([
          prisma.globalBan.findMany({ where, orderBy:{ createdAt:'desc' }, skip:(page-1)*pageSize, take:pageSize }),
          prisma.globalBan.count({ where })
        ]);
        return { items, total, page, pageSize, pages: Math.ceil(total/pageSize) };
      }
    }catch{}
    // memory fallback
    const items = [...memBan.values()].filter(b=>b.active && (!search || b.userId.includes(search) || b.username.toLowerCase().includes(search.toLowerCase())));
    const start=(page-1)*pageSize;
    return { items: items.slice(start, start+pageSize), total: items.length, page, pageSize, pages: Math.ceil(items.length/pageSize) };
  }

  // middleware: call BEFORE any command
  async validateInteraction(interaction:any): Promise<{allowed:boolean, message?:string}>{
    const userId = interaction.user?.id;
    if(!userId) return { allowed:true };
    const { restricted, record } = await this.isRestricted(userId);
    if(restricted){
      await globalLogger.log({
        eventType:'SECURITY_ALERT',
        severity:'warning',
        userId,
        username: interaction.user.tag,
        guildId: interaction.guildId,
        guildName: interaction.guild?.name,
        action:'BLOCKED_COMMAND_ATTEMPT',
        command: interaction.commandName,
        result:'denied — global restriction active',
        metadata:{ banReason: record?.reason }
      });
      return { allowed:false, message: '⛔ You are currently restricted from using Nexus AI Omega.\n\n**Reason:** '+(record?.reason || 'Violation of Nexus Global Terms')+`\n**Case ID:** ${record?.id || userId}\n\nIf you believe this is a mistake, please contact the Nexus Team:\nhttps://discord.gg/nexus-ai` };
    }
    return { allowed:true };
  }
}

export const restrictionManager = RestrictionManager.getInstance();
