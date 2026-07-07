/**
 * Nexus Global Log Embeds — professional formatting
 * Colors: 🟢 Success #06ffa5 | 🟡 Warning #fbbf24 | 🔵 Info #0ea5e9 | 🔴 Error #f43f5e | 🟣 AI #a855f7 | ⚫ Security #1f2937
 */
import { EmbedBuilder, ColorResolvable } from 'discord.js';

export const NexusColors = {
  success: 0x06ffa5 as ColorResolvable,
  warning: 0xfbbf24 as ColorResolvable,
  info: 0x0ea5e9 as ColorResolvable,
  error: 0xf43f5e as ColorResolvable,
  ai: 0xa855f7 as ColorResolvable,
  security: 0x1f2937 as ColorResolvable,
  primary: 0x7c3aed as ColorResolvable,
};

export interface GlobalLogPayload {
  eventTitle: string;
  timestamp?: Date;
  guildName?: string;
  guildId?: string;
  user?: { tag?: string; id?: string; avatar?: string };
  moderator?: { tag?: string; id?: string };
  channel?: { name?: string; id?: string };
  action?: string;
  command?: string;
  reason?: string;
  result?: string;
  metadata?: Record<string, any>;
  color?: ColorResolvable;
}

export function buildGlobalLogEmbed(p: GlobalLogPayload){
  const e = new EmbedBuilder()
    .setTitle(p.eventTitle.slice(0,256))
    .setColor(p.color ?? NexusColors.primary)
    .setTimestamp(p.timestamp ?? new Date())
    .setFooter({ text: 'Nexus AI Omega • Global Control Center v3.2' });

  const fields: {name:string,value:string,inline:boolean}[] = [];
  if(p.guildName) fields.push({name:'🏰 Guild', value:`${p.guildName}\n\`${p.guildId}\``, inline:true});
  if(p.user?.tag) fields.push({name:'👤 User', value:`${p.user.tag}\n\`${p.user.id}\``, inline:true});
  if(p.moderator?.tag) fields.push({name:'🛡️ Moderator', value:`${p.moderator.tag}\n\`${p.moderator.id}\``, inline:true});
  if(p.channel?.name) fields.push({name:'💬 Channel', value:`#${p.channel.name}\n\`${p.channel.id}\``, inline:true});
  if(p.action) fields.push({name:'⚡ Action', value: p.action.slice(0,1024), inline:true});
  if(p.command) fields.push({name:'⌨️ Command', value:`\`/${p.command}\``, inline:true});
  if(p.result) fields.push({name:'📊 Result', value: p.result.slice(0,1024), inline:false});
  if(p.reason) fields.push({name:'📝 Reason', value: p.reason.slice(0,1024), inline:false});
  if(p.metadata){
    const metaStr = Object.entries(p.metadata).map(([k,v])=>`**${k}:** ${typeof v==='object'? '```json\n'+JSON.stringify(v,null,2).slice(0,600)+'\n```' : String(v)}`).join('\n').slice(0,1024);
    if(metaStr) fields.push({name:'🔎 Metadata', value: metaStr, inline:false});
  }
  if(fields.length) e.addFields(fields.slice(0,25));
  if(p.user?.avatar) e.setThumbnail(p.user.avatar);
  return e;
}

// quick color mapper
export function colorForEvent(eventType: string): ColorResolvable {
  const t = eventType.toLowerCase();
  if(t.includes('ban')||t.includes('error')||t.includes('emergency')||t.includes('raid')||t.includes('security')) return NexusColors.error;
  if(t.includes('warn')||t.includes('timeout')||t.includes('kick')) return NexusColors.warning;
  if(t.includes('ai')) return NexusColors.ai;
  if(t.includes('success')||t.includes('join')||t.includes('create')) return NexusColors.success;
  return NexusColors.info;
}
