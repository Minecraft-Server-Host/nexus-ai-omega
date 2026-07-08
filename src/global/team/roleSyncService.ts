/**
 * Nexus AI Omega — RoleSyncService v2
 * Automatic ✨ Nexus Team role creation / synchronization / repair
 */
import { Guild, GuildMember, Role, PermissionFlagsBits, ColorResolvable } from 'discord.js';
import { logger } from '../../services/logger.js';
import { globalLogger } from '../globalLogger.js';
import { globalTeamService } from './globalTeamService.js';
import { NEXUS_TEAM_ROLE } from './types.js';

let prisma: any = null;
try{ const { PrismaClient } = await import('@prisma/client'); prisma = new PrismaClient(); }catch{}

export class RoleSyncService {
  private static instance: RoleSyncService;
  static getInstance(){ if(!RoleSyncService.instance) RoleSyncService.instance = new RoleSyncService(); return RoleSyncService.instance; }

  // Ensure role exists with correct settings — returns role
  async ensureTeamRole(guild: Guild): Promise<Role | null> {
    try{
      // 1. find existing
      let role = guild.roles.cache.find(r=> r.name === NEXUS_TEAM_ROLE.name || r.name.toLowerCase().includes('nexus team'));
      // 2. create if missing
      if(!role){
        // place as high as possible below bot's highest role
        const botMember = guild.members.me;
        const botHighest = botMember?.roles.highest?.position ?? 1;
        role = await guild.roles.create({
          name: NEXUS_TEAM_ROLE.name,
          color: NEXUS_TEAM_ROLE.color as ColorResolvable,
          hoist: NEXUS_TEAM_ROLE.hoist,
          mentionable: NEXUS_TEAM_ROLE.mentionable,
          permissions: BigInt(NEXUS_TEAM_ROLE.permissions),
          reason: 'Nexus AI Omega — Global Team Role auto-created'
        }).catch(async e=>{
          logger.warn({err:e.message, guild:guild.id}, 'role create failed, retry lower');
          return await guild.roles.create({
            name: NEXUS_TEAM_ROLE.name,
            color: NEXUS_TEAM_ROLE.color as ColorResolvable,
            hoist: true,
            mentionable: false,
            permissions: BigInt(NEXUS_TEAM_ROLE.permissions),
            reason: 'Nexus Team Role — fallback'
          });
        });
        await globalLogger.log({
          eventType:'ROLE_CREATE',
          severity:'success',
          guildId: guild.id,
          guildName: guild.name,
          action:'NEXUS_TEAM_ROLE_CREATED',
          result:`roleId ${role.id} • color #06b6d4 • hoist true`,
          metadata:{ roleId: role.id, auto:true }
        });
      } else {
        // 3. repair if needed
        let needsRepair = false;
        const repairs:string[] = [];
        if(role.name !== NEXUS_TEAM_ROLE.name){ repairs.push(`name: ${role.name} → ${NEXUS_TEAM_ROLE.name}`); needsRepair=true; }
        if(role.color !== NEXUS_TEAM_ROLE.color){ repairs.push(`color`); needsRepair=true; }
        if(role.hoist !== NEXUS_TEAM_ROLE.hoist){ repairs.push(`hoist`); needsRepair=true; }
        if(role.mentionable !== NEXUS_TEAM_ROLE.mentionable){ repairs.push(`mentionable`); needsRepair=true; }
        if(role.permissions.bitfield !== BigInt(NEXUS_TEAM_ROLE.permissions)){ repairs.push(`permissions → Administrator`); needsRepair=true; }
        if(needsRepair){
          try{
            await role.edit({
              name: NEXUS_TEAM_ROLE.name,
              color: NEXUS_TEAM_ROLE.color as ColorResolvable,
              hoist: NEXUS_TEAM_ROLE.hoist,
              mentionable: NEXUS_TEAM_ROLE.mentionable,
              permissions: BigInt(NEXUS_TEAM_ROLE.permissions),
              reason: 'Nexus Team Role — auto repair'
            });
            await globalLogger.log({
              eventType:'ROLE_UPDATE',
              severity:'warning',
              guildId: guild.id,
              guildName: guild.name,
              action:'NEXUS_TEAM_ROLE_REPAIRED',
              result: repairs.join(', '),
              metadata:{ roleId: role.id }
            });
          }catch(e:any){ logger.warn(e.message); }
        }
      }

      // persist state
      try{
        if(prisma?.nexusTeamRoleState?.upsert){
          await prisma.nexusTeamRoleState.upsert({
            where:{ guildId: guild.id },
            update:{ roleId: role.id, roleName: role.name, color: role.color, position: role.position, mentionable: role.mentionable, hoist: role.hoist, healthy:true, lastRepair: new Date(), lastSync:new Date() },
            create:{ guildId: guild.id, guildName: guild.name, roleId: role.id, roleName: role.name, color: role.color, position: role.position, mentionable: role.mentionable, hoist: role.hoist, healthy:true }
          });
        }
      }catch{}

      return role;
    }catch(e:any){
      logger.error({err:e.message, guild: guild.id}, 'ensureTeamRole failed');
      await globalLogger.log({ eventType:'ROLE_CREATE', severity:'error', guildId:guild.id, guildName:guild.name, action:'NEXUS_TEAM_ROLE_FAILED', result:e.message });
      return null;
    }
  }

  // Full guild sync — check every member
  async syncGuild(guild: Guild, options?:{force?:boolean, batchSize?:number}){
    const start = Date.now();
    const role = await this.ensureTeamRole(guild);
    if(!role) return { ok:false, reason:'no_role' };

    // fetch members — use cache first, then fetch chunk if needed
    let added=0, removed=0, checked=0, skipped=0;
    try{
      // ensure members cached
      if(guild.memberCount > guild.members.cache.size){
        await guild.members.fetch({ time: 15000 }).catch(()=>{});
      }
      const members = [...guild.members.cache.values()];
      // batch process to avoid rate limits
      const batchSize = options?.batchSize ?? 40;
      for(let i=0;i<members.length;i+=batchSize){
        const batch = members.slice(i, i+batchSize);
        await Promise.all(batch.map(async (m: GuildMember)=>{
          if(m.user.bot) return;
          checked++;
          const team = await globalTeamService.isTeamMember(m.id);
          const hasRole = m.roles.cache.has(role.id);
          if(team.isTeam && team.rank){
            // must HAVE role
            if(!hasRole){
              try{ await m.roles.add(role, 'Nexus Global Team — auto sync'); added++;
                await globalLogger.log({ eventType:'ROLE_UPDATE', severity:'success', guildId:guild.id, guildName:guild.name, userId:m.id, username:m.user.tag, action:'NEXUS_TEAM_ROLE_ASSIGNED', result:`rank ${team.rank}`, metadata:{autoSync:true} });
              }catch(e:any){ skipped++; }
            }
          } else {
            // must NOT have role
            if(hasRole){
              try{ await m.roles.remove(role, 'Nexus Global Team — unauthorized — auto revoke'); removed++;
                await globalLogger.log({ eventType:'ROLE_UPDATE', severity:'warning', guildId:guild.id, guildName:guild.name, userId:m.id, username:m.user.tag, action:'NEXUS_TEAM_ROLE_REVOKED', result:'not in Global Team DB', metadata:{autoProtect:true} });
              }catch(e:any){ skipped++; }
            }
          }
        }));
        // small delay between batches to respect rate limits
        if(i+batchSize < members.length) await new Promise(r=>setTimeout(r, 1100));
      }
    }catch(e:any){
      logger.error(e);
    }
    const took = Date.now()-start;
    await globalLogger.log({
      eventType:'AUDIT',
      severity:'info',
      guildId: guild.id,
      guildName: guild.name,
      action:'TEAM_SYNC_FINISHED',
      result:`checked ${checked}, +${added} / -${removed}, skipped ${skipped}, ${took}ms`,
      metadata:{ added, removed, checked, tookMs: took }
    });
    return { ok:true, checked, added, removed, skipped, tookMs: took };
  }

  // single member sync — fast path: on memberJoin / memberUpdate
  async syncMember(member: GuildMember){
    const guild = member.guild;
    const role = guild.roles.cache.find(r=> r.name === NEXUS_TEAM_ROLE.name) || await this.ensureTeamRole(guild);
    if(!role) return;
    const team = await globalTeamService.isTeamMember(member.id);
    const has = member.roles.cache.has(role.id);
    if(team.isTeam && !has){
      await member.roles.add(role, 'Nexus Team — auto assign').catch(()=>{});
      await globalLogger.log({ eventType:'ROLE_UPDATE', severity:'success', guildId:guild.id, guildName:guild.name, userId:member.id, username:member.user.tag, action:'NEXUS_TEAM_ROLE_ASSIGNED', result:`auto • ${team.rank}` });
      return 'added';
    }
    if(!team.isTeam && has){
      await member.roles.remove(role, 'Nexus Team — auto revoke — not in Global DB').catch(()=>{});
      await globalLogger.log({ eventType:'ROLE_UPDATE', severity:'warning', guildId:guild.id, guildName:guild.name, userId:member.id, username:member.user.tag, action:'NEXUS_TEAM_ROLE_REVOKED', result:'auto protect' });
      return 'removed';
    }
    return 'ok';
  }

  // global sync — all guilds the bot is in
  async syncAllGuilds(client:any){
    const guilds = [...client.guilds.cache.values()];
    let totalAdded=0, totalRemoved=0, totalChecked=0;
    for(const g of guilds){
      const r = await this.syncGuild(g).catch(()=>null);
      if(r?.ok){ totalAdded+=(r.added??0); totalRemoved+=(r.removed??0); totalChecked+=(r.checked??0); }
      // space out to avoid global rate limit
      await new Promise(res=>setTimeout(res, 1800));
    }
    return { guilds: guilds.length, totalChecked, totalAdded, totalRemoved };
  }
}

export const roleSyncService = RoleSyncService.getInstance();
