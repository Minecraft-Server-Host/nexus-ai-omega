// Nexus AI Omega — Core Types v2.1

export type DefconLevel = 5 | 4 | 3 | 2 | 1;

export interface NexusGuildConfig {
  id: string;
  defconLevel: DefconLevel;
  aiEnabled: boolean;
  securityEnabled: boolean;
  automodEnabled: boolean;
  levelingEnabled: boolean;
  economyEnabled: boolean;
}

export interface GatewayEvent {
  op: number;
  t?: string;
  s?: number;
  d: any;
  shard?: number;
  guild_id?: string;
}

export interface SecurityVelocity {
  userId: string;
  action: string;
  timestamps: number[];
  count5s: number;
}

export interface AIModule {
  id: string;
  name: string;
  enabled: boolean;
  latencyTargetMs: number;
}

export const AI_MODULES = [
  'HYBRID_AUTOMOD',
  'RAG_TICKET_HELPDESK',
  'AI_SERVER_BUILDER',
  'AI_DISCORD_DESIGNER',
  'AI_SECURITY_ADVISOR',
  'AI_COMMUNITY_MANAGER',
  'AI_ANALYTICS',
  'AI_SERVER_HEALTH',
  'AI_PERFORMANCE_OPTIMIZER',
  'AI_PLUGIN_GENERATOR',
  'AI_COMMAND_GENERATOR',
  'AI_EMBED_BUILDER',
  'AI_ROLE_DESIGNER',
  'AI_PERMISSION_INSPECTOR',
  'AI_CHANNEL_BUILDER',
  'AI_EVENT_PLANNER',
  'AI_BUG_DETECTOR',
  'AI_CODE_ASSISTANT'
] as const;

export type AIModuleId = typeof AI_MODULES[number];

export interface AIInferenceRequest {
  module: AIModuleId;
  guildId?: string;
  userId?: string;
  prompt: string;
  context?: Record<string, any>;
  stream?: boolean;
}

export interface AIInferenceResponse {
  success: boolean;
  module: AIModuleId;
  output: any;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
  costUsd: number;
}

export interface AutomodResult {
  action: 'allow' | 'warn' | 'delete' | 'timeout' | 'quarantine';
  score: number; // 0-1 toxicity
  triggers: string[];
  reason: string;
  aiEvaluated: boolean;
}

export interface ZeroTrustAlert {
  guildId: string;
  actorId: string;
  threat: 'NUKE_VELOCITY' | 'TOKEN_LEAK' | 'PHISHING' | 'RAID_SWARM' | 'PRIV_ESCALATION';
  severity: 1|2|3|4|5;
  actionsTaken: string[];
  defcon: DefconLevel;
  timestamp: number;
}

export interface LiveTelemetry {
  shards: { id: number; ping: number; status: string; guilds: number }[];
  messagesPerSec: number;
  commandsPerMin: number;
  aiInferences: number;
  defconGlobal: DefconLevel;
  ramMb: number;
  cpu: number;
  uptime: number;
  guilds: number;
  users: number;
  cacheHit: number;
}

export interface TicketAIContext {
  ticketId: string;
  history: { role: 'user'|'assistant'; content: string }[];
  faqMatches: { score: number; answer: string }[];
}
