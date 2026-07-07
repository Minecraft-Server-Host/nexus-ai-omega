/**
 * Nexus AI Omega — Event Bus v2.1
 * Apache Kafka / Redpanda distributed broker
 * Fallback to in-memory EventEmitter for local dev
 */
import { EventEmitter } from 'node:events';
import { logger } from '../services/logger.js';

type Topic =
  | 'gateway-events'
  | 'automod-tasks'
  | 'analytics-stream'
  | 'audio-queues'
  | 'dashboard-telemetry'
  | 'websocket-broadcast'
  | 'security-alerts'
  | 'ai-inference';

interface BusMessage {
  key?: string; // guild_id for partitioning
  value: any;
  timestamp: number;
  headers?: Record<string, string>;
}

class NexusEventBus extends EventEmitter {
  private static instance: NexusEventBus;
  private kafka: any = null;
  private producer: any = null;
  private consumer: any = null;
  private connected = false;
  private memoryFallback = true;

  private constructor() { super(); }

  static getInstance(): NexusEventBus {
    if (!NexusEventBus.instance) NexusEventBus.instance = new NexusEventBus();
    return NexusEventBus.instance;
  }

  async connect() {
    if (this.connected) return;
    try {
      const { Kafka, logLevel } = await import('kafkajs');
      const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
      this.kafka = new Kafka({
        clientId: process.env.KAFKA_CLIENT_ID || 'nexus-omega',
        brokers,
        ssl: process.env.KAFKA_SSL === 'true',
        logLevel: logLevel.NOTHING
      });
      this.producer = this.kafka.producer({ allowAutoTopicCreation: true });
      await this.producer.connect();
      this.memoryFallback = false;
      this.connected = true;
      logger.info({ brokers }, 'Kafka event bus connected');
    } catch (e:any) {
      this.memoryFallback = true;
      this.connected = true;
      logger.warn({ err: e.message }, 'Kafka unavailable — using in-memory bus (dev mode)');
    }
  }

  async publish(topic: Topic, message: BusMessage) {
    const envelope = { ...message, timestamp: message.timestamp || Date.now() };
    if (!this.memoryFallback && this.producer) {
      try {
        await this.producer.send({
          topic,
          messages: [{ key: message.key || null, value: JSON.stringify(envelope.value), headers: message.headers }]
        });
        return;
      } catch (e:any) {
        logger.error({ err: e.message, topic }, 'Kafka publish failed, falling back');
      }
    }
    // memory
    this.emit(topic, envelope);
    this.emit('websocket-broadcast', { topic, ...envelope });
  }

  async subscribe(topic: Topic, groupId: string, handler: (msg: BusMessage)=>Promise<void>|void) {
    if (!this.memoryFallback && this.kafka) {
      const consumer = this.kafka.consumer({ groupId });
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });
      await consumer.run({
        eachMessage: async ({ message }: any) => {
          try {
            const value = message.value ? JSON.parse(message.value.toString()) : null;
            await handler({ key: message.key?.toString(), value, timestamp: Number(message.timestamp), headers: message.headers });
          } catch (e:any) {
            logger.error({ err: e.message }, 'consumer handler error');
            // DLQ push
            await this.publish('automod-tasks' as Topic, { value: { dlq: true, original: message }, timestamp: Date.now() });
          }
        }
      });
      return;
    }
    this.on(topic, async (msg: BusMessage) => {
      try { await handler(msg); } catch(e:any){ logger.error(e); }
    });
  }

  getStats() {
    return {
      connected: this.connected,
      transport: this.memoryFallback ? 'memory' : 'kafka',
      listeners: this.eventNames().length
    };
  }
}

export const eventBus = NexusEventBus.getInstance();
export { NexusEventBus };
