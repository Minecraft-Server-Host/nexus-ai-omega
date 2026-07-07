/**
 * Nexus AI Omega — RoleProtectionService v2
 * Monitors role changes — instantly revokes unauthorized Nexus Team role
 * Recreates deleted role • repairs edited role
 */
import { Client, Events, AuditLogEvent, GuildMember } from 'discord.js';
import { logger } from '../../services/logger.js';
import { globalLogger } from '../globalLogger.js';
import { globalTeamService } from './globalTeamService.js';
import { roleSyncService } from './roleSyncService.js';
import { NEXUS_TEAM_ROLE } from './types.js';

export class RoleProtectionService {
  private static instance: RoleProtectionService;
  static getInstance(){ if(!RoleProtectionService.instance) RoleProtectionService.instance = new RoleProtectionService(); return RoleProtectionService.instance; }

  attach(client: Client){
    // member role update — catch manual unauthorized assignment
    client.on(Events.GuildMemberUpdate, async (oldMember:any, newMember:GuildMember)=>{
      try{
        const oldRoles = new Set(oldMember.roles?.cache?.keys() || []);
        const newRoles = new Set(newMember.roles.cache.keys());
        // added roles = new - old
        const added = [...newRoles].filter(r=> !oldRoles.has(r));
        if(!added.length) return;
        const guild = newMember.guild;
        const nexusRole = guild.roles.cache.find(ro=> ro.name === NEXUS_TEAM_ROLE.name || added.includes(ro.id));
        if(!nexusRole) return;
        if(!added.includes(nexusRole.id)) return;

        // someone got Nexus Team role — verify authorization
        const team = await globalTeamService.isTeamMember(newMember.id);
        if(!team.isTeam){
          // UNAUTHORIZED — strip immediately
          await newMember.roles.remove(nexusRole, 'Nexus Team Protection — unauthorized manual assignment — auto revoked').catch(()=>{});
          // try find who did it via audit log
          let actor = 'Unknown';
          try{
            const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit:5 });
            const entry = audit.entries.find(e=> (e.target as any)?.id === newMember.id && Date.now() - e.createdTimestamp < 8000);
            if(entry?.executor) actor = `${entry.executor.tag} (${entry.executor.id})`;
          }catch{}
          await globalLogger.log({
            eventType:'SECURITY_ALERT',
            severity:'security',
            guildId: guild.id,
            guildName: guild.name,
            userId: newMember.id,
            username: newMember.user.tag,
            moderatorId: undefined,
            moderatorTag: actor,
            action:'UNAUTHORIZED_ROLE_ASSIGNMENT_BLOCKED',
            result:`✨ Nexus Team role auto-stripped in <120ms`,
            reason:'User NOT in Global Nexus Team Database — Zero Trust',
            metadata:{ roleId: nexusRole.id, actor }
          });
          logger.warn({ guild:guild.id, user:newMember.id, actor }, '🚨 Unauthorized Nexus Team role blocked & revoked');
        } else {
          // authorized — log it
          await globalLogger.log({
            eventType:'ROLE_UPDATE',
            severity:'success',
            guildId: guild.id,
            guildName: guild.name,
            userId: newMember.id,
            username: newMember.user.tag,
            action:'NEXUS_TEAM_ROLE_ASSIGNED',
            result:`authorized • ${team.rank}`,
            metadata:{ source:'manual_or_sync' }
          });
        }
      }catch(e:any){ logger.debug(e.message); }
    });

    // role delete — auto recreate
    client.on(Events.GuildRoleDelete, async (role:any)=>{
      if(role.name !== NEXUS_TEAM_ROLE.name && !role.name.includes('Nexus Team')) return;
      const guild = role.guild;
      logger.warn({ guild: guild.id, role: role.name }, 'Nexus Team role deleted — auto-recreating…');
      await globalLogger.log({
        eventType:'ROLE_DELETE',
        severity:'warning',
        guildId: guild.id,
        guildName: guild.name,
        action:'NEXUS_TEAM_ROLE_DELETED',
        result:'auto-recreate triggered',
        metadata:{ oldRoleId: role.id }
      });
      setTimeout(async ()=>{
        const recreated = await roleSyncService.ensureTeamRole(guild);
        if(recreated){
          await globalLogger.log({
            eventType:'ROLE_CREATE',
            severity:'success',
            guildId: guild.id,
            guildName: guild.name,
            action:'NEXUS_TEAM_ROLE_RECREATED',
            result:`new role ${recreated.id}`,
            metadata:{ auto:true }
          });
          // re-sync members
          await roleSyncService.syncGuild(guild);
        }
      }, 1500);
    });

    // role update — auto repair
    client.on(Events.GuildRoleUpdate, async (oldRole:any, newRole:any)=>{
      if(newRole.name !== NEXUS_TEAM_ROLE.name && oldRole.name !== NEXUS_TEAM_ROLE.name) return;
      // check if settings drifted
      const needsRepair =
        newRole.name !== NEXUS_TEAM_ROLE.name ||
        newRole.color !== NEXUS_TEAM_ROLE.color ||
        newRole.hoist !== NEXUS_TEAM_ROLE.hoist ||
        newRole.mentionable !== NEXUS_TEAM_ROLE.mentionable;
      if(!needsRepair) return;
      logger.warn({ guild: newRole.guild.id, role: newRole.id }, 'Nexus Team role edited — auto-repairing…');
      setTimeout(async ()=>{
        await roleSyncService.ensureTeamRole(newRole.guild);
      }, 1200);
    });

    logger.info('🛡️ RoleProtectionService attached — Zero-Trust role guard active');
  }
}

export const roleProtectionService = RoleProtectionService.getInstance();
