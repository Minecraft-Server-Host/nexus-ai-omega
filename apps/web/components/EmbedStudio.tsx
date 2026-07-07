'use client';
import { useState } from 'react';

export default function EmbedStudio(){
  const [title,setTitle]=useState('✨ Nexus AI Embed');
  const [desc,setDesc]=useState('Live WYSIWYG Interactive Component Builder — buttons, selects, modals.');
  const [color,setColor]=useState('#7c3aed');
  const [buttons,setButtons]=useState([
    {label:'Accept', style:'success'},
    {label:'Edit', style:'secondary'},
    {label:'Delete', style:'danger'},
    {label:'Dashboard', style:'link', url:'https://nexus.ai'}
  ]);

  return (
    <div className="glass rounded-[22px] p-4 grid lg:grid-cols-2 gap-5">
      <div>
        <div className="text-[12px] uppercase tracking-widest text-zinc-400 mb-2">🎨 Embed Builder — WYSIWYG</div>
        <label className="text-xs text-zinc-400">Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full bg-[#0b0f25] border border-violet-900/30 rounded-xl px-3 py-2 mb-3 text-sm"/>
        <label className="text-xs text-zinc-400">Description</label>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} className="w-full h-28 bg-[#0b0f25] border border-violet-900/30 rounded-xl px-3 py-2 mb-3 text-sm"/>
        <label className="text-xs text-zinc-400">Color</label>
        <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="block mb-3"/>
        <div className="text-xs text-zinc-400 mb-1">Buttons</div>
        <div className="flex flex-wrap gap-2">
          {buttons.map((b,i)=><span key={i} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs">{b.label} • {b.style}</span>)}
          <button className="px-2 py-1 rounded bg-violet-600 text-xs">+ Add</button>
        </div>
        <button className="mt-4 w-full py-2 rounded-xl bg-violet-600 font-bold">Send to #announcements</button>
      </div>
      <div>
        <div className="text-[11px] text-zinc-400 mb-2">Discord Preview — Dark</div>
        <div className="bg-[#313338] rounded-lg p-4 text-[14px] text-zinc-100 border-l-4" style={{borderLeftColor:color}}>
          <div className="flex gap-3">
            <img src="https://cdn.discordapp.com/embed/avatars/0.png" className="w-10 h-10 rounded-full"/>
            <div className="flex-1">
              <div className="text-[15px]"><b className="text-[#f2f3f5]">Nexus AI Omega</b> <span className="text-[11px] bg-[#5865f2] px-1 rounded text-white ml-1">APP</span> <span className="text-zinc-400 text-xs ml-2">Today at {new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
              <div className="mt-2 bg-[#2b2d31] rounded border-l-4 p-3" style={{borderLeftColor:color}}>
                <div className="font-semibold text-white">{title}</div>
                <div className="text-zinc-300 text-[13.5px] mt-1 whitespace-pre-wrap">{desc}</div>
                <div className="text-[11px] text-zinc-400 mt-2">Nexus AI Omega • v2.2</div>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {buttons.map((b,i)=>{
                  const cls = b.style==='success' ? 'bg-[#248046]': b.style==='danger' ? 'bg-[#da373c]' : b.style==='link' ? 'bg-[#4e5058]' : 'bg-[#4e5058]';
                  return <button key={i} className={`${cls} text-white text-[13px] px-3 py-[8px] rounded`}>{b.label}</button>
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="text-[11px] text-zinc-400 mt-3">Live data binding: {'{guild.member_count}'} • {'{event.time_remaining}'} • auto-update without repost</div>
      </div>
    </div>
  );
}
