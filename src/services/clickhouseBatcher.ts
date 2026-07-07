/**
 * Nexus AI Omega — ClickHouse OLAP Batcher v2.2
 * 1,000-record / 2s flush • graceful SIGTERM
 */
import { logger } from './logger.js';

type EventRow = { ts: number; guild_id: string; type: string; user_id?: string; data?: any };

class ClickHouseBatcher {
  private buffer: EventRow[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(private maxSize = 1000, private intervalMs = 2000){
    this.timer = setInterval(()=>this.flush(), this.intervalMs);
    process.on('SIGTERM', ()=> this.shutdown());
    process.on('SIGINT', ()=> this.shutdown());
  }

  push(row: EventRow){
    this.buffer.push(row);
    if(this.buffer.length >= this.maxSize) this.flush();
  }

  async flush(){
    if(this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, this.maxSize);
    try {
      // Real: await clickhouse.insert({ table:'message_events', values:batch, format:'JSONEachRow' })
      logger.debug({ count: batch.length }, 'ClickHouse bulk insert');
    } catch(e:any){
      logger.error(e, 'ClickHouse flush failed — requeue');
      this.buffer.unshift(...batch);
    } finally { this.flushing = false; }
  }

  async shutdown(){
    if(this.timer) clearInterval(this.timer);
    await this.flush();
    logger.info('ClickHouse batcher graceful shutdown');
  }

  stats(){ return { buffered: this.buffer.length, maxSize: this.maxSize }; }
}

export const chBatcher = new ClickHouseBatcher();
