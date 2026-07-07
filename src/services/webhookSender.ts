/**
 * Nexus AI Omega — Outgoing Webhook Streaming v2.2
 * HMAC-SHA256 • exponential backoff
 */
import crypto from 'node:crypto';
import { logger } from './logger.js';

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

export async function dispatchWebhook(endpoint: WebhookEndpoint, event: string, payload: any){
  if(!endpoint.active || !endpoint.events.includes(event) && !endpoint.events.includes('*')) return;
  const body = JSON.stringify({ event, timestamp: Date.now(), data: payload });
  const sig = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');
  let delay = 500;
  for(let attempt=1; attempt<=5; attempt++){
    try{
      const res = await fetch(endpoint.url, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'X-Nexus-Event': event,
          'X-Nexus-Signature': `sha256=${sig}`,
          'User-Agent':'Nexus-Omega-Webhooks/2.2'
        },
        body,
        signal: AbortSignal.timeout(8000)
      });
      if(res.ok){ logger.info({ endpoint:endpoint.id, event, attempt }, 'webhook delivered'); return true; }
      throw new Error(`HTTP ${res.status}`);
    }catch(e:any){
      logger.warn({ endpoint:endpoint.id, attempt, err:e.message }, 'webhook retry');
      if(attempt===5) break;
      await new Promise(r=>setTimeout(r, delay));
      delay *= 2;
    }
  }
  return false;
}

// JSON portability
export function exportGuildConfig(guild:any){
  return JSON.stringify({
    version:'2.2',
    exported_at: new Date().toISOString(),
    guild: {
      id: guild.id,
      automod: guild.automodEnabled,
      security: guild.securityEnabled,
      ai: guild.aiEnabled,
      settings: guild.settings
    }
  }, null, 2);
}
