/**
 * Nexus AI Omega — Redis High-Frequency Cache v2.2
 * 60s TTL • active invalidation pub/sub
 */
import { createClient } from 'redis';
import { logger } from './logger.js';

let client: any = null;
let pub: any = null;
let sub: any = null;

export async function getRedis(){
  if (client) return client;
  try {
    client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    pub = client.duplicate(); sub = client.duplicate();
    await Promise.all([client.connect(), pub.connect(), sub.connect()]);
    await sub.subscribe('nexus:invalidate', (msg:string)=>{
      client.del(msg).catch(()=>{});
    });
    logger.info('Redis cache connected');
  } catch(e:any){
    logger.warn('Redis unavailable, using LRU memory fallback');
    const { LRUCache } = await import('lru-cache');
    client = {
      store: new LRUCache({ max: 5000, ttl: 60_000 }),
      get: async (k:string)=> client.store.get(k) ?? null,
      set: async (k:string,v:string,opts?:any)=> client.store.set(k,v,{ttl:(opts?.EX||60)*1000}),
      del: async (k:string)=> client.store.delete(k),
    };
    pub = { publish: async ()=>1 };
  }
  return client;
}

export function Cacheable(opts:{ttl?:number, key?:(args:any[])=>string} = {}){
  const ttl = opts.ttl ?? 60;
  return function(_target:any,_prop:string,descriptor:PropertyDescriptor){
    const original = descriptor.value;
    descriptor.value = async function(...args:any[]){
      const r = await getRedis();
      const k = `nexus:${opts.key ? opts.key(args) : `${_prop}:${JSON.stringify(args)}`}`;
      const hit = await r.get(k);
      if(hit) return JSON.parse(hit);
      const res = await original.apply(this, args);
      await r.set(k, JSON.stringify(res), { EX: ttl });
      return res;
    };
    return descriptor;
  };
}

export async function invalidateCache(pattern:string){
  const r = await getRedis();
  try { await pub.publish('nexus:invalidate', pattern); } catch{}
  await r.del(pattern).catch(()=>{});
}
