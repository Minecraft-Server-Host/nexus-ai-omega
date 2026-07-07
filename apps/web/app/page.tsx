'use client';
import { useEffect, useState } from 'react';
import ActionBuilder from '@/components/ActionBuilder';
import EmbedStudio from '@/components/EmbedStudio';
import Marketplace from '@/components/Marketplace';

export default function CommandCenter(){
  const [telemetry, setTelemetry] = useState<any>({});
  const [tab, setTab] = useState<'overview'|'automation'|'embed'|'market'>('overview');

  useEffect(()=>{
    const es = new EventSource((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080') + '/api/v1/stream');
    es.addEventListener('telemetry', e=> setTelemetry(JSON.parse((e as MessageEvent).data)));
    return ()=> es.close();
  },[]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#070915]/80 border-b border-violet-900/25">
        <div className="max-w-[1480px] mx-auto px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-3 font-extrabold text-lg">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400 shadow-[0_0_28px_rgba(124,58,237,.5)] grid place-items-center">NX</div>
            Nexus AI <span className="text-zinc-400 font-semibold">Omega</span>
            <span className="ml-2 text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">v2.2 PWA</span>
          </div>
          <nav className="flex gap-5 text-sm text-zinc-400">
            {['overview','automation','embed','market'].map(t=>
              <button key={t} onClick={()=>setTab(t as any)} className={tab===t ? 'text-white':''}>{t}</button>
            )}
          </nav>
          <div className="ml-auto text-xs">guilds {(telemetry.guilds||14892).toLocaleString()} • {telemetry.messagesPerSec||187} msg/s • {telemetry.aiInferences||23} AI/min</div>
        </div>
      </header>

      <main className="max-w-[1480px] mx-auto p-6">
        {tab==='overview' && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8 glass rounded-[22px] p-5">
              <h2 className="text-[12px] uppercase tracking-widest text-zinc-400 mb-3">⚡ Live Telemetry</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['Guilds', (telemetry.guilds||14892).toLocaleString(), 'green'],
                  ['Msg/s', telemetry.messagesPerSec||187, 'violet'],
                  ['AI/min', telemetry.aiInferences||23, 'cyan'],
                  ['Cache', (telemetry.cacheHit||96.4)+'%','emerald'],
                ].map(([l,v])=>(
                  <div key={l as string} className="bg-white/[0.035] border border-violet-900/25 rounded-2xl p-3">
                    <div className="text-[11px] text-zinc-400 uppercase">{l}</div>
                    <div className="text-2xl font-extrabold">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-4 md:grid-cols-8 gap-2 text-[11px]">
                {(telemetry.shards||Array.from({length:16},(_,i)=>({id:i,ping:28+Math.random()*30|0,guilds:220+Math.random()*300|0}))).map((s:any)=>
                  <div key={s.id} className="bg-white/[0.025] rounded-xl p-2 border border-white/5">
                    #{s.id}<br/><b>{s.ping}ms</b><br/>{s.guilds} g
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4 glass rounded-[22px] p-5">
              <h3 className="text-[12px] uppercase tracking-widest text-zinc-400 mb-2">🛡️ DEFCON</h3>
              <div className="flex gap-2 flex-wrap">
                {[5,4,3,2,1].map(n=> <button key={n} className={`px-3 py-2 rounded-xl text-sm border ${n===5?'bg-rose-600/20 border-rose-500/40':''} border-white/10 bg-white/5`}>{n}</button>)}
              </div>
              <p className="text-xs text-zinc-400 mt-3">Zero-Trust &lt;5ms • 18 modules • Quarantine 0</p>
            </div>
            <div className="col-span-12 glass rounded-[22px] p-5">
              <div className="text-[11px] text-zinc-400 uppercase tracking-wider mb-2">🧠 18 AI Modules — GPT-4o / Claude 3.5 • Qdrant RAG</div>
              <div className="flex flex-wrap gap-2 text-[12px]">
                {['HYBRID_AUTOMOD','RAG_TICKET','SERVER_BUILDER','COMMUNITY_MANAGER','SECURITY_ADVISOR','ANALYTICS','EMBED_BUILDER','ROLE_DESIGNER','PLUGIN_GENERATOR','CODE_ASSISTANT','EVENT_PLANNER','BUG_DETECTOR','PERMISSION_INSPECTOR','CHANNEL_BUILDER','PERFORMANCE_OPTIMIZER','SERVER_HEALTH','COMMAND_GENERATOR','DISCORD_DESIGNER'].map(m=>
                  <span key={m} className="px-2.5 py-1.5 rounded-full bg-white/[0.04] border border-violet-500/15">{m.replace(/_/g,' ')}</span>
                )}
              </div>
            </div>
          </div>
        )}
        {tab==='automation' && <ActionBuilder />}
        {tab==='embed' && <EmbedStudio />}
        {tab==='market' && <Marketplace />}
      </main>
    </div>
  );
}
