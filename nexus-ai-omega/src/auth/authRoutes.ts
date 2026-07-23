/**
 * Nexus AI Omega — Auth API Routes v1.0
 * POST /auth/register, POST /auth/login, POST /auth/logout
 * GET  /auth/me, GET /auth/validate
 * Admin: GET /auth/users, PATCH /auth/users/:id
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authService, OWNER_DISCORD_ID, COOWNER_DISCORD_ID, detectRole } from './authService.js';
import type { NexusUser } from './authService.js';

const router = Router();

// ── CSRF / Sec headers middleware ─────────────────────────────────────────
router.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── Helper: extract token ─────────────────────────────────────────────────
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return (req.cookies as Record<string, string>)?.['nexus_token'] || null;
}

// ── Auth middleware ───────────────────────────────────────────────────────
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const user = await authService.validateSession(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Session expired or invalid.' });
  (req as any).nexusUser = user;
  next();
}

export async function requireDashboard(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const user = (req as any).nexusUser as NexusUser;
    if (!user.dashboard_access) {
      return res.status(403).json({ ok: false, error: 'Dashboard access denied.', code: 'NO_DASHBOARD' });
    }
    next();
  });
}

export async function requireOwner(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const user = (req as any).nexusUser as NexusUser;
    if (user.permission_level < 95) {
      return res.status(403).json({ ok: false, error: 'Owner/Co-Owner access required.' });
    }
    next();
  });
}

// ── POST /auth/register ───────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  const { username, discord_id, password, confirm_password } = req.body as Record<string, string>;

  if (!username || !discord_id || !password) {
    return res.status(400).json({ ok: false, error: 'All fields are required.' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ ok: false, error: 'Passwords do not match.' });
  }

  const result = await authService.register({
    username: username.trim(),
    discord_id: discord_id.trim(),
    password,
    ip: req.ip || req.socket?.remoteAddress,
  });

  if (!result.ok) return res.status(400).json(result);

  // Auto-login after register
  const loginResult = await authService.login({
    identifier: discord_id.trim(),
    password,
    ip: req.ip || req.socket?.remoteAddress,
    user_agent: req.headers['user-agent'],
  });

  if (loginResult.ok && loginResult.token) {
    res.cookie('nexus_token', loginResult.token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
    });
    return res.json({ ok: true, token: loginResult.token, user: sanitizeUser(loginResult.user!) });
  }
  return res.json({ ok: true, user: sanitizeUser(result.user!) });
});

// ── POST /auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { identifier, password } = req.body as Record<string, string>;
  if (!identifier || !password) {
    return res.status(400).json({ ok: false, error: 'Identifier and password required.' });
  }

  const result = await authService.login({
    identifier: identifier.trim(),
    password,
    ip: req.ip || req.socket?.remoteAddress,
    user_agent: req.headers['user-agent'],
  });

  if (!result.ok) return res.status(401).json(result);

  // Set secure cookie
  res.cookie('nexus_token', result.token!, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });

  return res.json({ ok: true, token: result.token, user: sanitizeUser(result.user!) });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (token) await authService.logout(token);
  res.clearCookie('nexus_token');
  return res.json({ ok: true });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).nexusUser as NexusUser;
  return res.json({ ok: true, user: sanitizeUser(user) });
});

// ── GET /auth/validate ────────────────────────────────────────────────────
router.get('/validate', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) return res.json({ ok: false, valid: false });
  const user = await authService.validateSession(token);
  if (!user) return res.json({ ok: false, valid: false });
  return res.json({ ok: true, valid: true, user: sanitizeUser(user) });
});

// ── GET /auth/users (Owner/Co-Owner only) ─────────────────────────────────
router.get('/users', requireOwner, async (_req: Request, res: Response) => {
  const users = await authService.getAllUsers();
  return res.json({ ok: true, users: users.map(sanitizeUser) });
});

// ── PATCH /auth/users/:id ─────────────────────────────────────────────────
router.patch('/users/:id', requireOwner, async (req: Request, res: Response) => {
  const targetId = parseInt(req.params.id);
  const actor = (req as any).nexusUser as NexusUser;
  const { role, permission_level, dashboard_access, status, discord_username, avatar } = req.body as Record<string, unknown>;

  // Safety: cannot edit owner unless you are the owner
  const target = await authService.getUser(targetId);
  if (!target) return res.status(404).json({ ok: false, error: 'User not found.' });
  if (target.discord_id === OWNER_DISCORD_ID && actor.discord_id !== OWNER_DISCORD_ID) {
    return res.status(403).json({ ok: false, error: 'Cannot modify the Owner account.' });
  }
  if (actor.permission_level <= (target.permission_level || 0) && actor.discord_id !== OWNER_DISCORD_ID) {
    return res.status(403).json({ ok: false, error: 'Insufficient permissions.' });
  }

  const updateData: Partial<NexusUser> = {};
  if (role !== undefined) updateData.role = role as any;
  if (permission_level !== undefined) updateData.permission_level = permission_level as number;
  if (dashboard_access !== undefined) updateData.dashboard_access = dashboard_access as any;
  if (status !== undefined) updateData.status = status as any;
  if (discord_username !== undefined) updateData.discord_username = discord_username as string;
  if (avatar !== undefined) updateData.avatar = avatar as string;

  await authService.updateUser(targetId, updateData);
  await authService.audit(actor.id, 'USER_UPDATE', `Updated user ${target.username}: ${JSON.stringify(updateData)}`);

  return res.json({ ok: true });
});

// ── DELETE /auth/users/:id (Owner only) ───────────────────────────────────
router.delete('/users/:id', requireOwner, async (req: Request, res: Response) => {
  const actor = (req as any).nexusUser as NexusUser;
  if (actor.discord_id !== OWNER_DISCORD_ID) {
    return res.status(403).json({ ok: false, error: 'Only the Owner can delete accounts.' });
  }
  const targetId = parseInt(req.params.id);
  const target = await authService.getUser(targetId);
  if (!target) return res.status(404).json({ ok: false, error: 'User not found.' });
  if (target.discord_id === OWNER_DISCORD_ID) return res.status(403).json({ ok: false, error: 'Cannot delete Owner.' });

  const db = await import('../services/database.js').then(m => m.getDB());
  (db as any).prepare('DELETE FROM nexus_users WHERE id=?').run(targetId);
  await authService.audit(actor.id, 'USER_DELETE', `Deleted account: ${target.username}`);
  return res.json({ ok: true });
});

// ── POST /auth/users/:id/password ─────────────────────────────────────────
router.post('/users/:id/password', requireOwner, async (req: Request, res: Response) => {
  const { new_password } = req.body as { new_password: string };
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
  }
  const actor = (req as any).nexusUser as NexusUser;
  await authService.changePassword(parseInt(req.params.id), new_password);
  await authService.audit(actor.id, 'PASSWORD_RESET', `Reset password for user ${req.params.id}`);
  return res.json({ ok: true });
});

// ── GET /auth/logs ────────────────────────────────────────────────────────
router.get('/logs', requireDashboard, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query['limit'] as string || '100'), 500);
  const type  = req.query['type'] as string | undefined;
  const logs  = await authService.getLogs(limit, type);
  return res.json({ ok: true, logs });
});

// ── POST /auth/change-password ────────────────────────────────────────────
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).nexusUser as NexusUser;
  const { current_password, new_password } = req.body as Record<string, string>;
  if (!current_password || !new_password) {
    return res.status(400).json({ ok: false, error: 'Both fields required.' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters.' });
  }
  // Verify current password
  const loginCheck = await authService.login({ identifier: user.username, password: current_password });
  if (!loginCheck.ok) return res.status(400).json({ ok: false, error: 'Current password incorrect.' });
  await authService.changePassword(user.id, new_password);
  await authService.audit(user.id, 'PASSWORD_CHANGE', 'User changed their own password');
  return res.json({ ok: true });
});

// ── Utility ───────────────────────────────────────────────────────────────
function sanitizeUser(user: NexusUser): Partial<NexusUser> {
  const { ...safe } = user as any;
  delete safe.password_hash;
  delete safe.password_salt;
  delete safe.two_factor_secret;
  return safe;
}

export default router;
