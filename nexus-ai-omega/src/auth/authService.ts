/**
 * Nexus AI Omega — Auth Service v1.0
 * Secure Authentication with bcrypt-style hashing, JWT sessions
 * Owner/Co-Owner auto-detection, permission-based access control
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDB } from '../services/database.js';
import { TEAM_IDS, RANK_META, getEffectivePermissions, type NexusRank } from '../global/team/types.js';

// ── Constants ─────────────────────────────────────────────────────────────
export const OWNER_DISCORD_ID   = '1097607057244442764';
export const COOWNER_DISCORD_ID = '1056815951980527678';
export const JWT_SECRET = process.env.NEXUS_JWT_SECRET || 'nexus-ultra-secret-change-me-in-production-2025';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ── Role definitions ───────────────────────────────────────────────────────
export interface NexusUser {
  id: number;
  username: string;
  discord_id: string;
  discord_username: string | null;
  avatar: string | null;
  role: NexusRank;
  permission_level: number;
  status: 'active' | 'suspended' | 'banned';
  dashboard_access: 0 | 1;
  created_at: number;
  last_login: number | null;
  last_ip: string | null;
  two_factor_enabled: 0 | 1;
}

// ── Password hashing (SHA-256 + salt, no native bcrypt dep needed) ─────────
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || randomBytes(32).toString('hex');
  const h = createHash('sha256').update(s + password + JWT_SECRET).digest('hex');
  return { hash: h, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: h } = hashPassword(password, salt);
  try {
    return timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// ── JWT (simple, no external dep) ─────────────────────────────────────────
function b64url(s: string): string {
  return Buffer.from(s).toString('base64url');
}
function fromB64url(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

export function createToken(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = b64url(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + SESSION_TTL_MS }));
  const sig    = createHash('sha256').update(`${header}.${body}.${JWT_SECRET}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = createHash('sha256').update(`${header}.${body}.${JWT_SECRET}`).digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(fromB64url(body));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Auto-detect role from Discord ID ─────────────────────────────────────
export function detectRole(discordId: string): { role: NexusRank; permission_level: number; dashboard_access: 1 | 0 } {
  if (discordId === OWNER_DISCORD_ID) {
    return { role: 'OWNER', permission_level: 100, dashboard_access: 1 };
  }
  if (discordId === COOWNER_DISCORD_ID) {
    return { role: 'CO_OWNER', permission_level: 95, dashboard_access: 1 };
  }
  return { role: 'TEAM', permission_level: 0, dashboard_access: 0 };
}

// ── Auth Database operations ───────────────────────────────────────────────
export class AuthService {
  private static instance: AuthService;
  // Rate limiting: { ip -> [timestamps] }
  private loginAttempts = new Map<string, number[]>();
  // Active sessions: { token -> userId }
  private sessions = new Map<string, number>();

  static getInstance(): AuthService {
    if (!AuthService.instance) AuthService.instance = new AuthService();
    return AuthService.instance;
  }

  async init(): Promise<void> {
    const db = await getDB();
    (db as any).exec(`
      CREATE TABLE IF NOT EXISTS nexus_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        discord_id TEXT NOT NULL UNIQUE,
        discord_username TEXT,
        avatar TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'TEAM',
        permission_level INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        dashboard_access INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        last_login INTEGER,
        last_ip TEXT,
        two_factor_enabled INTEGER NOT NULL DEFAULT 0,
        two_factor_secret TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_nexus_users_discord ON nexus_users(discord_id);
      CREATE INDEX IF NOT EXISTS idx_nexus_users_username ON nexus_users(username);

      CREATE TABLE IF NOT EXISTS nexus_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        ip TEXT,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS nexus_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        ip TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES nexus_users(id) ON DELETE CASCADE
      );
    `);
  }

  // ── Rate limiting ──────────────────────────────────────────────────────
  private checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const attempts = (this.loginAttempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
    if (attempts.length >= 10) return false;
    attempts.push(now);
    this.loginAttempts.set(ip, attempts);
    return true;
  }

  // ── Register ───────────────────────────────────────────────────────────
  async register(data: {
    username: string;
    discord_id: string;
    password: string;
    ip?: string;
  }): Promise<{ ok: boolean; error?: string; user?: NexusUser }> {
    const db = await getDB();

    // Validation
    if (!data.username || data.username.length < 3 || data.username.length > 32) {
      return { ok: false, error: 'Username must be 3–32 characters.' };
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(data.username)) {
      return { ok: false, error: 'Username may only contain letters, numbers, _ . -' };
    }
    if (!data.discord_id || !/^\d{17,19}$/.test(data.discord_id)) {
      return { ok: false, error: 'Invalid Discord Account ID.' };
    }
    if (!data.password || data.password.length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters.' };
    }

    // Duplicate checks
    const existingUsername = (db as any).prepare('SELECT id FROM nexus_users WHERE LOWER(username)=LOWER(?)').get(data.username);
    if (existingUsername) return { ok: false, error: 'Username already taken.' };

    const existingDiscord = (db as any).prepare('SELECT id FROM nexus_users WHERE discord_id=?').get(data.discord_id);
    if (existingDiscord) return { ok: false, error: 'A Nexus account already exists for this Discord ID.' };

    // Hash password
    const { hash, salt } = hashPassword(data.password);

    // Auto-detect role
    const { role, permission_level, dashboard_access } = detectRole(data.discord_id);

    try {
      const result = (db as any).prepare(`
        INSERT INTO nexus_users
          (username, discord_id, password_hash, password_salt, role, permission_level, dashboard_access)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(data.username, data.discord_id, hash, salt, role, permission_level, dashboard_access);

      const user = (db as any).prepare('SELECT * FROM nexus_users WHERE id=?').get(result.lastInsertRowid) as NexusUser;

      await this.audit(user.id, 'REGISTER', `New account created. Role: ${role}`, data.ip);

      return { ok: true, user };
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return { ok: false, error: 'Username or Discord ID already exists.' };
      }
      return { ok: false, error: 'Registration failed. Try again.' };
    }
  }

  // ── Login ──────────────────────────────────────────────────────────────
  async login(data: {
    identifier: string; // username OR discord_id
    password: string;
    ip?: string;
    user_agent?: string;
  }): Promise<{ ok: boolean; error?: string; token?: string; user?: NexusUser }> {
    // Rate limiting
    if (data.ip && !this.checkRateLimit(data.ip)) {
      return { ok: false, error: 'Too many login attempts. Try again in 15 minutes.' };
    }

    const db = await getDB();
    const user = (db as any).prepare(`
      SELECT * FROM nexus_users
      WHERE LOWER(username)=LOWER(?) OR discord_id=?
    `).get(data.identifier, data.identifier) as NexusUser | null;

    if (!user) {
      await this.audit(null, 'LOGIN_FAIL', `Unknown identifier: ${data.identifier}`, data.ip);
      return { ok: false, error: 'Invalid credentials.' };
    }

    if (user.status === 'suspended') return { ok: false, error: 'Account suspended. Contact an admin.' };
    if (user.status === 'banned')    return { ok: false, error: 'Account banned.' };

    // Verify password
    const pwData = (db as any).prepare('SELECT password_hash, password_salt FROM nexus_users WHERE id=?').get(user.id) as { password_hash: string; password_salt: string };
    if (!verifyPassword(data.password, pwData.password_hash, pwData.password_salt)) {
      await this.audit(user.id, 'LOGIN_FAIL', 'Wrong password', data.ip);
      return { ok: false, error: 'Invalid credentials.' };
    }

    // Re-detect role (in case owner/coowner later registers)
    const { role, permission_level, dashboard_access } = detectRole(user.discord_id);
    if (role !== user.role) {
      (db as any).prepare('UPDATE nexus_users SET role=?, permission_level=?, dashboard_access=? WHERE id=?')
        .run(role, permission_level, dashboard_access, user.id);
      user.role = role;
      user.permission_level = permission_level;
      user.dashboard_access = dashboard_access;
    }

    // Update last login
    (db as any).prepare('UPDATE nexus_users SET last_login=?, last_ip=? WHERE id=?')
      .run(Date.now(), data.ip || null, user.id);

    // Create JWT
    const token = createToken({ sub: user.id, discord_id: user.discord_id, role: user.role, perm: user.permission_level });

    // Store session
    const tokenHash = createHash('sha256').update(token).digest('hex');
    (db as any).prepare(`
      INSERT OR REPLACE INTO nexus_sessions (user_id, token_hash, ip, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, tokenHash, data.ip || null, data.user_agent || null, Date.now() + SESSION_TTL_MS);

    await this.audit(user.id, 'LOGIN_OK', `Logged in as ${user.role}`, data.ip);
    return { ok: true, token, user };
  }

  // ── Validate session ───────────────────────────────────────────────────
  async validateSession(token: string): Promise<NexusUser | null> {
    const payload = verifyToken(token);
    if (!payload) return null;

    const db = await getDB();
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Check session exists in DB
    const sess = (db as any).prepare('SELECT * FROM nexus_sessions WHERE token_hash=? AND expires_at > ?')
      .get(tokenHash, Date.now());
    if (!sess) return null;

    const user = (db as any).prepare('SELECT * FROM nexus_users WHERE id=?').get(payload['sub']) as NexusUser | null;
    if (!user || user.status !== 'active') return null;
    return user;
  }

  // ── Logout ─────────────────────────────────────────────────────────────
  async logout(token: string): Promise<void> {
    const db = await getDB();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    (db as any).prepare('DELETE FROM nexus_sessions WHERE token_hash=?').run(tokenHash);
  }

  // ── Get user by ID ─────────────────────────────────────────────────────
  async getUser(id: number): Promise<NexusUser | null> {
    const db = await getDB();
    return (db as any).prepare('SELECT * FROM nexus_users WHERE id=?').get(id) as NexusUser | null;
  }

  // ── Get all users (admin) ──────────────────────────────────────────────
  async getAllUsers(): Promise<NexusUser[]> {
    const db = await getDB();
    return (db as any).prepare('SELECT * FROM nexus_users ORDER BY permission_level DESC, created_at ASC').all() as NexusUser[];
  }

  // ── Update user ────────────────────────────────────────────────────────
  async updateUser(id: number, data: Partial<NexusUser>): Promise<void> {
    const db = await getDB();
    const fields = Object.keys(data).filter(k => !['id', 'password_hash', 'password_salt'].includes(k));
    if (!fields.length) return;
    const sql = `UPDATE nexus_users SET ${fields.map(f => `${f}=?`).join(',')} WHERE id=?`;
    (db as any).prepare(sql).run(...fields.map(f => (data as any)[f]), id);
  }

  // ── Change password ────────────────────────────────────────────────────
  async changePassword(userId: number, newPassword: string): Promise<void> {
    const db = await getDB();
    const { hash, salt } = hashPassword(newPassword);
    (db as any).prepare('UPDATE nexus_users SET password_hash=?, password_salt=? WHERE id=?').run(hash, salt, userId);
    // Invalidate all sessions
    (db as any).prepare('DELETE FROM nexus_sessions WHERE user_id=?').run(userId);
  }

  // ── Audit log ──────────────────────────────────────────────────────────
  async audit(userId: number | null, action: string, details?: string, ip?: string): Promise<void> {
    try {
      const db = await getDB();
      (db as any).prepare('INSERT INTO nexus_audit_logs (user_id, action, details, ip) VALUES (?,?,?,?)')
        .run(userId, action, details || null, ip || null);
    } catch { /* non-fatal */ }
  }

  // ── Get audit logs ─────────────────────────────────────────────────────
  async getLogs(limit = 100, type?: string): Promise<Record<string, unknown>[]> {
    const db = await getDB();
    if (type) {
      return (db as any).prepare('SELECT al.*, u.username FROM nexus_audit_logs al LEFT JOIN nexus_users u ON al.user_id=u.id WHERE al.action=? ORDER BY al.timestamp DESC LIMIT ?').all(type, limit) as Record<string, unknown>[];
    }
    return (db as any).prepare('SELECT al.*, u.username FROM nexus_audit_logs al LEFT JOIN nexus_users u ON al.user_id=u.id ORDER BY al.timestamp DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  }

  // ── Suspend / Unsuspend ────────────────────────────────────────────────
  async setStatus(targetId: number, status: 'active' | 'suspended' | 'banned', actorId: number): Promise<{ ok: boolean; error?: string }> {
    const db = await getDB();
    const actor = await this.getUser(actorId);
    const target = await this.getUser(targetId);
    if (!actor || !target) return { ok: false, error: 'User not found.' };
    // Cannot demote owner
    if (target.discord_id === OWNER_DISCORD_ID) return { ok: false, error: 'Cannot modify the Owner account.' };
    // Must have higher permission
    if (actor.permission_level <= target.permission_level) return { ok: false, error: 'Insufficient permissions.' };
    (db as any).prepare('UPDATE nexus_users SET status=? WHERE id=?').run(status, targetId);
    await this.audit(actorId, 'STATUS_CHANGE', `User ${target.username} → ${status}`, undefined);
    if (status !== 'active') {
      (db as any).prepare('DELETE FROM nexus_sessions WHERE user_id=?').run(targetId);
    }
    return { ok: true };
  }
}

export const authService = AuthService.getInstance();
