/**
 * Nexus AI Omega — SQLite Database Service v5.0
 * Übernommen & upgraded von discord-bot-source (better-sqlite3)
 * Alle Tabellen aus dem Original + neue Nexus-Tabellen
 */
import path from 'node:path';
import fs from 'node:fs';
import { dbLogger } from './logger.js';

// better-sqlite3 dynamisch laden (optional dependency)
let Database: (new (path: string) => DB) | null = null;
let db: DB | null = null;

interface DB {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  transaction<T>(fn: () => T): () => T;
}

interface Statement {
  run(...args: unknown[]): { changes: number; lastInsertRowid: number };
  get(...args: unknown[]): Record<string, unknown> | null;
  all(...args: unknown[]): Record<string, unknown>[];
}

// Memory-Fallback wenn better-sqlite3 nicht installiert
class MemoryDB implements DB {
  private tables = new Map<string, Record<string, unknown>[]>();
  private idCounters = new Map<string, number>();

  prepare(sql: string): Statement {
    const self = this;
    return {
      run(...args: unknown[]) {
        dbLogger.debug({ sql: sql.slice(0, 60) }, 'MemoryDB run');
        return { changes: 1, lastInsertRowid: 1 };
      },
      get(...args: unknown[]) {
        return null;
      },
      all(...args: unknown[]) {
        return [];
      },
    };
  }
  exec(sql: string): void {}
  transaction<T>(fn: () => T) { return fn; }
}

export async function getDB(): Promise<DB> {
  if (db) return db;

  try {
    const mod = await import('better-sqlite3');
    Database = mod.default as new (path: string) => DB;

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const dbPath = path.join(dataDir, 'nexus.db');
    db = new Database(dbPath);

    // Alle Tabellen erstellen (aus Original + Nexus-Erweiterungen)
    (db as DB).exec(`
      -- ── Warnungen ──────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        moderator_id TEXT, reason TEXT,
        timestamp INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);

      -- ── Leveling ───────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS levels (
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        xp INTEGER DEFAULT 0, level INTEGER DEFAULT 0,
        messages INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );

      -- ── XP Cooldowns ───────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS xp_cooldowns (
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        last_message INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );

      -- ── Economy ────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS economy (
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        balance INTEGER DEFAULT 0, bank INTEGER DEFAULT 0,
        last_daily INTEGER DEFAULT 0, last_work INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );

      -- ── Inventar ───────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, user_id TEXT,
        item_name TEXT, quantity INTEGER DEFAULT 1
      );

      -- ── Shop ───────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS shop_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, name TEXT, description TEXT,
        price INTEGER, role_id TEXT
      );

      -- ── Tickets ────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, channel_id TEXT, user_id TEXT,
        type TEXT DEFAULT 'general',
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'medium',
        claimed_by TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
        transcript TEXT,
        closed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id, status);
      CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id);

      -- ── Bewerbungen ────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, user_id TEXT,
        position TEXT, answers TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      -- ── Server-Einstellungen ───────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        log_channel TEXT,
        welcome_channel TEXT, welcome_message TEXT,
        auto_role TEXT,
        ticket_category TEXT, ticket_support_role TEXT,
        application_channel TEXT,
        level_channel TEXT, level_roles TEXT DEFAULT '{}',
        xp_cooldown INTEGER DEFAULT 60,
        verify_channel TEXT, verify_role TEXT,
        suggestion_channel TEXT,
        announcement_channel TEXT,
        mod_log_channel TEXT,
        ai_channel TEXT,
        rules_channel TEXT
      );

      -- ── AutoMod ────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS automod (
        guild_id TEXT PRIMARY KEY,
        words TEXT DEFAULT '[]',
        anti_links INTEGER DEFAULT 0
      );

      -- ── Giveaways ──────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, channel_id TEXT, message_id TEXT,
        prize TEXT, winners INTEGER DEFAULT 1,
        end_time INTEGER, host_id TEXT,
        ended INTEGER DEFAULT 0, entries TEXT DEFAULT '[]'
      );

      -- ── Erinnerungen ──────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT, channel_id TEXT,
        message TEXT, remind_at INTEGER, sent INTEGER DEFAULT 0
      );

      -- ── Custom Commands ────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS custom_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL, name TEXT NOT NULL,
        response TEXT NOT NULL, created_by TEXT,
        uses INTEGER DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_cmd ON custom_commands(guild_id, name);

      -- ── AI History ─────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS ai_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, channel_id TEXT, user_id TEXT,
        role TEXT, content TEXT,
        timestamp INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      -- ── Support Sessions ───────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS support_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, user_id TEXT,
        support_channel_id TEXT, wait_channel_id TEXT,
        status TEXT DEFAULT 'waiting',
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      -- ── Onboarding ─────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS onboarding (
        guild_id TEXT PRIMARY KEY,
        member_role TEXT, notification_roles TEXT DEFAULT '[]',
        rules_text TEXT
      );
      CREATE TABLE IF NOT EXISTS onboarding_progress (
        guild_id TEXT, user_id TEXT,
        step INTEGER DEFAULT 0, completed INTEGER DEFAULT 0,
        choices TEXT DEFAULT '[]',
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    dbLogger.info({ path: dbPath }, '✅ SQLite Datenbank verbunden');
    return db as DB;
  } catch (err) {
    dbLogger.warn({ err: (err as Error).message }, '⚠️ better-sqlite3 nicht verfügbar — Memory-Fallback aktiv');
    db = new MemoryDB();
    return db;
  }
}

// Convenience wrapper für synchrone Abfragen
export async function dbGet<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | null> {
  const d = await getDB();
  return d.prepare(sql).get(...params) as T | null;
}

export async function dbAll<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
  const d = await getDB();
  return d.prepare(sql).all(...params) as T[];
}

export async function dbRun(sql: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowid: number }> {
  const d = await getDB();
  return d.prepare(sql).run(...params);
}

// Guild-Settings Hilfsfunktionen
export async function getGuildSettings(guildId: string): Promise<Record<string, unknown>> {
  const settings = await dbGet('SELECT * FROM guild_settings WHERE guild_id = ?', guildId);
  if (!settings) {
    await dbRun('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)', guildId);
    return { guild_id: guildId };
  }
  return settings;
}

export async function setGuildSetting(guildId: string, key: string, value: unknown): Promise<void> {
  await dbRun('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)', guildId);
  await dbRun(`UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`, value, guildId);
}
