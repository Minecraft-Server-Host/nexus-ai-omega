/**
 * Nexus AI Omega — Unified Entrypoint v2.1
 * Starts: EventBus → AI Engine → Gateway → API
 */
import 'dotenv/config';
import { logger } from './services/logger.js';
import { eventBus } from './event-bus/kafkaClient.js';
import { aiEngine } from './ai-center/aiEngine.js';

async function main(){
  logger.info('🌐 Nexus AI Omega booting… v2.1.0-prod');
  await eventBus.connect();
  await aiEngine.init();
  // API server imports and boots itself (src/api/server.ts)
  await import('./api/server.js');
  // Bot client optional
  if (process.env.DISCORD_TOKEN) {
    await import('./bot/client.js');
  } else {
    logger.warn('DISCORD_TOKEN not set — API/Dashboard only mode');
  }
}
main().catch(e=>{ logger.error(e); process.exit(1); });
