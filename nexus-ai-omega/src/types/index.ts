/**
 * Nexus AI Omega — Complete Type System v5.0
 * Every interface, enum, and type for the entire platform.
 */

// ── Core enums ───────────────────────────────────────────────────────────────
export type DefconLevel = 5 | 4 | 3 | 2 | 1;

export type Severity = 'success' | 'info' | 'warning' | 'error' | 'ai' | 'security';

export type TicketType =
  | 'bewerbung'
  | 'support'
  | 'feedback'
  | 'bug'
  | 'partnerschaft'
  | 'sonstiges';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export type TicketStatus = 'open' | 'claimed' | 'pending' | 'closed' | 'archived';

export type ApplicationRecommendation = 'accept' | 'consider' | 'reject';

export type AIProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'mistral'
  | 'deepseek'
  | 'xai'
  | 'cohere'
  | 'perplexity'
  | 'ollama'
  | 'openrouter'
  | 'azure'
  | 'together'
  | 'nexus-mock'
  | 'auto';

// ── AI Modules ────────────────────────────────────────────────────────────────
export const AI_MODULES = [
  'HYBRID_AUTOMOD',
  'RAG_TICKET_HELPDESK',
  'AI_SERVER_BUILDER',
  'AI_TICKET_SYSTEM',
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
  'AI_CODE_ASSISTANT',
  'AI_APPLICATION_REVIEWER',
] as const;

export type AIModuleId = (typeof AI_MODULES)[number];

// ── Guild config ──────────────────────────────────────────────────────────────
export interface NexusGuildConfig {
  id: string;
  name: string;
  defconLevel: DefconLevel;
  aiEnabled: boolean;
  securityEnabled: boolean;
  automodEnabled: boolean;
  levelingEnabled: boolean;
  economyEnabled: boolean;
  ticketsEnabled: boolean;
  aiProvider: AIProviderId;
  aiModel?: string;
  ticketCategoryId?: string;
  logChannelId?: string;
  welcomeChannelId?: string;
  muteRoleId?: string;
  language: string;
  prefix: string;
  isPremium: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── AI Provider ────────────────────────────────────────────────────────────────
export interface AIProvider {
  id: AIProviderId;
  name: string;
  models: string[];
  apiKeyEnv: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;
  costInPer1k: number;
  costOutPer1k: number;
  maxTokens: number;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  supportsSystemPrompt?: boolean;
  supportsTools?: boolean;
}

// ── Conversation ──────────────────────────────────────────────────────────────
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokenEstimate?: number;
}

export interface ConversationContext {
  id: string;
  guildId: string;
  userId: string;
  channelId?: string;
  module: AIModuleId;
  history: ConversationMessage[];
  tokensUsed: number;
  turnCount: number;
  createdAt: number;
  lastUpdated: number;
  metadata?: Record<string, unknown>;
}

// ── AI Request / Response ──────────────────────────────────────────────────────
export interface AIInferenceRequest {
  requestId?: string;
  module: AIModuleId;
  guildId?: string;
  userId?: string;
  channelId?: string;
  prompt: string;
  context?: Record<string, unknown>;
  stream?: boolean;
  provider?: AIProviderId;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  conversationId?: string;
  systemPromptOverride?: string;
  byoApiKey?: string;
}

export interface AIInferenceResponse {
  success: boolean;
  requestId: string;
  module: AIModuleId;
  output: unknown;
  text: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
  provider: AIProviderId;
  costUsd: number;
  cached: boolean;
  fallback: boolean;
  conversationId?: string;
  error?: string;
}

// ── AutoMod ────────────────────────────────────────────────────────────────────
export interface AutomodResult {
  action: 'allow' | 'warn' | 'delete' | 'timeout' | 'quarantine' | 'ban';
  score: number;
  confidence: number;
  triggers: string[];
  reason: string;
  aiEvaluated: boolean;
  suggestedDuration?: number;
}

// ── Security ───────────────────────────────────────────────────────────────────
export type ZeroTrustThreat =
  | 'NUKE_VELOCITY'
  | 'TOKEN_LEAK'
  | 'PHISHING'
  | 'RAID_SWARM'
  | 'PRIV_ESCALATION'
  | 'SPAM_WAVE'
  | 'MASS_DM'
  | 'INVITE_SPAM'
  | 'ALT_ACCOUNT';

export interface ZeroTrustAlert {
  id: string;
  guildId: string;
  actorId: string;
  threat: ZeroTrustThreat;
  severity: 1 | 2 | 3 | 4 | 5;
  actionsTaken: string[];
  defcon: DefconLevel;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface DeviceVerification {
  deviceHash: string;
  ipHash: string;
  riskScore: number;
  verified: boolean;
  isVPN: boolean;
  isDatacenter: boolean;
}

// ── Ticket system ──────────────────────────────────────────────────────────────
export interface TicketRecord {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  claimedBy?: string;
  fields: Record<string, string>;
  aiSummary?: string;
  aiPriority?: TicketPriority;
  duplicateOf?: string;
  closedBy?: string;
  closedReason?: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface ApplicationReview {
  grammar: number;
  seriousness: number;
  completeness: number;
  experience: number;
  overall: number;
  recommendation: ApplicationRecommendation;
  feedback: string;
  missingFields: string[];
  improvements: string[];
  strengths: string[];
  warnings: string[];
}

export interface SupportAnalysis {
  priority: TicketPriority;
  category: string;
  summary: string;
  possibleSolutions: string[];
  duplicate: boolean;
  estimatedResolutionTime: string;
  requiredInfo?: string[];
}

// ── Server Builder ─────────────────────────────────────────────────────────────
export interface ChannelDef {
  name: string;
  type: 'text' | 'voice' | 'forum' | 'stage' | 'announcement';
  topic?: string;
  nsfw?: boolean;
  slowmode?: number;
  emoji?: string;
}

export interface CategoryDef {
  name: string;
  channels: ChannelDef[];
  private?: boolean;
  allowedRoles?: string[];
}

export interface RoleDef {
  name: string;
  color: string;
  permissions: string[];
  hoist?: boolean;
  mentionable?: boolean;
  emoji?: string;
  description?: string;
}

export interface ServerBuildPlan {
  id: string;
  theme: string;
  style: string;
  purpose: string;
  targetAudience: string;
  estimatedSize: string;
  palette: string[];
  categories: CategoryDef[];
  roles: RoleDef[];
  welcomeMessage: string;
  rulesTemplate: string;
  verificationLevel: 0 | 1 | 2 | 3 | 4;
  boosterPerks: string;
  aiChannels: string[];
  suggestedBots: string[];
  estimatedSetupMs: number;
  generatedAt: number;
  seed: string;
}

// ── Telemetry ──────────────────────────────────────────────────────────────────
export interface LiveTelemetry {
  shards: { id: number; ping: number; status: string; guilds: number; events: number }[];
  messagesPerSec: number;
  commandsPerMin: number;
  aiInferences: number;
  aiCacheHitRate: number;
  defconGlobal: DefconLevel;
  ramMb: number;
  heapMb: number;
  cpu: number;
  uptime: number;
  guilds: number;
  users: number;
  cacheHit: number;
  dbLatencyMs: number;
  apiLatencyMs: number;
  ticketsOpen: number;
  securityAlerts: number;
}

// ── Global log ─────────────────────────────────────────────────────────────────
export interface GlobalLogInput {
  eventType: string;
  severity?: Severity;
  guildId?: string;
  guildName?: string;
  channelId?: string;
  channelName?: string;
  userId?: string;
  username?: string;
  userAvatar?: string;
  moderatorId?: string;
  moderatorTag?: string;
  action?: string;
  command?: string;
  reason?: string;
  result?: string;
  metadata?: Record<string, unknown>;
  shardId?: number;
  latencyMs?: number;
}

// ── Level / XP ────────────────────────────────────────────────────────────────
export interface UserLevel {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  rank: number;
  totalMessages: number;
  lastMessage: Date;
  nextLevelXp: number;
  progressPercent: number;
}

// ── Economy ───────────────────────────────────────────────────────────────────
export interface EconomyBalance {
  userId: string;
  guildId: string;
  balance: bigint;
  bank: bigint;
  lastDaily: Date | null;
  streak: number;
}

// ── Rate limit ────────────────────────────────────────────────────────────────
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ── Cache keys ────────────────────────────────────────────────────────────────
export const CacheKeys = {
  guildConfig:    (id: string)          => `nexus:v5:guild:${id}:config`,
  globalBan:      (id: string)          => `nexus:v5:ban:${id}`,
  aiResponse:     (hash: string)        => `nexus:v5:ai:resp:${hash}`,
  rateLimit:      (id: string, w: string) => `nexus:v5:rl:${w}:${id}`,
  teamMember:     (id: string)          => `nexus:v5:team:${id}`,
  defcon:         (guildId: string)     => `nexus:v5:defcon:${guildId}`,
  conversation:   (uid: string, gid: string) => `nexus:v5:conv:${gid}:${uid}`,
  ticket:         (tid: string)         => `nexus:v5:ticket:${tid}`,
  ticketCount:    (gid: string)         => `nexus:v5:tickets:count:${gid}`,
  buildPlan:      (uid: string, gid: string) => `nexus:v5:build:${gid}:${uid}`,
  userLevel:      (uid: string, gid: string) => `nexus:v5:level:${gid}:${uid}`,
  phishingList:   ()                    => `nexus:v5:security:phishing`,
  serverStats:    (gid: string)         => `nexus:v5:stats:${gid}`,
} as const;
