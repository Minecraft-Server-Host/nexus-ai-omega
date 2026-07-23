/**
 * Nexus AI Omega — Team Panel API Routes v1.0
 * All panel data endpoints: bot stats, servers, AI, logs, team
 */
import { Router, Request, Response } from 'express';
import { requireDashboard, requireOwner, requireAuth } from '../auth/authRoutes.js';
import { authService } from '../auth/authService.js';
import type { NexusUser } from '../auth/authService.js';
import { getDB } from '../services/database.js';
import { RANK_META, type NexusRank } from '../global/team/types.js';

const router = Router();

// ── Helper: get live bot client (if available) ────────────────────────────
let botClient: any = null;
export function setBotClient(client: any): void { botClient = client; }

// ── GET /panel/home ───────────────────────────────────────────────────────
router.get('/home', requireDashboard, async (req: Request, res: Response) => {
  const user = (req as any).nexusUser as NexusUser;
  const db = await getDB();

  // Aggregate quick stats
  const totalUsers   = ((db as any).prepare('SELECT COUNT(*) as c FROM nexus_users').get() as any)?.c ?? 0;
  const totalLogs    = ((db as any).prepare('SELECT COUNT(*) as c FROM nexus_audit_logs').get() as any)?.c ?? 0;
  const totalServers = botClient?.guilds?.cache?.size ?? 0;
  const botPing      = botClient?.ws?.ping ?? -1;
  const botUptime    = botClient?.uptime ?? 0;

  return res.json({
    ok: true,
    user: {
      id:               user.id,
      username:         user.username,
      discord_id:       user.discord_id,
      discord_username: user.discord_username,
      avatar:           user.avatar,
      role:             user.role,
      permission_level: user.permission_level,
      status:           user.status,
    },
    stats: {
      total_panel_users: totalUsers,
      total_audit_logs:  totalLogs,
      bot_servers:       totalServers,
      bot_ping:          botPing,
      bot_uptime_ms:     botUptime,
    },
    system: {
      node_version: process.version,
      uptime_ms:    process.uptime() * 1000,
      memory_mb:    Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      env:          process.env.NODE_ENV || 'development',
    },
  });
});

// ── GET /panel/bot ────────────────────────────────────────────────────────
router.get('/bot', requireDashboard, async (_req: Request, res: Response) => {
  const db = await getDB();

  const guilds       = botClient?.guilds?.cache;
  const totalServers = guilds?.size ?? 0;
  const totalUsers   = guilds?.reduce((acc: number, g: any) => acc + (g.memberCount || 0), 0) ?? 0;
  const ping         = botClient?.ws?.ping ?? -1;
  const uptime       = botClient?.uptime ?? 0;
  const commandsUsed = ((db as any).prepare("SELECT COUNT(*) as c FROM nexus_audit_logs WHERE action='COMMAND'").get() as any)?.c ?? 0;

  // Active guilds (those with settings)
  const activeGuilds = ((db as any).prepare('SELECT COUNT(DISTINCT guild_id) as c FROM guild_settings').get() as any)?.c ?? 0;

  // Shard info
  const shards = botClient?.ws?.shards?.size ?? 1;

  return res.json({
    ok: true,
    bot: {
      status:         botClient ? 'online' : 'offline',
      username:       botClient?.user?.username ?? 'Unknown',
      tag:            botClient?.user?.tag ?? 'Unknown',
      id:             botClient?.user?.id ?? 'Unknown',
      avatar:         botClient?.user?.avatarURL?.() ?? null,
      ping,
      uptime_ms:      uptime,
      total_servers:  totalServers,
      total_users:    totalUsers,
      active_servers: activeGuilds,
      shards,
      commands_used:  commandsUsed,
    },
  });
});

// ── GET /panel/ai ─────────────────────────────────────────────────────────
router.get('/ai', requireDashboard, async (_req: Request, res: Response) => {
  const db = await getDB();

  const totalReqs  = ((db as any).prepare('SELECT COUNT(*) as c FROM ai_history').get() as any)?.c ?? 0;
  const recentReqs = (db as any).prepare('SELECT * FROM ai_history ORDER BY timestamp DESC LIMIT 20').all() ?? [];
  const providers  = ['groq', 'gemini', 'openai', 'anthropic'].map(p => ({
    name:       p,
    configured: !!process.env[`${p.toUpperCase()}_API_KEY`],
    status:     !!process.env[`${p.toUpperCase()}_API_KEY`] ? 'online' : 'unconfigured',
  }));

  // Active conversations (last 5 min)
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const activeConvs = ((db as any).prepare('SELECT COUNT(DISTINCT guild_id) as c FROM ai_history WHERE timestamp > ?').get(fiveMinAgo) as any)?.c ?? 0;

  return res.json({
    ok: true,
    ai: {
      total_requests:        totalReqs,
      active_conversations:  activeConvs,
      providers,
      recent_logs:           recentReqs,
    },
  });
});

// ── GET /panel/servers ────────────────────────────────────────────────────
router.get('/servers', requireDashboard, async (_req: Request, res: Response) => {
  const db = await getDB();

  const guilds = botClient?.guilds?.cache;
  if (!guilds) {
    // Fallback from DB
    const dbServers = (db as any).prepare('SELECT DISTINCT guild_id FROM guild_settings LIMIT 100').all() as { guild_id: string }[];
    return res.json({ ok: true, servers: dbServers.map(s => ({ id: s.guild_id, name: 'Unknown', member_count: 0, from_cache: false })) });
  }

  const servers = guilds.map((g: any) => ({
    id:           g.id,
    name:         g.name,
    icon:         g.iconURL?.() ?? null,
    member_count: g.memberCount,
    owner_id:     g.ownerId,
    created_at:   g.createdTimestamp,
    from_cache:   true,
  })).sort((a: any, b: any) => b.member_count - a.member_count);

  return res.json({ ok: true, servers, total: servers.length });
});

// ── GET /panel/servers/:id ────────────────────────────────────────────────
router.get('/servers/:id', requireDashboard, async (req: Request, res: Response) => {
  const db = await getDB();
  const guildId = req.params.id;
  const guild = botClient?.guilds?.cache?.get(guildId);

  const settings = (db as any).prepare('SELECT * FROM guild_settings WHERE guild_id=?').get(guildId) ?? {};
  const warnings = ((db as any).prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id=?').get(guildId) as any)?.c ?? 0;
  const tickets  = ((db as any).prepare('SELECT COUNT(*) as c FROM tickets WHERE guild_id=?').get(guildId) as any)?.c ?? 0;

  return res.json({
    ok: true,
    server: {
      id:           guildId,
      name:         guild?.name ?? 'Unknown',
      icon:         guild?.iconURL?.() ?? null,
      member_count: guild?.memberCount ?? 0,
      owner_id:     guild?.ownerId ?? null,
      created_at:   guild?.createdTimestamp ?? null,
      settings,
      stats: { warnings, tickets },
    },
  });
});

// ── DELETE /panel/servers/:id/leave ───────────────────────────────────────
router.post('/servers/:id/leave', requireOwner, async (req: Request, res: Response) => {
  const actor = (req as any).nexusUser as NexusUser;
  const guild = botClient?.guilds?.cache?.get(req.params.id);
  if (!guild) return res.status(404).json({ ok: false, error: 'Server not found in bot cache.' });
  try {
    await guild.leave();
    await authService.audit(actor.id, 'BOT_LEAVE_SERVER', `Left server: ${guild.name} (${guild.id})`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /panel/team ───────────────────────────────────────────────────────
router.get('/team', requireDashboard, async (_req: Request, res: Response) => {
  const users = await authService.getAllUsers();
  const team = users.filter(u => u.permission_level > 0 || u.dashboard_access);
  return res.json({
    ok: true,
    team: team.map(u => ({
      id:               u.id,
      username:         u.username,
      discord_id:       u.discord_id,
      discord_username: u.discord_username,
      avatar:           u.avatar,
      role:             u.role,
      permission_level: u.permission_level,
      status:           u.status,
      dashboard_access: u.dashboard_access,
      last_login:       u.last_login,
      created_at:       u.created_at,
      rank_meta:        RANK_META[u.role as NexusRank] ?? null,
    })),
  });
});

// ── PATCH /panel/team/:id/promote ─────────────────────────────────────────
router.patch('/team/:id/promote', requireOwner, async (req: Request, res: Response) => {
  const actor = (req as any).nexusUser as NexusUser;
  const { role, permission_level, dashboard_access } = req.body as { role: string; permission_level: number; dashboard_access: 0 | 1 };
  const target = await authService.getUser(parseInt(req.params.id));
  if (!target) return res.status(404).json({ ok: false, error: 'User not found.' });

  // Actor must have higher perm level than what they're assigning
  if (actor.permission_level <= (permission_level || 0) && actor.discord_id !== '1097607057244442764') {
    return res.status(403).json({ ok: false, error: 'Cannot assign permissions higher than your own.' });
  }

  await authService.updateUser(parseInt(req.params.id), { role: role as any, permission_level, dashboard_access });
  await authService.audit(actor.id, 'TEAM_PROMOTE', `${target.username} → ${role} (perm: ${permission_level})`);
  return res.json({ ok: true });
});

// ── GET /panel/logs ───────────────────────────────────────────────────────
router.get('/logs', requireDashboard, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query['limit'] as string || '100'), 500);
  const type  = req.query['type'] as string | undefined;
  const logs  = await authService.getLogs(limit, type);
  return res.json({ ok: true, logs });
});

// ── GET /panel/logs/bot-commands ──────────────────────────────────────────
router.get('/logs/commands', requireDashboard, async (req: Request, res: Response) => {
  const db = await getDB();
  const limit = Math.min(parseInt(req.query['limit'] as string || '50'), 200);
  const logs = (db as any).prepare('SELECT * FROM nexus_audit_logs WHERE action LIKE ? ORDER BY timestamp DESC LIMIT ?').all('CMD_%', limit);
  return res.json({ ok: true, logs });
});

// ── GET /panel/stats/overview ─────────────────────────────────────────────
router.get('/stats/overview', requireDashboard, async (_req: Request, res: Response) => {
  const db = await getDB();
  const stats = {
    panel_users:   ((db as any).prepare('SELECT COUNT(*) as c FROM nexus_users').get() as any)?.c ?? 0,
    audit_logs:    ((db as any).prepare('SELECT COUNT(*) as c FROM nexus_audit_logs').get() as any)?.c ?? 0,
    bot_guilds:    botClient?.guilds?.cache?.size ?? 0,
    ai_requests:   ((db as any).prepare('SELECT COUNT(*) as c FROM ai_history').get() as any)?.c ?? 0,
    warnings:      ((db as any).prepare('SELECT COUNT(*) as c FROM warnings').get() as any)?.c ?? 0,
    tickets:       ((db as any).prepare('SELECT COUNT(*) as c FROM tickets').get() as any)?.c ?? 0,
    economy_users: ((db as any).prepare('SELECT COUNT(*) as c FROM economy').get() as any)?.c ?? 0,
  };
  return res.json({ ok: true, stats });
});

export default router;
