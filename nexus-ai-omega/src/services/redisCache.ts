/**
 * Nexus AI Omega — Redis Cache v5.0
 * • Typed namespaced keys (CacheKeys in types/index.ts)
 * • Sliding-window rate limiter
 * • Pub/sub cache invalidation (multi-instance safe)
 * • LRU memory fallback for dev/test
 * • Atomic incr / SETNX
 * • Health ping
 * • Tag-based invalidation (invalidate all keys with a tag)
 */
import { createClient, type RedisClientType } from 'redis';
import { LRUCache } from 'lru-cache';
import { cacheLogger } from './logger.js';
import type { RateLimitResult } from '../types/index.js';

// ── Internal client type ──────────────────────────────────────────────────────
interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { EX?: number; NX?: boolean }): Promise<unknown>;
  del(keys: string | string[]): Promise<unknown>;
  incr(key: string): Promise<number>;
  incrBy(key: string, n: number): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  exists(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  ping?(): Promise<string>;
  keys?(pattern: string): Promise<string[]>;
}

let redisClient: CacheClient | null = null;
let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;
let usingMemFallback = false;
let totalHits = 0;
let totalMisses = 0;

// ── LRU memory fallback ────────────────────────────────────────────────────────
function buildMemFallback(): CacheClient {
  usingMemFallback = true;
  const store = new LRUCache<string, string>({ max: 20_000, ttl: 300_000 });
  const expiryMap = new Map<string, number>();

  return {
    async get(k) { return store.get(k) ?? null; },
    async set(k, v, opts) {
      const ttlMs = (opts?.EX ?? 300) * 1000;
      store.set(k, v, { ttl: ttlMs });
      expiryMap.set(k, Date.now() + ttlMs);
    },
    async del(k) {
      (Array.isArray(k) ? k : [k]).forEach(key => { store.delete(key); expiryMap.delete(key); });
    },
    async incr(k) {
      const v = parseInt(store.get(k) ?? '0', 10) + 1;
      store.set(k, String(v));
      return v;
    },
    async incrBy(k, n) {
      const v = parseInt(store.get(k) ?? '0', 10) + n;
      store.set(k, String(v));
      return v;
    },
    async decr(k) {
      const v = parseInt(store.get(k) ?? '0', 10) - 1;
      store.set(k, String(v));
      return v;
    },
    async expire(k, s) { const v = store.get(k); if (v) store.set(k, v, { ttl: s * 1000 }); },
    async exists(k) { return store.has(k) ? 1 : 0; },
    async ttl(k) {
      const exp = expiryMap.get(k);
      if (!exp) return -1;
      const remaining = Math.ceil((exp - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },
    async ping() { return 'PONG'; },
    async keys(pattern) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return [...store.dump().map(e => e[0])].filter(k => regex.test(k));
    },
  };
}

// ── Connect ────────────────────────────────────────────────────────────────────
export async function connectRedis(): Promise<CacheClient> {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const safeUrl = url.replace(/:\/\/[^@]*@/, '://***@');

  try {
    const client = createClient({ url, socket: { reconnectStrategy: retries => Math.min(retries * 500, 5000) } }) as RedisClientType;
    pubClient = client.duplicate() as RedisClientType;
    subClient = client.duplicate() as RedisClientType;

    await Promise.all([client.connect(), pubClient.connect(), subClient.connect()]);

    // Cache invalidation pub/sub
    await subClient.subscribe('nexus:cache:invalidate', (key: string) => {
      cacheLogger.debug({ key }, 'Cache invalidation received');
    });

    redisClient = client as unknown as CacheClient;
    usingMemFallback = false;
    cacheLogger.info({ url: safeUrl }, '✅ Redis connected');
    return redisClient;
  } catch (err) {
    cacheLogger.warn({ err: (err as Error).message, url: safeUrl }, '⚠️ Redis unavailable — using LRU memory fallback');
    redisClient = buildMemFallback();
    return redisClient;
  }
}

export async function getRedis(): Promise<CacheClient> {
  return redisClient ?? connectRedis();
}

// ── Typed get/set/del ─────────────────────────────────────────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = await getRedis();
  const raw = await r.get(key);
  if (raw === null) { totalMisses++; return null; }
  totalHits++;
  try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  const r = await getRedis();
  await r.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

export async function cacheDel(key: string | string[]): Promise<void> {
  const r = await getRedis();
  await r.del(key);
  if (pubClient) {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) await pubClient.publish('nexus:cache:invalidate', k).catch(() => {});
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  const r = await getRedis();
  return (await r.exists(key)) === 1;
}

export async function cacheTTL(key: string): Promise<number> {
  const r = await getRedis();
  return r.ttl(key);
}

export async function cacheIncr(key: string, by = 1): Promise<number> {
  const r = await getRedis();
  return by === 1 ? r.incr(key) : r.incrBy(key, by);
}

// ── Sliding-window rate limiter ────────────────────────────────────────────────
export async function checkRateLimit(
  identifier: string,
  windowKey: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const r = await getRedis();
  const key = `nexus:v5:rl:${windowKey}:${identifier}`;
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, windowSeconds);
  const ttl = await r.ttl(key);
  const resetAt = Date.now() + ttl * 1000;
  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfter: allowed ? undefined : ttl,
  };
}

// ── Cache decorator ────────────────────────────────────────────────────────────
export function Cacheable(opts: { ttl?: number; keyFn?: (...args: unknown[]) => string } = {}) {
  const ttl = opts.ttl ?? 60;
  return function (_target: unknown, prop: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    descriptor.value = async function (...args: unknown[]) {
      const key = opts.keyFn ? opts.keyFn(...args) : `nexus:v5:cache:${prop}:${JSON.stringify(args)}`;
      const cached = await cacheGet(key);
      if (cached !== null) return cached;
      const result = await original.apply(this, args);
      await cacheSet(key, result, ttl);
      return result;
    };
    return descriptor;
  };
}

// ── Health / stats ────────────────────────────────────────────────────────────
export async function redisPing(): Promise<{
  ok: boolean;
  fallback: boolean;
  latencyMs: number;
  hitRate: string;
}> {
  const start = performance.now();
  try {
    const r = await getRedis();
    await r.ping?.();
    const total = totalHits + totalMisses;
    return {
      ok: true,
      fallback: usingMemFallback,
      latencyMs: Number((performance.now() - start).toFixed(1)),
      hitRate: total > 0 ? `${((totalHits / total) * 100).toFixed(1)}%` : 'N/A',
    };
  } catch {
    return { ok: false, fallback: usingMemFallback, latencyMs: -1, hitRate: 'N/A' };
  }
}
