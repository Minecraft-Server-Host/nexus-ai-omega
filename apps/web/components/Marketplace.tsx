'use client';

const plugins = [
  {name:'AutoMod Pro', author:'Nexus Labs', rating:4.9, downloads:'128k', price:'Free', verified:true, desc:'Neuro-symbolic toxicity + 14 languages'},
  {name:'Ticket AI RAG', author:'nexus-ai', rating:4.8, downloads:'94k', price:'Free', verified:true, desc:'Qdrant vector helpdesk, 70% auto-close'},
  {name:'Level Cards Neon', author:'cyberart', rating:4.7, downloads:'62k', price:'$4.99', verified:true, desc:'Animated rank cards, WASM renderer'},
  {name:'Economy Casino+', author:'dank-team', rating:4.6, downloads:'41k', price:'Free', verified:false, desc:'Blackjack, roulette, central bank'},
  {name:'Audit Vault S3', author:'Nexus Labs', rating:4.9, downloads:'33k', price:'$2/mo', verified:true, desc:'Immutable media archive, 5yr retention'},
  {name:'Voice AI Whisper', author:'edge-ai', rating:4.5, downloads:'12k', price:'$9/mo', verified:false, desc:'Real-time voice-to-text moderation'},
];

export default function Marketplace(){
  return (
    <div className="glass rounded-[22px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] uppercase tracking-widest text-zinc-400">🛒 Community Developer Marketplace — v2.2</div>
          <div className="text-sm text-zinc-300">@nexus-ai/sdk • Stripe Connect • WASM verified</div>
        </div>
        <button className="px-3 py-2 rounded-xl bg-violet-600 text-sm font-bold">Publish Plugin</button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {plugins.map(p=>(
          <div key={p.name} className="bg-white/[0.035] border border-violet-900/20 rounded-2xl p-4">
            <div className="flex justify-between items-start">
              <div className="font-bold">{p.name}{p.verified && <span className="ml-2 text-[10px] text-cyan-300">✔ VERIFIED</span>}</div>
              <div className="text-xs">{p.price}</div>
            </div>
            <div className="text-xs text-zinc-400">by {p.author} • ⭐ {p.rating} • {p.downloads}</div>
            <div className="text-[13px] text-zinc-300 mt-2">{p.desc}</div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 py-[8px] rounded-lg bg-violet-600/90 text-sm font-semibold">Install</button>
              <button className="px-3 py-[8px] rounded-lg bg-white/5 border border-white/10 text-sm">Docs</button>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-zinc-400 mt-3">npm i @nexus-ai/sdk • npx nexus plugin create • wasmtime compile → marketplace CI static-analysis</div>
    </div>
  );
}
