/**
 * Nexus AI Omega — Logger v5.0
 * • AsyncLocalStorage request context on every line
 * • Secret sanitizer (Discord tokens, API keys, passwords)
 * • Module-specific child loggers
 * • Performance timer with threshold warnings
 * • Structured error serializer
 * • Production JSON / Dev pretty-print
 */
import pino, { type Logger } from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';

// ── Request context ───────────────────────────────────────────────────────────
export interface RequestContext {
  requestId: string;
  guildId?: string;
  userId?: string;
  command?: string;
  shard?: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// ── Secret sanitization ────────────────────────────────────────────────────────
const REDACT_FIELDS = [
  'apikey', 'api_key', 'apiKey',
  'password', 'passwd', 'secret',
  'token', 'accesstoken', 'access_token',
  'authorization', 'cookie', 'sessionid',
  'byoApiKey', 'byo_key',
];

const REDACT_PATTERNS = [
  /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27,}/g,   // Discord token
  /sk-[a-zA-Z0-9]{20,}/g,                          // OpenAI
  /sk-ant-[a-zA-Z0-9\-]{20,}/g,                    // Anthropic
  /AIza[0-9A-Za-z\-_]{35}/g,                       // Google
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,              // Auth header
  /"password"\s*:\s*"[^"]+"/g,
  /"secret"\s*:\s*"[^"]+"/g,
];

function sanitize(obj: unknown): unknown {
  if (typeof obj === 'string') {
    let s = obj;
    for (const p of REDACT_PATTERNS) s = s.replace(p, '[REDACTED]');
    return s;
  }
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = REDACT_FIELDS.includes(k.toLowerCase()) ? '[REDACTED]' : sanitize(v);
    }
    return out;
  }
  return obj;
}

// ── Pino logger ───────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname,service,env',
          messageFormat: '[{module}] {msg}',
        },
      }
    : undefined,
  base: {
    service: 'nexus-ai-omega',
    version: '5.0.0',
    env: process.env.NODE_ENV || 'development',
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  hooks: {
    logMethod(args, method) {
      // Inject request context + sanitize secrets
      const ctx = requestContext.getStore();
      if (ctx && typeof args[0] === 'object' && args[0] !== null) {
        const obj = args[0] as Record<string, unknown>;
        if (ctx.requestId && !obj.requestId) obj.requestId = ctx.requestId;
        if (ctx.guildId && !obj.guildId) obj.guildId = ctx.guildId;
        if (ctx.userId && !obj.userId) obj.userId = ctx.userId;
        args[0] = sanitize(obj) as Record<string, unknown>;
      }
      return method.apply(this, args as Parameters<typeof method>);
    },
  },
});

// ── Module child loggers ──────────────────────────────────────────────────────
export const aiLogger       = logger.child({ module: 'ai-engine' });
export const securityLogger = logger.child({ module: 'security' });
export const gatewayLogger  = logger.child({ module: 'gateway' });
export const dbLogger       = logger.child({ module: 'database' });
export const apiLogger      = logger.child({ module: 'api' });
export const ticketLogger   = logger.child({ module: 'tickets' });
export const botLogger      = logger.child({ module: 'bot' });
export const teamLogger     = logger.child({ module: 'team' });
export const cacheLogger    = logger.child({ module: 'cache' });
export const builderLogger  = logger.child({ module: 'builder' });

// ── Performance timer ─────────────────────────────────────────────────────────
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  warnMs = 500,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = performance.now() - start;
    if (ms > warnMs) {
      logger.warn({ label, ms: ms.toFixed(1) }, '⚠️ Slow operation');
    } else {
      logger.debug({ label, ms: ms.toFixed(1) }, 'Operation timing');
    }
    return result;
  } catch (err) {
    const ms = performance.now() - start;
    logger.error({ label, ms: ms.toFixed(1), err }, '❌ Operation failed');
    throw err;
  }
}

// ── Convenience ───────────────────────────────────────────────────────────────
export function createChild(bindings: Record<string, string | number | boolean>) {
  return logger.child(sanitize(bindings) as Parameters<typeof logger.child>[0]);
}

