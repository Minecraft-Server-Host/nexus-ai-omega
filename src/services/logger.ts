import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined,
  base: { service: 'nexus-ai-omega', version: '2.1.0' }
});

export const createChild = (bindings: Record<string, any>) => logger.child(bindings);
