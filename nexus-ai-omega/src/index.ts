/**
 * Nexus AI Omega — Unified Entrypoint v5.0
 * Boots: Redis → EventBus → AI Engine → API → Bot (if token present)
 * Handles graceful shutdown.
 */
import 'dotenv/config';
import { logger } from './services/logger.js';
import { connectRedis } from './services/redisCache.js';
import { eventBus } from './event-bus/kafkaClient.js';
import { aiEngine } from './ai-center/aiEngine.js';
import { statsAggregator } from './global/statisticsAggregator.js';

async function main(): Promise<void> {
  logger.info('🌐 Nexus AI Omega v5.0 booting…');

  // 1. Redis
  await connectRedis();

  // 2. Event bus
  await eventBus.connect();

  // 3. AI Engine
  await aiEngine.init();

  // 4. API server (imports and starts itself)
  await import('./api/server.js');

  // 5. Discord Bot (only if token present)
  if (process.env.DISCORD_TOKEN) {
    await import('./bot/client.js');
  } else {
    logger.warn('⚠️ DISCORD_TOKEN nicht gesetzt — nur API/Dashboard Modus');
  }

  logger.info('✅ Nexus AI Omega v5.0 vollständig hochgefahren');
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, '🛑 Shutdown signal received…');

  await eventBus.shutdown().catch(() => {});

  logger.info('✅ Shutdown complete. Auf Wiedersehen!');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  err => logger.error({ err }, '❌ Uncaught exception'));
process.on('unhandledRejection', err => logger.error({ err }, '❌ Unhandled rejection'));

main().catch(err => {
  logger.error({ err }, '❌ Fatal startup error');
  process.exit(1);
});
