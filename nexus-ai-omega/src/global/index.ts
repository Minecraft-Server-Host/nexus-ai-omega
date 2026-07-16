/**
 * Nexus AI Omega — Global Systems Barrel v5.0
 */
export * from './nexusControlCenter.js';
export * from './globalLogger.js';
export * from './restrictionManager.js';
export * from './serverRegistry.js';
export * from './statisticsAggregator.js';

import type { Client } from 'discord.js';
import { NexusControlCenter, NEXUS_CONTROL_GUILD_ID } from './nexusControlCenter.js';
import { GlobalLogger, globalLogger } from './globalLogger.js';
import { serverRegistry } from './serverRegistry.js';
import { statsAggregator } from './statisticsAggregator.js';
import { logger } from '../services/logger.js';

let controlCenter: NexusControlCenter | null = null;

export async function initializeGlobalSystems(client: Client): Promise<{
  controlCenter: NexusControlCenter;
  globalLogger: GlobalLogger;
}> {
  logger.info('🌐 Initializing Nexus Global Admin Systems…');

  controlCenter = new NexusControlCenter(client);
  await controlCenter.initialize();

  globalLogger.attach(client, controlCenter);

  // Flush buffered logs every 5 seconds
  setInterval(() => globalLogger.flushBuffer().catch(() => {}), 5_000);

  // Stats snapshot every 5 minutes
  setInterval(() => statsAggregator.snapshot().catch(() => {}), 5 * 60_000);

  logger.info('✅ Global Admin Systems ONLINE');
  return { controlCenter, globalLogger };
}

export function getControlCenter(): NexusControlCenter | null {
  return controlCenter;
}

export { NEXUS_CONTROL_GUILD_ID as NEXUS_GUILD_ID };
