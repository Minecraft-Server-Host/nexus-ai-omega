/**
 * Nexus AI Omega — Global Team Types v5.0
 */
export const NEXUS_RANKS = [
  'OWNER', 'CO_OWNER', 'MANAGER', 'DEVELOPER',
  'AI_MANAGER', 'MODERATOR', 'SUPPORT', 'TEAM',
] as const;

export type NexusRank = (typeof NEXUS_RANKS)[number];

export const RANK_META: Record<NexusRank, { level: number; emoji: string; label: string; color: number }> = {
  OWNER:      { level: 100, emoji: '👑', label: 'Nexus Owner',      color: 0xfbbf24 },
  CO_OWNER:   { level: 95,  emoji: '💎', label: 'Nexus Co-Owner',   color: 0xe879f9 },
  MANAGER:    { level: 80,  emoji: '🛡',  label: 'Nexus Manager',    color: 0xf43f5e },
  DEVELOPER:  { level: 75,  emoji: '⚙️', label: 'Nexus Developer',  color: 0x0ea5e9 },
  AI_MANAGER: { level: 70,  emoji: '🤖', label: 'Nexus AI Manager', color: 0xa855f7 },
  MODERATOR:  { level: 60,  emoji: '🛡️', label: 'Nexus Moderator',  color: 0x06ffa5 },
  SUPPORT:    { level: 50,  emoji: '🎫', label: 'Nexus Support',    color: 0x22c55e },
  TEAM:       { level: 10,  emoji: '👥', label: 'Nexus Team',       color: 0x06b6d4 },
};

export const TEAM_STATUS = ['ACTIVE', 'SUSPENDED', 'REMOVED', 'INACTIVE'] as const;
export type TeamStatus = (typeof TEAM_STATUS)[number];

// Default Team IDs (from original project)
export const TEAM_IDS: Record<NexusRank, string[]> = {
  OWNER:      ['1097607057244442764'],
  CO_OWNER:   ['1056815951980527678'],
  MANAGER:    [], DEVELOPER: [], AI_MANAGER: [],
  MODERATOR:  [], SUPPORT: [], TEAM: [],
};

export const ALL_TEAM_IDS = new Set(Object.values(TEAM_IDS).flat());

export const NEXUS_TEAM_ROLE = {
  name: '✨ Nexus Team',
  color: 0x06b6d4,
  hoist: true,
  mentionable: false,
  permissions: '8' as const,
  reason: 'Nexus AI Omega v5 — Global Team Role',
};

export const RANK_PERMISSIONS: Record<NexusRank, string[]> = {
  OWNER:      ['*'],
  CO_OWNER:   ['global.ban', 'global.unban', 'team.manage', 'security.defcon', 'ai.admin'],
  MANAGER:    ['team.view', 'moderation.*', 'ticket.manage', 'analytics.*'],
  DEVELOPER:  ['dev.deploy', 'dev.logs', 'dev.api', 'system.status', 'ai.debug'],
  AI_MANAGER: ['ai.*', 'ai.train', 'ai.config', 'ai.analytics'],
  MODERATOR:  ['moderation.ban', 'moderation.kick', 'moderation.warn', 'ticket.*'],
  SUPPORT:    ['ticket.*', 'moderation.warn', 'user.lookup'],
  TEAM:       ['ticket.view', 'system.status'],
};

export function getEffectivePermissions(rank: NexusRank): string[] {
  const rankLevel = RANK_META[rank].level;
  const perms = new Set<string>();
  for (const [r, p] of Object.entries(RANK_PERMISSIONS)) {
    if (RANK_META[r as NexusRank].level <= rankLevel) {
      p.forEach(x => perms.add(x));
    }
  }
  return [...perms];
}

export function canAct(actorRank: NexusRank, targetRank: NexusRank): boolean {
  return RANK_META[actorRank].level > RANK_META[targetRank].level;
}

// FIX: rankFromString war in teamCommands.ts importiert aber nicht definiert
export function rankFromString(s: string): NexusRank {
  const upper = s.toUpperCase() as NexusRank;
  return NEXUS_RANKS.includes(upper) ? upper : 'TEAM';
}
