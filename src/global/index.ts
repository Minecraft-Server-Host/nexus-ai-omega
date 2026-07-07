/**
 * Nexus AI Omega — Global Admin System Barrel v3.2
 */
export * from './nexusControlCenter.js';
export * from './globalLogger.js';
export * from './restrictionManager.js';
export * from './serverRegistry.js';
export * from './statisticsAggregator.js';
export * from './embeds.js';

import { Client } from 'discord.js';
import { NexusControlCenter, NEXUS_CONTROL_GUILD_ID } from './nexusControlCenter.js';
import { globalLogger } from './globalLogger.js';
import { serverRegistry } from './serverRegistry.js';
import { statsAggregator } from './statisticsAggregator.js';
import { logger } from '../services/logger.js';

let controlCenter: NexusControlCenter | null = null;

export async function initializeGlobalSystems(client: Client){
  logger.info('🌐 Initializing Nexus Global Admin Systems…');
  controlCenter = new NexusControlCenter(client);
  await controlCenter.initialize();
  globalLogger.attach(client, controlCenter);
  // flush buffered logs
  setInterval(()=> globalLogger.flushBuffer(), 5000);
  logger.info('✅ Global Admin Systems ONLINE');
  return { controlCenter, globalLogger, serverRegistry, statsAggregator };
}

export function getControlCenter(){ return controlCenter; }
export const NEXUS_GUILD_ID = NEXUS_CONTROL_GUILD_ID;
