/**
 * Nexus AI Omega — Role Sync Service v5.2 (Complete Rewrite)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Auto Nexus Team Role System:
 *  ✅ Erstellt Nexus Team Rolle automatisch wenn Bot beitritt
 *  ✅ Positioniert Rolle direkt unter der höchsten Bot-Rolle
 *  ✅ Weist Rolle nur echten Nexus Team Mitgliedern zu
 *  ✅ Entfernt Rolle von Nicht-Team-Mitgliedern
 *  ✅ Erkennt & verhindert doppelte Rollen
 *  ✅ Synchronisiert bei Team-Status-Änderungen
 *  ✅ Loggt alle Aktionen
 * ═══════════════════════════════════════════════════════════════════
 */
import { type Guild, type Role, PermissionFlagsBits } from 'discord.js';
import { teamLogger }        from '../../services/logger.js';
import { globalLogger }      from '../globalLogger.js';
import { globalTeamService } from './globalTeamService.js';
import { NEXUS_TEAM_ROLE }   from './types.js';

export class RoleSyncService {
  private static instance: RoleSyncService;
  // Cooldown: verhindert doppelte Sync-Anfragen innerhalb 30s
  private syncCooldowns = new Map<string, number>();

  static getInstance(): RoleSyncService {
    if (!RoleSyncService.instance) RoleSyncService.instance = new RoleSyncService();
    return RoleSyncService.instance;
  }

  // ── Nexus Team Rolle sicherstellen ──────────────────────────────
  async ensureTeamRole(guild: Guild): Promise<Role | null> {
    try {
      // Cooldown prüfen (max 1x alle 30s pro Guild)
      const cooldownKey = `sync:${guild.id}`;
      const lastSync    = this.syncCooldowns.get(cooldownKey) ?? 0;
      if (Date.now() - lastSync < 30_000) return null;
      this.syncCooldowns.set(cooldownKey, Date.now());

      // Bestehende Nexus-Team-Rolle finden (Duplikat-Schutz)
      const existingRoles = guild.roles.cache.filter(r =>
        r.name === NEXUS_TEAM_ROLE.name ||
        r.name.toLowerCase() === 'nexus team' ||
        r.name.toLowerCase() === '✨ nexus team',
      );

      let role: Role | null = null;

      if (existingRoles.size > 1) {
        // Duplikate entfernen — älteste behalten
        const sorted = [...existingRoles.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        role = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          await sorted[i].delete('Nexus Team: Duplikat-Rolle entfernt').catch(() => {});
          teamLogger.info({ guildId: guild.id, roleId: sorted[i].id }, '🗑️ Duplikat Nexus-Rolle entfernt');
        }
      } else if (existingRoles.size === 1) {
        role = existingRoles.first()!;
      }

      // Rolle erstellen wenn nicht vorhanden
      if (!role) {
        const botMember = guild.members.me;
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
          teamLogger.warn({ guildId: guild.id }, '⚠️ Keine ManageRoles Berechtigung — Nexus Rolle kann nicht erstellt werden');
          return null;
        }

        role = await guild.roles.create({
          name:        NEXUS_TEAM_ROLE.name,
          color:       NEXUS_TEAM_ROLE.color,
          hoist:       NEXUS_TEAM_ROLE.hoist,
          mentionable: NEXUS_TEAM_ROLE.mentionable,
          permissions: BigInt(NEXUS_TEAM_ROLE.permissions),
          reason:      'Nexus AI Omega — Auto Team Role System v5.2',
        });

        teamLogger.info({ guildId: guild.id, roleId: role.id }, '✅ Nexus Team Rolle erstellt');

        await globalLogger.log({
          eventType: 'ROLE_CREATE',
          severity:  'success',
          guildId:   guild.id,
          guildName: guild.name,
          action:    'NEXUS_TEAM_ROLE_CREATED',
          result:    `Rolle "${role.name}" erstellt (ID: ${role.id})`,
          metadata:  { roleId: role.id, color: NEXUS_TEAM_ROLE.color },
        });
      }

      // Rolle so hoch wie möglich positionieren (direkt unter Bot-Rolle)
      try {
        const botHighest  = guild.members.me?.roles.highest;
        const targetPos   = Math.max(0, (botHighest?.position ?? 1) - 1);
        if (role.position !== targetPos && guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await role.setPosition(targetPos, { reason: 'Nexus Team Role Positioning' });
        }
      } catch { /* Positioning kann fehlschlagen wenn Berechtigungen fehlen */ }

      // Team-Mitglieder synchronisieren
      await this.syncTeamMembers(guild, role);

      return role;
    } catch (err) {
      teamLogger.error({ err, guildId: guild.id }, '❌ ensureTeamRole fehlgeschlagen');
      return null;
    }
  }

  // ── Team-Mitglieder synchronisieren ────────────────────────────
  async syncTeamMembers(guild: Guild, role: Role): Promise<void> {
    try {
      // Alle offiziellen Team-Mitglieder holen
      const teamMembers = await globalTeamService.getAllMembers() as Array<{ userId: string; status: string }>;
      const teamMemberIds = new Set(
        teamMembers.filter(m => m.status === 'ACTIVE').map(m => m.userId),
      );

      // Alle Guild-Mitglieder die die Rolle haben
      const membersWithRole = role.members;

      let assigned = 0;
      let removed  = 0;

      // Nicht-Team-Mitglieder entfernen
      for (const [memberId, member] of membersWithRole) {
        if (!teamMemberIds.has(memberId)) {
          await member.roles.remove(role, 'Nexus Team Sync: Nicht im Team').catch(() => {});
          removed++;
          teamLogger.info({ guildId: guild.id, userId: memberId }, '🔒 Nexus Rolle entzogen (nicht im Team)');
        }
      }

      // Team-Mitglieder hinzufügen die noch nicht die Rolle haben
      for (const teamMember of teamMembers.filter(m => m.status === 'ACTIVE')) {
        if (!membersWithRole.has(teamMember.userId)) {
          const guildMember = await guild.members.fetch(teamMember.userId).catch(() => null);
          if (guildMember && !guildMember.roles.cache.has(role.id)) {
            await guildMember.roles.add(role, 'Nexus Team Sync: Team-Mitglied').catch(() => {});
            assigned++;
            teamLogger.info({ guildId: guild.id, userId: teamMember.userId }, '✅ Nexus Rolle vergeben');
          }
        }
      }

      if (assigned > 0 || removed > 0) {
        teamLogger.info(
          { guildId: guild.id, roleId: role.id, assigned, removed },
          `🔄 Nexus Team Sync: +${assigned} / -${removed}`,
        );
      }
    } catch (err) {
      teamLogger.warn({ err, guildId: guild.id }, 'syncTeamMembers fehlgeschlagen');
    }
  }

  // ── Einzelnes Mitglied synchronisieren ────────────────────────
  async syncMember(guild: Guild, userId: string): Promise<void> {
    try {
      const role = guild.roles.cache.find(r => r.name === NEXUS_TEAM_ROLE.name);
      if (!role) {
        await this.ensureTeamRole(guild);
        return;
      }

      const { isTeam } = await globalTeamService.isTeamMember(userId);
      const member      = await guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      const hasRole = member.roles.cache.has(role.id);

      if (isTeam && !hasRole) {
        await member.roles.add(role, 'Nexus Team Sync').catch(() => {});
        teamLogger.info({ guildId: guild.id, userId }, '✅ Nexus Rolle vergeben (Sync)');
      } else if (!isTeam && hasRole) {
        await member.roles.remove(role, 'Nexus Team Sync: Nicht im Team').catch(() => {});
        teamLogger.info({ guildId: guild.id, userId }, '🔒 Nexus Rolle entzogen (Sync)');
      }
    } catch (err) {
      teamLogger.warn({ err, guildId: guild.id, userId }, 'syncMember fehlgeschlagen');
    }
  }

  // ── Alle bekannten Guilds synchronisieren ────────────────────
  async syncAllGuilds(guilds: Map<string, Guild>): Promise<void> {
    let total = 0;
    for (const [, guild] of guilds) {
      await this.ensureTeamRole(guild);
      total++;
      await new Promise(r => setTimeout(r, 500)); // Rate-Limit
    }
    teamLogger.info({ total }, '✅ Nexus Team Sync für alle Guilds abgeschlossen');
  }
}

export const roleSyncService = RoleSyncService.getInstance();
