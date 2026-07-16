/**
 * Nexus AI Omega — Event Bus v5.0
 * • Kafka/Redpanda with full consumer group support
 * • In-memory EventEmitter fallback (dev/test)
 * • Dead Letter Queue (DLQ) to dedicated topic
 * • Message envelope with schema version
 * • Typed topics
 * • Circuit breaker for Kafka publish failures
 * • Graceful shutdown
 */
import { EventEmitter } from 'node:events';
import { logger } from '../services/logger.js';

// ── Topic registry ────────────────────────────────────────────────────────────
export type Topic =
  | 'gateway-events'
  | 'automod-tasks'
  | 'analytics-stream'
  | 'audio-queues'
  | 'dashboard-telemetry'
  | 'websocket-broadcast'
  | 'security-alerts'
  | 'ai-inference'
  | 'ticket-events'
  | 'moderation-actions'
  | 'dlq';                   // Dead Letter Queue

// ── Message envelope ──────────────────────────────────────────────────────────
export interface BusMessage<T = unknown> {
  key?: string;
  value: T;
  timestamp: number;
  schemaVersion?: string;
  headers?: Record<string, string>;
  retryCount?: number;
}

// ── Circuit breaker ────────────────────────────────────────────────────────────
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold = 5;
  private readonly resetMs = 30_000;

  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetMs) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) this.state = 'open';
  }
}

// ── Event Bus ─────────────────────────────────────────────────────────────────
class NexusEventBus extends EventEmitter {
  private static instance: NexusEventBus;

  private kafka: unknown = null;
  private producer: unknown = null;
  private consumers = new Map<string, unknown>();
  private connected = false;
  private memFallback = true;
  private circuitBreaker = new CircuitBreaker();
  private publishCount = 0;
  private errorCount = 0;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): NexusEventBus {
    if (!NexusEventBus.instance) NexusEventBus.instance = new NexusEventBus();
    return NexusEventBus.instance;
  }

  // ── Connect ────────────────────────────────────────────────────────────────
  async connect(): Promise<void> {
    if (this.connected) return;
    try {
      const { Kafka, logLevel } = await import('kafkajs');
      const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
      this.kafka = new Kafka({
        clientId: process.env.KAFKA_CLIENT_ID || 'nexus-omega-v5',
        brokers,
        ssl: process.env.KAFKA_SSL === 'true',
        logLevel: logLevel.NOTHING,
        retry: { retries: 3, initialRetryTime: 300 },
      });
      const kafka = this.kafka as { producer: (opts?: unknown) => { connect: () => Promise<void> } };
      this.producer = kafka.producer({ allowAutoTopicCreation: true });
      await (this.producer as { connect: () => Promise<void> }).connect();
      this.memFallback = false;
      this.connected = true;
      logger.info({ brokers }, '✅ Kafka event bus connected');
    } catch (err) {
      this.memFallback = true;
      this.connected = true;
      logger.warn({ err: (err as Error).message }, '⚠️ Kafka unavailable — using in-memory bus (dev mode)');
    }
  }

  // ── Publish ────────────────────────────────────────────────────────────────
  async publish<T>(topic: Topic, message: BusMessage<T>): Promise<boolean> {
    const envelope: BusMessage<T> = {
      ...message,
      timestamp: message.timestamp || Date.now(),
      schemaVersion: '5.0',
    };

    this.publishCount++;

    if (!this.memFallback && this.producer && !this.circuitBreaker.isOpen()) {
      try {
        const prod = this.producer as {
          send: (opts: { topic: string; messages: unknown[] }) => Promise<void>;
        };
        await prod.send({
          topic,
          messages: [{
            key: message.key ?? null,
            value: JSON.stringify(envelope.value),
            headers: message.headers,
          }],
        });
        this.circuitBreaker.recordSuccess();
        return true;
      } catch (err) {
        this.errorCount++;
        this.circuitBreaker.recordFailure();
        logger.error({ err: (err as Error).message, topic }, 'Kafka publish failed — circuit breaker triggered');
        // Fallthrough to memory
      }
    }

    // Memory fallback
    this.emit(topic, envelope);
    this.emit('websocket-broadcast', { topic, ...envelope });
    return true;
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────
  async subscribe<T>(
    topic: Topic,
    groupId: string,
    handler: (msg: BusMessage<T>) => Promise<void> | void,
  ): Promise<void> {
    if (!this.memFallback && this.kafka) {
      try {
        const kafka = this.kafka as {
          consumer: (opts: { groupId: string }) => {
            connect: () => Promise<void>;
            subscribe: (opts: { topic: string; fromBeginning: boolean }) => Promise<void>;
            run: (opts: { eachMessage: (payload: unknown) => Promise<void> }) => Promise<void>;
          };
        };
        const consumer = kafka.consumer({ groupId });
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: false });
        await consumer.run({
          eachMessage: async (payload: unknown) => {
            const p = payload as { message: { key?: Buffer; value?: Buffer; timestamp: string; headers?: Record<string, Buffer> } };
            try {
              const value = p.message.value ? JSON.parse(p.message.value.toString()) as T : null as T;
              await handler({
                key: p.message.key?.toString(),
                value,
                timestamp: Number(p.message.timestamp),
                headers: Object.fromEntries(
                  Object.entries(p.message.headers ?? {}).map(([k, v]) => [k, v.toString()])
                ),
              });
            } catch (err) {
              this.errorCount++;
              logger.error({ err: (err as Error).message, topic }, 'Consumer handler error — sending to DLQ');
              await this.publish('dlq', { value: { topic, message: p.message, error: (err as Error).message }, timestamp: Date.now() });
            }
          },
        });
        this.consumers.set(`${topic}:${groupId}`, consumer);
        return;
      } catch (err) {
        logger.warn({ err: (err as Error).message }, 'Kafka consumer setup failed — using memory');
      }
    }

    // Memory fallback
    this.on(topic, async (msg: BusMessage<T>) => {
      try {
        await handler(msg);
      } catch (err) {
        this.errorCount++;
        logger.error({ err: (err as Error).message, topic }, 'Memory bus handler error');
      }
    });
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  async shutdown(): Promise<void> {
    logger.info('Event bus shutting down…');
    if (this.producer) {
      await (this.producer as { disconnect: () => Promise<void> }).disconnect().catch(() => {});
    }
    for (const [, consumer] of this.consumers) {
      await (consumer as { disconnect: () => Promise<void> }).disconnect().catch(() => {});
    }
    this.removeAllListeners();
    logger.info('Event bus shutdown complete');
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  getStats() {
    return {
      connected: this.connected,
      transport: this.memFallback ? 'memory' : 'kafka',
      publishCount: this.publishCount,
      errorCount: this.errorCount,
      consumers: this.consumers.size,
      listeners: this.eventNames().length,
      circuitBreakerOpen: this.circuitBreaker.isOpen(),
    };
  }
}

export const eventBus = NexusEventBus.getInstance();
