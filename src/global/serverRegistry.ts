/**
 * Nexus AI Omega — Global Server Database v3.2
 * Tracks every connected Discord server
 */
import { logger } from '../services/logger.js';
import { globalLogger } from './globalLogger.js';

let prisma: any = null;
try{ const { PrismaClient } = await import('@prisma/client'); prisma = new PrismaClient(); }catch{}
const mem = new Map<string, any>();

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
  static getInstance(){ if(!ServerRegistry.instance) ServerRegistry.instance = new ServerRegistry(); return ServerRegistry.instance; }

  async upsertServer(data: GlobalServerInput){
    const payload = {
      guildId: data.guildId,
      name: data.name,
      icon: data.icon ?? null,
      ownerId: data.ownerId,
      ownerTag: data.ownerTag ?? null,
      memberCount: data.memberCount,
      premium: data.premium ?? false,
      locale: data.locale ?? 'en-US',
      region: data.region ?? null,
      active: true,
      lastActivity: new Date(),
      botVersion: process.env.npm_package_version || '3.2.0-global'
    };
    try{
      if(prisma?.globalServer?.upsert){
        await prisma.globalServer.upsert({
          where:{ guildId: data.guildId },
          update:{ name: payload.name, icon: payload.icon, memberCount: payload.memberCount, ownerId: payload.ownerId, lastActivity: new Date(), active:true },
          create: payload
        });
      } else {
        mem.set(data.guildId, { ...mem.get(data.guildId), ...payload, totalCommands:0n, totalAiRequests:0n });
      }
    }catch(e:any){ mem.set(data.guildId, payload); }
    return payload;
  }

  async markLeft(guildId:string, guildName?:string){
    try{
      if(prisma?.globalServer?.update){
        await prisma.globalServer.update({ where:{ guildId }, data:{ active:false, leftAt:new Date() }});
      }
      const m = mem.get(guildId); if(m) m.active=false;
    }catch{}
    await globalLogger.log({ eventType:'SERVER_LEAVE', severity:'warning', guildId, guildName, result:'Bot removed from guild', action:'GUILD_DELETE' });
  }

  async touchActivity(guildId:string){
    try{
      if(prisma?.globalServer?.update){
        await prisma.globalServer.update({ where:{ guildId }, data:{ lastActivity:new Date() }}).catch(()=>{});
      }
    }catch{}
  }

  async incrementStat(guildId:string, field:'totalCommands'|'totalAiRequests'|'totalMessages', inc=1){
    try{
      if(prisma?.globalServer?.update){
        await prisma.globalServer.update({ where:{ guildId }, data:{ [field]: { increment: inc }, lastActivity: new Date() }}).catch(()=>{});
      }
    }catch{}
  }

  async getAllActive(){
    try{
      if(prisma?.globalServer?.findMany){
        return await prisma.globalServer.findMany({ where:{ active:true }, orderBy:{ memberCount:'desc' }});
      }
    }catch{}
    return [...mem.values()].filter(s=>s.active!==false);
  }

  async getStats(){
    const servers = await this.getAllActive();
    const totalServers = servers.length;
    const totalMembers = servers.reduce((a:any,s:any)=> a + (s.memberCount||0), 0);
    return { totalServers, activeServers: totalServers, totalMembers };
  }
}

export const serverRegistry = ServerRegistry.getInstance();
