/**
 * Nexus AI Omega — Global Team System v2 — Types
 */

export const NEXUS_RANKS = [
  'OWNER',
  'CO_OWNER',
  'MANAGER',
  'DEVELOPER',
  'AI_MANAGER',
  'MODERATOR',
  'SUPPORT',
  'TEAM'
] as const;

export type NexusRank = typeof NEXUS_RANKS[number];

export const RANK_META: Record<NexusRank, { level: number; emoji: string; label: string; color: number }> = {
  OWNER:      { level: 100, emoji: '👑', label: 'Nexus Owner',      color: 0xfbbf24 },
  CO_OWNER:   { level: 95,  emoji: '💎', label: 'Nexus Co-Owner',  color: 0xe879f9 },
  MANAGER:    { level: 80,  emoji: '🛡', label: 'Nexus Manager',   color: 0xf43f5e },
  DEVELOPER:  { level: 75,  emoji: '⚙',  label: 'Nexus Developer', color: 0x0ea5e9 },
  AI_MANAGER: { level: 70,  emoji: '🤖', label: 'Nexus AI Manager',color: 0xa855f7 },
  MODERATOR:  { level: 60,  emoji: '🛡️', label: 'Nexus Moderator', color: 0x06ffa5 },
  SUPPORT:    { level: 50,  emoji: '🎫', label: 'Nexus Support',   color: 0x22c55e },
  TEAM:       { level: 10,  emoji: '👥', label: 'Nexus Team',      color: 0x06b6d4 },
};

export const TEAM_STATUS = ['ACTIVE','SUSPENDED','REMOVED','INACTIVE'] as const;
export type TeamStatus = typeof TEAM_STATUS[number];

// Default Team IDs — NEVER hardcode elsewhere
export const TEAM_IDS: Record<NexusRank, string[]> = {
  OWNER:      ['1097607057244442764'],
  CO_OWNER:   ['1056815951980527678'],
  MANAGER:    [],
  DEVELOPER:  [],
  AI_MANAGER: [],
  MODERATOR:  [],
  SUPPORT:    [],
  TEAM:       []
};

// Flatten for quick lookup
export const ALL_TEAM_IDS = new Set(Object.values(TEAM_IDS).flat());

// Role settings
export const NEXUS_TEAM_ROLE = {
  name: '✨ Nexus Team',
  color: 0x06b6d4, // Professional Cyan
  hoist: true,
  mentionable: false,
  permissions: '8' as const, // Administrator — Nexus Team bekommt vollen Server-Zugriff
  reason: 'Nexus AI Omega — Global Team Role — auto-managed'
};

// Permission matrix — rank inherits downwards
export const RANK_PERMISSIONS: Record<NexusRank, string[]> = {
  OWNER: [
    '*', // complete access
    'global.ban','global.unban','team.manage','team.promote','team.demote',
    'security.defcon','security.panic','ai.admin','economy.admin','billing.manage',
    'plugin.publish','system.shutdown','database.write','config.global'
  ],
  CO_OWNER: [
    'global.ban','global.unban','team.manage','team.promote','team.suspend',
    'security.defcon','ai.admin','economy.admin','plugin.publish','config.global',
    'moderation.*','ticket.*','analytics.*'
  ],
  MANAGER: [
    'team.view','team.sync',
    'moderation.*','ticket.manage','analytics.*','server.manage','user.warn','user.timeout'
  ],
  DEVELOPER: [
    'dev.deploy','dev.logs','dev.api','dev.plugins','dev.database.read',
    'system.status','ai.debug'
  ],
  AI_MANAGER: [
    'ai.*','ai.train','ai.config','ai.analytics','ai.moderation'
  ],
  MODERATOR: [
    'moderation.ban','moderation.kick','moderation.timeout','moderation.warn','moderation.purge',
    'ticket.claim','ticket.close','user.info'
  ],
  SUPPORT: [
    'ticket.view','ticket.reply','ticket.claim','user.info','knowledge.base'
  ],
  TEAM: [
    'team.view.self','dashboard.view','logs.read'
  ]
};

// build inherited permissions
export function getEffectivePermissions(rank: NexusRank): string[] {
  const idx = NEXUS_RANKS.indexOf(rank);
  if(idx === -1) return [];
  // lower ranks = higher index → inherit downwards
  const lowerRanks = NEXUS_RANKS.slice(idx);
  const perms = new Set<string>();
  for(const r of lowerRanks){
    (RANK_PERMISSIONS[r] || []).forEach(p=> perms.add(p));
  }
  // if OWNER has *, return *
  if(perms.has('*')) return ['*'];
  return [...perms];
}

export function canAct(actorRank: NexusRank, targetRank: NexusRank): boolean {
  return (RANK_META[actorRank]?.level ?? 0) > (RANK_META[targetRank]?.level ?? 0);
}

export function rankFromString(s: string): NexusRank | null {
  const u = s.toUpperCase().replace(/[\s\-]/g,'_');
  const map: Record<string,NexusRank> = {
    OWNER:'OWNER', COOWNER:'CO_OWNER', 'CO_OWNER':'CO_OWNER',
    MANAGER:'MANAGER', DEVELOPER:'DEVELOPER', DEV:'DEVELOPER',
    AI_MANAGER:'AI_MANAGER', AIMANAGER:'AI_MANAGER', AI:'AI_MANAGER',
    MODERATOR:'MODERATOR', MOD:'MODERATOR',
    SUPPORT:'SUPPORT',
    TEAM:'TEAM'
  };
  return map[u] ?? (NEXUS_RANKS.includes(u as any) ? u as NexusRank : null);
}
