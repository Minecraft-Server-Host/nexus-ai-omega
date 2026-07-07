/**
 * Nexus AI Omega — Global Nexus Team Control Center
 * Guild ID: 1523481048149921883
 * Auto-provisions categories & 60+ log channels
 */
import { Client, ChannelType, PermissionFlagsBits, OverwriteType, Guild, TextChannel, CategoryChannel } from 'discord.js';
import { logger } from '../services/logger.js';

export const NEXUS_CONTROL_GUILD_ID = process.env.NEXUS_CONTROL_GUILD_ID || '1523481048149921883';
export const NEXUS_TEAM_ROLE_IDS = (process.env.NEXUS_TEAM_ROLE_IDS || '').split(',').filter(Boolean);
// fallback: @everyone deny, admin allow via permission check later

interface ChannelDef { name: string; topic?: string; }
interface CategoryDef { key: string; name: string; emoji: string; channels: ChannelDef[]; }

const CONTROL_CENTER_LAYOUT: CategoryDef[] = [
  { key:'monitoring', name:'📊 Global Monitoring', emoji:'📊', channels:[
    {name:'server-status', topic:'Live global server online/offline'},
    {name:'live-statistics', topic:'Realtime counters'},
    {name:'bot-status', topic:'Bot shards / uptime'},
    {name:'gateway-status', topic:'Discord Gateway health'},
    {name:'api-status', topic:'REST / GraphQL health'},
    {name:'database-status', topic:'Postgres • Redis • ClickHouse • Qdrant'},
    {name:'performance', topic:'CPU • RAM • Latency • Cache hit'},
  ]},
  { key:'logs', name:'📝 Global Logs', emoji:'📝', channels:[
    {name:'server-logs'},{name:'user-logs'},{name:'command-logs'},{name:'ai-logs'},
    {name:'ban-logs'},{name:'kick-logs'},{name:'warn-logs'},{name:'timeout-logs'},{name:'unban-logs'},
    {name:'role-logs'},{name:'permission-logs'},{name:'nickname-logs'},
    {name:'channel-logs'},{name:'category-logs'},{name:'voice-logs'},
    {name:'message-delete-logs'},{name:'message-edit-logs'},
    {name:'emoji-logs'},{name:'sticker-logs'},{name:'thread-logs'},{name:'webhook-logs'},{name:'invite-logs'},
    {name:'join-logs'},{name:'leave-logs'},{name:'reaction-logs'},{name:'verification-logs'},
    {name:'ticket-logs'},{name:'economy-logs'},{name:'level-logs'},
    {name:'security-logs'},{name:'backup-logs'},{name:'plugin-logs'},{name:'dashboard-logs'},
    {name:'error-logs'},{name:'system-logs'},{name:'developer-logs'},{name:'audit-logs'},
  ]},
  { key:'ai', name:'🤖 AI', emoji:'🤖', channels:[
    {name:'ai-chat', topic:'Live AI co-pilot'},
    {name:'ai-analysis', topic:'Model performance / cost'},
    {name:'ai-memory', topic:'RAG / Qdrant insights'},
    {name:'ai-training', topic:'Fine-tune jobs'},
    {name:'ai-debug', topic:'Inference traces'},
    {name:'ai-errors', topic:'LLM failures'},
  ]},
  { key:'moderation', name:'🛡 Moderation', emoji:'🛡️', channels:[
    {name:'mod-queue', topic:'Global moderation queue'},
    {name:'appeals', topic:'Ban appeals'},
    {name:'reports', topic:'User reports'},
  ]},
  { key:'servermgmt', name:'🌍 Server Management', emoji:'🌍', channels:[
    {name:'server-join', topic:'New guilds joining Nexus'},
    {name:'server-leave', topic:'Guilds leaving'},
    {name:'premium-servers', topic:'Premium activations'},
  ]},
  { key:'developer', name:'⚙ Developer', emoji:'⚙️', channels:[
    {name:'deploy-logs', topic:'CI/CD'},
    {name:'git-commits', topic:'GitHub webhooks'},
    {name:'api-traces', topic:'API traces'},
  ]},
  { key:'security', name:'🚨 Security', emoji:'🚨', channels:[
    {name:'raid-detection', topic:'Raid swarm alerts'},
    {name:'spam-detection', topic:'Spam waves'},
    {name:'scam-detection', topic:'Phishing / scam'},
    {name:'token-alerts', topic:'Leaked tokens / secrets'},
    {name:'risk-analysis', topic:'Risk scoring'},
    {name:'emergency-events', topic:'DEFCON 1 events'},
    {name:'blacklist-events', topic:'Global ban events'},
  ]},
  { key:'statistics', name:'📈 Statistics', emoji:'📈', channels:[
    {name:'global-members', topic:'Member counters'},
    {name:'global-servers', topic:'Server counters'},
    {name:'command-counter', topic:'Command usage'},
    {name:'active-users', topic:'DAU / MAU'},
    {name:'daily-statistics', topic:'Daily rollup'},
    {name:'weekly-statistics', topic:'Weekly rollup'},
    {name:'monthly-statistics', topic:'Monthly rollup'},
  ]},
];

export class NexusControlCenter {
  private client: Client;
  private channelCache = new Map<string, string>(); // logicalName -> channelId
  private ready = false;

  constructor(client: Client){ this.client = client; }

  async initialize(){
    try{
      const guild = await this.client.guilds.fetch(NEXUS_CONTROL_GUILD_ID).catch(()=>null);
      if(!guild){ logger.warn({guildId:NEXUS_CONTROL_GUILD_ID}, 'Nexus Control Guild not found — global logging will buffer / fallback to console'); return; }
      logger.info({ guild: guild.name, id: guild.id }, '🔐 Initializing Nexus Global Control Center…');
      // ensure categories & channels
      for(const catDef of CONTROL_CENTER_LAYOUT){
        const category = await this.ensureCategory(guild, `${catDef.emoji}｜${catDef.name.replace(/^[📊📝🤖🛡🌍⚙🚨📈]+\s*/, '')}`.slice(0,100), catDef.name);
        for(const chDef of catDef.channels){
          const chId = await this.ensureTextChannel(guild, category, chDef.name, chDef.topic);
          this.channelCache.set(chDef.name, chId);
          // also map legacy variants
          this.channelCache.set(chDef.name.replace(/-/g,'_'), chId);
        }
      }
      this.ready = true;
      logger.info({ channels: this.channelCache.size, categories: CONTROL_CENTER_LAYOUT.length }, '✅ Nexus Control Center provisioned');
      // send boot embed
      await this.sendTo('system-logs', {
        color:0x06ffa5, title:'🟢 Nexus AI Omega — Global Control Center Online',
        description:`**v3.2 Global Admin**\n• Guild: **${guild.name}**\n• Channels: **${this.channelCache.size}**\n• Categories: **${CONTROL_CENTER_LAYOUT.length}**\n• Shards: **${this.client.shard?.count ?? 1}**\n• Time: <t:${Math.floor(Date.now()/1000)}:F>`,
        footer:'Nexus AI Omega • Global Control v3.2'
      });
    }catch(e:any){
      logger.error({err:e.message}, 'Control Center init failed');
    }
  }

  private async ensureCategory(guild: Guild, name: string, reasonTopic: string){
    let cat = guild.channels.cache.find(c=> c.type===ChannelType.GuildCategory && c.name.toLowerCase().includes(name.toLowerCase().slice(-12))) as CategoryChannel | undefined;
    if(!cat){
      // try exact
      cat = guild.channels.cache.find(c=> c.type===ChannelType.GuildCategory && c.name.includes('Global') || c.name.includes('Monitoring') || c.name.includes(reasonTopic.split(' ')[1]||'')) as CategoryChannel | undefined;
    }
    if(cat) return cat;
    try{
      cat = await guild.channels.create({
        name: name.slice(0,100),
        type: ChannelType.GuildCategory,
        reason: 'Nexus AI Omega Global Control Center auto-provision',
        permissionOverwrites: [
          // @everyone deny view
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
          // try find Nexus Team roles
          ...NEXUS_TEAM_ROLE_IDS.map(rid=> ({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages], type: OverwriteType.Role as const }))
        ].filter(o=> o.id)
      });
      logger.info({ category: cat.name, id: cat.id }, 'Created Control Center category');
    }catch(e:any){
      // fallback: find any category
      cat = guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory) as CategoryChannel;
      if(!cat) throw e;
    }
    return cat!;
  }

  private async ensureTextChannel(guild: Guild, parent: CategoryChannel, name: string, topic?: string){
    const existing = guild.channels.cache.find(c=> c.type===ChannelType.GuildText && c.name===name && c.parentId===parent.id) as TextChannel | undefined
      || guild.channels.cache.find(c=> c.type===ChannelType.GuildText && c.name===name) as TextChannel | undefined;
    if(existing) return existing.id;
    try{
      const ch = await guild.channels.create({
        name: name.toLowerCase().replace(/[^a-z0-9\-_]/g,'-').slice(0,100),
        type: ChannelType.GuildText,
        parent: parent.id,
        topic: topic ? `🔐 NEXUS TEAM ONLY • ${topic} • v3.2` : '🔐 Nexus Global Control — Team Only',
        reason: 'Nexus Global Log Channel auto-provision'
      });
      return ch.id;
    }catch(e:any){
      logger.warn({name, err:e.message}, 'channel create failed, using fallback');
      // fallback to system channel or first text
      const fallback = guild.systemChannel || guild.channels.cache.find(c=>c.type===ChannelType.GuildText) as TextChannel;
      return fallback?.id || '';
    }
  }

  getChannelId(logicalName: string): string | null {
    return this.channelCache.get(logicalName) || this.channelCache.get(logicalName.replace(/_/g,'-')) || null;
  }

  async sendTo(channelName: string, embedData: {color?:number, title?:string, description?:string, fields?:{name:string,value:string,inline?:boolean}[], footer?:string}){
    try{
      const guild = this.client.guilds.cache.get(NEXUS_CONTROL_GUILD_ID);
      if(!guild) return false;
      const chId = this.getChannelId(channelName);
      if(!chId) return false;
      const ch = await guild.channels.fetch(chId).catch(()=>null) as TextChannel | null;
      if(!ch || !ch.isTextBased()) return false;
      await ch.send({ embeds:[{
        color: embedData.color ?? 0x7c3aed,
        title: embedData.title,
        description: embedData.description,
        fields: embedData.fields,
        timestamp: new Date().toISOString(),
        footer: { text: embedData.footer || 'Nexus AI Omega • Global Control Center v3.2' }
      }]});
      return true;
    }catch(e:any){
      logger.debug({err:e.message, channelName}, 'global send failed');
      return false;
    }
  }

  isReady(){ return this.ready; }
  listChannels(){ return Object.fromEntries(this.channelCache); }
}
