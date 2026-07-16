/**
 * Nexus AI Omega — Stateless Kubernetes Workers v2.2
 * worker-core • worker-security • worker-ai • worker-analytics • worker-audio
 */
import { eventBus } from '../event-bus/kafkaClient.js';
import { logger } from './logger.js';
import { chBatcher } from './clickhouseBatcher.js';

export async function startWorker(role: 'core'|'security'|'ai'|'analytics'|'audio'){
  await eventBus.connect();
  logger.info({ role }, 'Nexus worker starting');
  const groupId = `nexus-${role}-${process.env.HOSTNAME || 'local'}`;

  if(role==='core' || role==='analytics'){
    await eventBus.subscribe('analytics-stream', groupId, async msg=>{
      chBatcher.push({
        ts: msg.timestamp,
        guild_id: msg.key || '0',
        type: msg.value?.type || 'event',
        user_id: msg.value?.userId,
        data: msg.value
      });
    });
  }
  if(role==='security'){
    await eventBus.subscribe('automod-tasks', groupId, async msg=>{
      // security evaluation
      logger.debug({ msg: msg.value }, 'security task');
    });
    await eventBus.subscribe('security-alerts', groupId, async msg=>{
      logger.warn({ alert: msg.value }, 'security alert worker');
    });
  }
  if(role==='ai'){
    await eventBus.subscribe('ai-inference', groupId, async msg=>{
      logger.debug('AI job', msg.value?.module);
    });
  }
  if(role==='audio'){
    await eventBus.subscribe('audio-queues', groupId, async msg=>{
      // Lavalink dispatch
    });
  }
  logger.info({ role, groupId }, 'worker subscribed');
}

// auto-start if WORKER_ROLE env set
if(process.env.WORKER_ROLE){
  startWorker(process.env.WORKER_ROLE as any);
}
