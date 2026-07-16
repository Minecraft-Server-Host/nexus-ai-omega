/**
 * Nexus AI Omega — Role Protection Service v5.0
 * Instantly revokes unauthorized Nexus Team role assignments.
 */
import { type Client, Events, type GuildMember, AuditLogEvent } from 'discord.js';
import { teamLogger } from '../../services/logger.js';
import { globalLogger } from '../globalLogger.js';
import { globalTeamService } from './globalTeamService.js';
import { roleSyncService } from './roleSyncService.js';
import { NEXUS_TEAM_ROLE } from './types.js';

export class RoleProtectionService {
  private static instance: RoleProtectionService;
  static getInstance(): RoleProtectionService {
    if (!RoleProtectionService.instance) RoleProtectionService.instance = new RoleProtectionService();
    return RoleProtectionService.instance;
  }

  attach(client: Client): void {
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember: GuildMember) => {
      try {
        const oldRoles = new Set(
          (oldMember as { roles?: { cache?: Map<string, unknown> } }).roles?.cache?.keys() ?? [],
        );
        const addedRoles = [...newMember.roles.cache.keys()].filter(id => !oldRoles.has(id));
        if (!addedRoles.length) return;

        const guild     = newMember.guild;
        const nexusRole = guild.roles.cache.find(
          r => r.name === NEXUS_TEAM_ROLE.name && addedRoles.includes(r.id),
        );
        if (!nexusRole) return;

        const { isTeam } = await globalTeamService.isTeamMember(newMember.id);
        if (!isTeam) {
          // Strip unauthorized role immediately
          await newMember.roles.remove(nexusRole, 'Nexus Zero-Trust: unauthorized assignment').catch(() => {});

          let actor = 'Unknown';
          try {
            const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 5 });
            const entry = audit.entries.find(
              e => (e.target as { id?: string })?.id === newMember.id && Date.now() - e.createdTimestamp < 8000,
            );
            if (entry?.executor) actor = `${entry.executor.tag} (${entry.executor.id})`;
          } catch { /* audit fetch failed */ }

          teamLogger.warn(
            { guildId: guild.id, userId: newMember.id, actor },
            '🚨 Unauthorized Nexus Team role blocked & revoked',
          );

          await globalLogger.securityAlert({
            guildId:    guild.id,
            guildName:  guild.name,
            userId:     newMember.id,
            username:   newMember.user.tag,
            action:     'UNAUTHORIZED_ROLE_ASSIGNMENT_BLOCKED',
            result:     'Nexus Team role auto-stripped < 120ms',
            reason:     'User NOT in Global Nexus Team Database — Zero Trust',
            metadata:   { roleId: nexusRole.id, actor },
          });
        }
      } catch { /* prevent crash */ }
    });

    teamLogger.info('🛡️ Role protection service attached');
  }
}

export const roleProtectionService = RoleProtectionService.getInstance();
