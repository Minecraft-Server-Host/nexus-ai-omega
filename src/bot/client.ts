/**
 * Nexus AI Omega — Discord Bot Client v3.2 GLOBAL ADMIN
 * discord.js v14 • Universal AI • Zero-Trust • Global Control Center
 * Guild ID: 1523481048149921883
 */
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection, Events, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { logger } from '../services/logger.js';
import { eventBus } from '../event-bus/kafkaClient.js';
import { securityManager } from '../security-center/securityManager.js';
import { aiEngine } from '../ai-center/aiEngine.js';

// Global Admin Systems
import { initializeGlobalSystems, getControlCenter, NEXUS_GUILD_ID } from '../global/index.js';
import { globalLogger } from '../global/globalLogger.js';
import { restrictionManager } from '../global/restrictionManager.js';
import { serverRegistry } from '../global/serverRegistry.js';
import { statsAggregator } from '../global/statisticsAggregator.js';
// global commands
import { globalbanuserCommand, globalunbanuserCommand, globaluserinfoCommand, globalblacklistCommand } from './commands/global/globalban.js';
// Global Team System v2
import { globalTeamService } from '../global/team/globalTeamService.js';
import { roleSyncService } from '../global/team/roleSyncService.js';
import { roleProtectionService } from '../global/team/roleProtectionService.js';
import { teamCommand } from './commands/team/teamCommands.js';
import { registerTicketSystem } from './commands/ticket/ticketSystem.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User, Partials.Reaction],
  shards: 'auto',
  failIfNotExists: false
});

(client as any).commands = new Collection();

registerTicketSystem(client);

// ===== SLASH COMMANDS =====
const baseCommands = [
  new SlashCommandBuilder().setName('ping').setDescription('Nexus latency check'),
  new SlashCommandBuilder().setName('ai').setDescription('Ask Nexus AI — Universal Provider')
    .addStringOption(o=>o.setName('prompt').setDescription('Your question').setRequired(true))
    .addStringOption(o=>o.setName('module').setDescription('AI module').addChoices(
      {name:'Hybrid AutoMod', value:'HYBRID_AUTOMOD'},
      {name:'Server Builder', value:'AI_SERVER_BUILDER'},
      {name:'Community Manager', value:'AI_COMMUNITY_MANAGER'},
      {name:'Embed Builder', value:'AI_EMBED_BUILDER'},
      {name:'Security Advisor', value:'AI_SECURITY_ADVISOR'},
      {name:'Code Assistant', value:'AI_CODE_ASSISTANT'},
      {name:'Analytics', value:'AI_ANALYTICS'},
      {name:'RAG Ticket', value:'RAG_TICKET_HELPDESK'}
    ))
    .addStringOption(o=>o.setName('provider').setDescription('AI Provider — universal').addChoices(
      {name:'🔮 Auto (best available)', value:'auto'},
      {name:'OpenAI GPT-4o', value:'openai'},
      {name:'Claude 3.5 Sonnet', value:'anthropic'},
      {name:'Google Gemini 1.5 Pro', value:'google'},
      {name:'Groq Llama 3.3 70B', value:'groq'},
      {name:'Mistral Large', value:'mistral'},
      {name:'DeepSeek Chat', value:'deepseek'},
      {name:'xAI Grok Beta', value:'xai'},
      {name:'Cohere Command-R+', value:'cohere'},
      {name:'Perplexity Online', value:'perplexity'},
      {name:'Together AI', value:'together'},
      {name:'OpenRouter Universal', value:'openrouter'},
      {name:'Azure OpenAI', value:'azure'},
      {name:'Ollama Local', value:'ollama'}
    ))
    .addStringOption(o=>o.setName('model').setDescription('Specific model override (optional)')),
  new SlashCommandBuilder().setName('aiprovider').setDescription('Set guild AI provider / BYO key')
    .addStringOption(o=>o.setName('provider').setDescription('Provider').setRequired(true).addChoices(
      {name:'Auto', value:'auto'},
      {name:'OpenAI', value:'openai'},
      {name:'Claude', value:'anthropic'},
      {name:'Gemini', value:'google'},
      {name:'Groq', value:'groq'},
      {name:'Mistral', value:'mistral'},
      {name:'DeepSeek', value:'deepseek'},
      {name:'Grok (xAI)', value:'xai'},
      {name:'Cohere', value:'cohere'},
      {name:'Perplexity', value:'perplexity'},
      {name:'OpenRouter', value:'openrouter'},
      {name:'Ollama Local', value:'ollama'}
    ))
    .addStringOption(o=>o.setName('apikey').setDescription('Optional: your own BYO API key (DM only!)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('defcon').setDescription('View / set DEFCON')
    .addIntegerOption(o=>o.setName('level').setDescription('1-5').setMinValue(1).setMaxValue(5)),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('timeout').setDescription('Timeout user')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addIntegerOption(o=>o.setName('minutes').setDescription('Minutes').setMinValue(1).setMaxValue(40320))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('purge').setDescription('Bulk delete')
    .addIntegerOption(o=>o.setName('amount').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('serverbuild').setDescription('AI generate & baut kompletten Server (mit Vorschau + Bestätigung)')
    .addStringOption(o=>o.setName('theme').setDescription('e.g. Valorant esports 5000 users').setRequired(true))
    .addStringOption(o=>o.setName('provider').setDescription('AI Provider').addChoices(
      {name:'Auto', value:'auto'},
      {name:'GPT-4o', value:'openai'},
      {name:'Claude 3.5', value:'anthropic'},
      {name:'Gemini 1.5 Pro', value:'google'},
      {name:'Grok', value:'xai'}
    ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('level').setDescription('Show your Nexus level')
    .addUserOption(o=>o.setName('user').setDescription('Check user')),
  new SlashCommandBuilder().setName('ticket').setDescription('Open AI support ticket')
    .addStringOption(o=>o.setName('subject').setDescription('Issue').setRequired(true)),
  new SlashCommandBuilder().setName('dashboard').setDescription('Get dashboard link'),
  new SlashCommandBuilder().setName('design').setDescription('✨ AI Discord-Design Generator — Prompt → Mockup/Vorschau')
    .addStringOption(o=>o.setName('prompt').setDescription('Was soll designt werden? z.B. "Gaming Server Willkommens-Embed, dunkel & neon"').setRequired(true))
    .addStringOption(o=>o.setName('style').setDescription('Design-Stil').addChoices(
      {name:'🌆 Modern', value:'modern'},
      {name:'⚪ Minimal', value:'minimal'},
      {name:'🌃 Cyberpunk / Neon', value:'cyberpunk'},
      {name:'🎮 Gaming', value:'gaming'},
      {name:'🏢 Corporate', value:'corporate'},
      {name:'💬 Discord-Native', value:'discord-native'}
    ))
    .addBooleanOption(o=>o.setName('image').setDescription('Echtes Vorschaubild generieren (DALL·E, falls verfügbar)')),
  teamCommand.data
];

// In-Memory Speicher für ausstehende AI-Server-Builds (Vorschau → Bestätigen/Bearbeiten/Ablehnen)
interface PendingServerBuild { plan: any; theme: string; provider?: string; userId: string; guildId: string; createdAt: number; }
const pendingServerBuilds = new Map<string, PendingServerBuild>();
const SB_TTL_MS = 15 * 60 * 1000; // 15 Minuten
setInterval(()=>{ const now = Date.now(); for (const [k,v] of pendingServerBuilds) if (now - v.createdAt > SB_TTL_MS) pendingServerBuilds.delete(k); }, 5*60*1000);

// merge global admin commands
const globalAdminCommands = [
  globalbanuserCommand.data,
  globalunbanuserCommand.data,
  globaluserinfoCommand.data,
  globalblacklistCommand.data
];

const allCommands = [...baseCommands, ...globalAdminCommands].map(c=> (c as any).toJSON ? (c as any).toJSON() : c);

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN!;
  const clientId = process.env.DISCORD_CLIENT_ID!;
  if (!token || !clientId) { logger.warn('DISCORD_TOKEN / CLIENT_ID missing — skipping register'); return; }
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    logger.info('Registering (/) commands globally — v3.2 GLOBAL ADMIN …');
    await rest.put(Routes.applicationCommands(clientId), { body: allCommands });
    logger.info({ count: allCommands.length }, 'Slash commands registered — including /globalbanuser etc.');
    // also register global admin commands to control guild specifically (instant)
    try{
      await rest.put(Routes.applicationGuildCommands(clientId, NEXUS_GUILD_ID), { body: globalAdminCommands.map(c=>c.toJSON()) });
      logger.info('Global admin commands registered to Nexus Control Guild instantly');
    }catch{}
  } catch (e:any) { logger.error(e, 'command register failed'); }
}

// Guild-specific command registration — INSTANT (no propagation delay)
async function registerCommandsToGuild(guildId: string) {
  const token = process.env.DISCORD_TOKEN!;
  const clientId = process.env.DISCORD_CLIENT_ID!;
  if (!token || !clientId) return;
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: allCommands });
    logger.info({ guildId, count: allCommands.length }, '⚡ Guild commands registered instantly');
  } catch (e: any) {
    logger.warn({ guildId, err: e.message }, 'Guild command register failed');
  }
}

// ===== READY =====
client.once(Events.ClientReady, async c => {
  logger.info({ tag: c.user.tag, guilds: c.guilds.cache.size, ping: c.ws.ping }, '🌐 Nexus AI Omega v3.2 GLOBAL ADMIN ONLINE');
  await eventBus.connect();
  await aiEngine.init();

  // Initialize Global Admin Systems
  const { controlCenter } = await initializeGlobalSystems(client);

  // === Global Team System v2 ===
  const { globalTeamService } = await import('../global/team/globalTeamService.js');
  const { roleSyncService } = await import('../global/team/roleSyncService.js');
  const { roleProtectionService } = await import('../global/team/roleProtectionService.js');
  await globalTeamService.bootstrapDefaultTeam();
  roleProtectionService.attach(client);
  // initial sync all guilds (staggered)
  setTimeout(()=> roleSyncService.syncAllGuilds(c).then(r=> logger.info(r,'Team global sync finished')).catch(()=>{}), 8000);
  // periodic sync every 10 min
  setInterval(()=> roleSyncService.syncAllGuilds(c).catch(()=>{}), 10*60*1000);
  logger.info('👥 Global Nexus Team System v2 — ONLINE');
  
  // Register all guilds in server registry
  for(const [id, guild] of c.guilds.cache){
    await serverRegistry.upsertServer({
      guildId: id,
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      locale: guild.preferredLocale
    });
    // AI-AutoGuild_Id-Save: alle bekannten Guilds beim Start in den AI-Engine Registry speichern
    aiEngine.saveGuildId(id, guild.name);
    await globalLogger.log({
      eventType:'SYSTEM',
      severity:'info',
      guildId: id,
      guildName: guild.name,
      action:'GUILD_CACHED_STARTUP',
      result:`${guild.memberCount} members`
    });
  }

  // ⚡ Register commands instantly to ALL guilds (staggered 300ms apart to avoid rate limits)
  const guildIds = [...c.guilds.cache.keys()];
  logger.info({ guilds: guildIds.length }, '⚡ Registering guild commands to all guilds…');
  for (let i = 0; i < guildIds.length; i++) {
    setTimeout(() => registerCommandsToGuild(guildIds[i]), i * 300);
  }

  const provs = aiEngine.listProviders().filter((p:any)=>p.configured).map((p:any)=>p.id).join(', ');
  client.user?.setActivity(`🌐 ${c.guilds.cache.size} servers • /ai • v3.2`, { type: 3 });

  // global stats
  await globalLogger.log({
    eventType:'SYSTEM',
    severity:'success',
    action:'BOT_READY',
    result:`Nexus AI Omega v3.2 Global Admin online — ${c.guilds.cache.size} guilds`,
    metadata:{ providers: provs, shards: client.shard?.count ?? 1, controlCenter: controlCenter?.isReady() }
  });
});

// ===== GUILD JOIN / LEAVE — GLOBAL SERVER DATABASE =====
client.on(Events.GuildCreate, async guild=>{
  logger.info({ guild: guild.name, id: guild.id, members: guild.memberCount }, '➕ Joined new guild');
  // AI-AutoGuild_Id-Save: neue Guild sofort in AI-Engine Registry eintragen
  aiEngine.saveGuildId(guild.id, guild.name);
  await serverRegistry.upsertServer({
    guildId: guild.id,
    name: guild.name,
    icon: guild.icon,
    ownerId: guild.ownerId,
    memberCount: guild.memberCount,
    locale: guild.preferredLocale
  });
  await globalLogger.serverJoin(guild);
  statsAggregator.inc('commandsToday',0);

  // Auto-Invite: Invite-Link erstellen und in server-logs des Nexus-Servers senden
  try {
    const textChannel = guild.channels.cache
      .filter((c: any) => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me!)?.has(PermissionFlagsBits.CreateInstantInvite))
      .first() as any;
    let inviteUrl = '*(Kein Text-Kanal verfügbar)*';
    if (textChannel) {
      const invite = await textChannel.createInvite({ maxAge: 0, maxUses: 0, reason: 'Nexus Team — automatischer Support-Invite' }).catch(() => null);
      if (invite) inviteUrl = invite.url;
    }
    // Retry helper — Control Center may not be ready yet during startup
    const sendInviteToLogs = async () => {
      const cc = getControlCenter();
      if (cc) {
        await cc.sendTo('server-logs', {
          color: 0x06ffa5,
          title: '🟢 Nexus ist einem neuen Server beigetreten!',
          description: `**🏠 Server:** ${guild.name}\n**🆔 ID:** \`${guild.id}\`\n**👥 Mitglieder:** ${guild.memberCount}\n**👑 Owner:** <@${guild.ownerId}>\n\n🔗 **Invite-Link für das Nexus Team:**\n${inviteUrl}`,
          footer: 'Nexus AI Omega • Auto-Invite'
        });
        logger.info({ guild: guild.name }, 'Auto-invite sent to server-logs');
      } else {
        // Control Center not initialized yet — retry once after 15s
        setTimeout(async () => {
          try {
            const cc2 = getControlCenter();
            if (cc2) await cc2.sendTo('server-logs', {
              color: 0x06ffa5,
              title: '🟢 Nexus ist einem neuen Server beigetreten!',
              description: `**🏠 Server:** ${guild.name}\n**🆔 ID:** \`${guild.id}\`\n**👥 Mitglieder:** ${guild.memberCount}\n**👑 Owner:** <@${guild.ownerId}>\n\n🔗 **Invite-Link für das Nexus Team:**\n${inviteUrl}`,
              footer: 'Nexus AI Omega • Auto-Invite (verzögert)'
            });
          } catch {}
        }, 15_000);
      }
    };
    await sendInviteToLogs();
  } catch(e: any){ logger.warn({ err: e.message }, 'Auto-invite generation failed'); }

  // ⚡ Register commands instantly to this guild
  registerCommandsToGuild(guild.id).catch(() => {});

  // Global Team — auto create ✨ Nexus Team role
  try{ const { roleSyncService } = await import('../global/team/roleSyncService.js'); await roleSyncService.ensureTeamRole(guild); await roleSyncService.syncGuild(guild); }catch(e:any){ logger.warn(e.message); }
});
client.on(Events.GuildDelete, async guild=>{
  logger.warn({ guild: guild.name, id: guild.id }, '➖ Left guild');
  // AI-AutoGuild_Id-Save: Guild aus AI-Engine Registry entfernen
  aiEngine.removeGuildId(guild.id);
  await serverRegistry.markLeft(guild.id, guild.name);
});

// ===== MESSAGE LOGGING =====
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  // stats
  statsAggregator.inc('messagesToday',1);
  serverRegistry.incrementStat(message.guild.id, 'totalMessages', 1).catch(()=>{});

  // security scan
  const scan = securityManager.scanMessage(message.content);
  if (scan.blocked) {
    try { await message.delete(); } catch {}
    await message.channel.send({ content: `🛡️ <@${message.author.id}> blocked: \`${scan.reason}\``, allowedMentions:{users:[]} }).then(m=>setTimeout(()=>m.delete().catch(()=>{}), 6500));
    await globalLogger.log({
      eventType:'SCAM_DETECTED',
      severity:'security',
      guildId: message.guild.id,
      guildName: message.guild.name,
      channelId: message.channel.id,
      channelName: (message.channel as any).name,
      userId: message.author.id,
      username: message.author.tag,
      action:'MESSAGE_AUTO_DELETE',
      reason: scan.reason ?? undefined,
      result:'blocked',
      metadata:{ content: message.content.slice(0,200) }
    });
    return;
  }
  // hybrid automod
  if (message.content.length > 4) {
    const mod = await aiEngine.infer({ module:'HYBRID_AUTOMOD', guildId: message.guildId!, userId: message.author.id, prompt: message.content });
    const r = mod.output;
    if (r.action === 'delete' || r.action === 'timeout') {
      try { await message.delete(); } catch {}
      await message.channel.send(`⚠️ AutoMod \`${r.reason}\` score ${r.score} — <@${message.author.id}>`).then(m=>setTimeout(()=>m.delete().catch(()=>{}),7000));
      await globalLogger.log({
        eventType:'AI_ACTION',
        severity:'ai',
        guildId: message.guild.id,
        guildName: message.guild.name,
        channelId: message.channel.id,
        channelName: (message.channel as any).name,
        userId: message.author.id,
        username: message.author.tag,
        action:'AUTOMOD_'+r.action.toUpperCase(),
        reason: r.reason,
        result:`score ${r.score}`,
        metadata:{ aiEvaluated: r.aiEvaluated, triggers: r.triggers }
      });
    }
  }
  await eventBus.publish('analytics-stream', {
    key: message.guildId!,
    value: { type:'MESSAGE_CREATE', userId: message.author.id, channelId: message.channelId, length: message.content.length },
    timestamp: Date.now()
  });
});

// message delete / edit logging
client.on(Events.MessageDelete, async (msg:any)=>{
  if(!msg.guild) return;
  await globalLogger.log({
    eventType:'MESSAGE_DELETE',
    severity:'info',
    guildId: msg.guild.id,
    guildName: msg.guild.name,
    channelId: msg.channelId,
    channelName: msg.channel?.name,
    userId: msg.author?.id,
    username: msg.author?.tag,
    action:'MESSAGE_DELETE',
    result:'logged',
    metadata:{ content: msg.content?.slice(0,300), attachments: msg.attachments?.size || 0 }
  });
});
client.on(Events.MessageUpdate, async (oldMsg:any, newMsg:any)=>{
  if(!newMsg.guild || newMsg.author?.bot) return;
  if(oldMsg.content === newMsg.content) return;
  await globalLogger.log({
    eventType:'MESSAGE_EDIT',
    severity:'info',
    guildId: newMsg.guild.id,
    guildName: newMsg.guild.name,
    channelId: newMsg.channelId,
    channelName: newMsg.channel?.name,
    userId: newMsg.author?.id,
    username: newMsg.author?.tag,
    action:'MESSAGE_EDIT',
    result:'diff logged',
    metadata:{
      before: oldMsg.content?.slice(0,300),
      after: newMsg.content?.slice(0,300)
    }
  });
});

// voice logging
client.on(Events.VoiceStateUpdate, async (oldState:any, newState:any)=>{
  const guild = newState.guild || oldState.guild;
  const user = newState.member?.user || oldState.member?.user;
  if(!guild || !user || user.bot) return;
  let eventType='VOICE_MOVE', result='moved';
  if(!oldState.channelId && newState.channelId){ eventType='VOICE_JOIN'; result=`joined ${(newState.channel as any)?.name}`; }
  else if(oldState.channelId && !newState.channelId){ eventType='VOICE_LEAVE'; result=`left ${(oldState.channel as any)?.name}`; }
  await globalLogger.log({
    eventType,
    severity:'info',
    guildId: guild.id,
    guildName: guild.name,
    channelId: newState.channelId || oldState.channelId,
    channelName: (newState.channel || oldState.channel)?.name,
    userId: user.id,
    username: user.tag,
    action: eventType,
    result
  });
});

// channel / role logs
client.on(Events.ChannelCreate, async (ch:any)=>{
  if(!ch.guild) return;
  await globalLogger.log({ eventType:'CHANNEL_CREATE', severity:'info', guildId:ch.guild.id, guildName:ch.guild.name, channelId:ch.id, channelName:ch.name, action:'CHANNEL_CREATE', result: ChannelType[ch.type] });
});
client.on(Events.ChannelDelete, async (ch:any)=>{
  if(!ch.guild) return;
  await globalLogger.log({ eventType:'CHANNEL_DELETE', severity:'warning', guildId:ch.guild.id, guildName:ch.guild.name, channelName:ch.name, action:'CHANNEL_DELETE', result:'deleted' });
});
client.on(Events.GuildRoleCreate, async (role:any)=>{
  await globalLogger.log({ eventType:'ROLE_CREATE', severity:'info', guildId:role.guild.id, guildName:role.guild.name, action:'ROLE_CREATE', result: role.name, metadata:{ roleId: role.id, color: role.color }});
});
client.on(Events.GuildRoleDelete, async (role:any)=>{
  await globalLogger.log({ eventType:'ROLE_DELETE', severity:'warning', guildId:role.guild.id, guildName:role.guild.name, action:'ROLE_DELETE', result: role.name });
});
client.on(Events.GuildMemberAdd, async (member:any)=>{

  await globalLogger.log({ eventType:'MEMBER_JOIN', severity:'success', guildId:member.guild.id, guildName:member.guild.name, userId: member.id, username: member.user.tag, action:'MEMBER_JOIN', result:`${member.guild.memberCount} members` });
  // Global Team auto-assign
  try{ const { roleSyncService } = await import('../global/team/roleSyncService.js'); await roleSyncService.syncMember(member); }catch{}
});
client.on(Events.GuildMemberRemove, async (member:any)=>{
  await globalLogger.log({ eventType:'MEMBER_LEAVE', severity:'info', guildId:member.guild.id, guildName:member.guild.name, userId: member.id, username: member.user?.tag, action:'MEMBER_LEAVE' });
});
client.on(Events.GuildBanAdd, async (ban:any)=>{
  await globalLogger.log({ eventType:'BAN', severity:'error', guildId: ban.guild.id, guildName: ban.guild.name, userId: ban.user.id, username: ban.user.tag, action:'BAN_ADD', reason: ban.reason || undefined, result:'banned' });
});
client.on(Events.GuildBanRemove, async (ban:any)=>{
  await globalLogger.log({ eventType:'UNBAN', severity:'success', guildId: ban.guild.id, guildName: ban.guild.name, userId: ban.user.id, username: ban.user.tag, action:'BAN_REMOVE', result:'unbanned' });
});

// ===== INTERACTION — WITH GLOBAL RESTRICTION CHECK =====
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()){
    const { commandName } = interaction;

    // === GLOBAL USER RESTRICTION CHECK — BEFORE ANY COMMAND ===
    try{
      const check = await restrictionManager.validateInteraction(interaction);
      if(!check.allowed){
        return interaction.reply({ ephemeral:true, content: check.message || '⛔ You are currently restricted from using Nexus AI Omega. If you believe this is a mistake, please contact the Nexus Team.' });
      }
    }catch(e){ logger.error(e); }

    // log command execution globally
    statsAggregator.inc('commandsToday',1);
    if(interaction.guildId){
      serverRegistry.incrementStat(interaction.guildId, 'totalCommands', 1).catch(()=>{});
      serverRegistry.touchActivity(interaction.guildId).catch(()=>{});
    }
    globalLogger.commandExec(interaction).catch(()=>{});

    try {
      // ===== GLOBAL ADMIN COMMANDS =====
      if(commandName === 'globalbanuser') return await globalbanuserCommand.execute(interaction);
      if(commandName === 'globalunbanuser') return await globalunbanuserCommand.execute(interaction);
      if(commandName === 'globaluserinfo') return await globaluserinfoCommand.execute(interaction);
      if(commandName === 'globalblacklist') return await globalblacklistCommand.execute(interaction);

      // ===== GLOBAL TEAM COMMAND =====
      if(commandName === 'team') return await teamCommand.execute(interaction);

      // ===== STANDARD COMMANDS =====
      if (commandName === 'ping') {
        const provs = aiEngine.listProviders().filter((p:any)=>p.configured).map((p:any)=>p.id).join(', ');
        await interaction.reply({ ephemeral: true, content: `🏓 Pong! WS ${client.ws.ping}ms • Shard ${interaction.guild?.shardId ?? 0}\n🧠 AI: ${provs||'mock'}\n🌐 Global Control: ${getControlCenter()?.isReady() ? 'ONLINE ✅' : 'connecting…'}\n⚡ Uptime <t:${Math.floor(Date.now()/1000 - Math.floor((client.uptime??0)/1000))}:R>` });
        return;
      }
      if (commandName === 'ai') {
        await interaction.deferReply();
        const prompt = interaction.options.getString('prompt', true);
        const module = (interaction.options.getString('module') ?? 'AI_COMMUNITY_MANAGER') as any;
        const provider = interaction.options.getString('provider') ?? undefined;
        const model = interaction.options.getString('model') ?? undefined;
        statsAggregator.inc('aiRequestsToday',1);
        const res = await aiEngine.infer({ module, guildId: interaction.guildId ?? undefined, userId: interaction.user.id, prompt, provider: provider==='auto'? undefined : provider as any, model } as any);
        // log AI action globally
        await globalLogger.aiAction({
          guildId: interaction.guildId ?? undefined,
          guildName: interaction.guild?.name,
          userId: interaction.user.id,
          username: interaction.user.tag,
          action: module,
          command: `ai ${provider||'auto'}`,
          result: `${res.latencyMs}ms • ${res.model}`,
          metadata:{ prompt: prompt.slice(0,200), tokensIn: res.tokensIn, tokensOut: res.tokensOut, cost: res.costUsd }
        });
        const outStr = typeof res.output === 'string' ? res.output : JSON.stringify(res.output, null, 2);
        const embed = new EmbedBuilder()
          .setTitle(`🧠 Nexus AI • ${module}`)
          .setDescription('```json\n' + outStr.slice(0,3800) + '\n```')
          .setColor(0x7c3aed)
          .setFooter({ text: `⏱ ${res.latencyMs}ms • ${res.model} • $${res.costUsd.toFixed(5)} • v3.2 Global` })
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      if (commandName === 'design') {
        await interaction.deferReply();
        const prompt = interaction.options.getString('prompt', true);
        const style = interaction.options.getString('style') ?? 'modern';
        const wantImage = interaction.options.getBoolean('image') ?? true;
        statsAggregator.inc('aiRequestsToday',1);
        const res = await aiEngine.infer({
          module: 'AI_DISCORD_DESIGNER',
          guildId: interaction.guildId ?? undefined,
          userId: interaction.user.id,
          prompt,
          context: { style, wantImage }
        } as any);
        const d = res.output as any;
        await globalLogger.aiAction({
          guildId: interaction.guildId ?? undefined,
          guildName: interaction.guild?.name,
          userId: interaction.user.id,
          username: interaction.user.tag,
          action: 'AI_DISCORD_DESIGNER',
          command: `design ${style}`,
          result: `${res.latencyMs}ms • ${res.model}`,
          metadata:{ prompt: prompt.slice(0,200), hasImage: !!d?.imageUrl }
        });
        const embed = new EmbedBuilder()
          .setTitle(d?.title || '✨ Nexus Design Concept')
          .setDescription(d?.concept || prompt.slice(0,200))
          .setColor(0x7c3aed)
          .addFields(
            { name: '🎨 Palette', value: (d?.palette||[]).map((c:string)=>'`'+c+'`').join(' ') || '—', inline: false },
            { name: '🔤 Font', value: d?.font || 'Inter', inline: true },
            { name: '📐 Layout', value: (d?.layout||[]).slice(0,5).map((l:string)=>`• ${l}`).join('\n') || '—', inline: false },
            { name: '🧩 Components', value: (d?.components||[]).slice(0,6).join(', ') || '—', inline: false }
          )
          .setFooter({ text: `⏱ ${res.latencyMs}ms • ${res.model} • ${style} • Nexus AI Design v1` })
          .setTimestamp();
        if (d?.imageUrl) embed.setImage(d.imageUrl);
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      if (commandName === 'aiprovider') {
        const provider = interaction.options.getString('provider', true);
        const apiKey = interaction.options.getString('apikey') ?? undefined;
        if(apiKey && !interaction.channel?.isDMBased()){
          return interaction.reply({ ephemeral:true, content:'⚠️ For security, send BYO API keys ONLY in DM with the bot! Use /aiprovider without apikey to set provider, then DM the bot `/aiprovider` with key.' });
        }
        // @ts-ignore
        (aiEngine as any).setGuildProvider?.(interaction.guildId, provider, apiKey);
        await globalLogger.log({
          eventType:'AUDIT',
          severity:'info',
          guildId: interaction.guildId ?? undefined,
          guildName: interaction.guild?.name,
          userId: interaction.user.id,
          username: interaction.user.tag,
          action:'AI_PROVIDER_CHANGE',
          result: provider,
          metadata:{ byo: !!apiKey }
        });
        await interaction.reply({ ephemeral:true, content:`✅ AI Provider for this guild set to **${provider}**${apiKey ? ' + BYO key stored encrypted' : ''}\n\nSupported: OpenAI • Claude • Gemini • Groq • Mistral • DeepSeek • Grok(xAI) • Cohere • Perplexity • Together • OpenRouter • Azure • Ollama\n\nFallback chain automatic.`});
        return;
      }
      if (commandName === 'defcon') {
        const level = interaction.options.getInteger('level');
        const gid = interaction.guildId!;
        if (level) {
          securityManager.setDefcon(gid, level as any);
          await globalLogger.log({ eventType:'SECURITY_ALERT', severity: level<=2?'error':'warning', guildId:gid, guildName:interaction.guild?.name, userId:interaction.user.id, username:interaction.user.tag, action:'DEFCON_CHANGE', result:`DEFCON ${level}`, metadata:{level} });
          await interaction.reply(`🛡️ DEFCON set to **${level}** — ${level===1?'PANIC LOCKDOWN': level===5?'Normal': 'Elevated'}`);
        } else {
          const { securityManager } = await import('../security-center/securityManager.js');
          const d = securityManager.getDefcon(gid);
          await interaction.reply(`🛡️ Current DEFCON: **${d}**`);
        }
        return;
      }
      if (commandName === 'ban') {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        if (!interaction.guild) return interaction.reply({ ephemeral:true, content:'❌ This command must be used in a server.' });
        if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
          return interaction.reply({ ephemeral:true, content:'❌ I need the **Ban Members** permission in this server.' });
        }
        try {
          await interaction.guild.members.ban(user.id, { reason: `${reason} | Mod: ${interaction.user.tag}` });
          await globalLogger.log({ eventType:'BAN', severity:'error', guildId: interaction.guildId!, guildName: interaction.guild?.name, userId: user.id, username: user.tag, moderatorId: interaction.user.id, moderatorTag: interaction.user.tag, action:'BAN', reason, result:'executed' });
          statsAggregator.inc('bansToday',1);
          const banEmbed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle('🔨 User Banned')
            .addFields(
              { name:'👤 User', value:`${user.tag}
\`${user.id}\``, inline:true },
              { name:'🛡️ Moderator', value:interaction.user.tag, inline:true },
              { name:'📝 Reason', value:reason, inline:false }
            )
            .setTimestamp();
          await interaction.reply({ embeds:[banEmbed] });
        } catch (e:any) {
          await interaction.reply({ ephemeral:true, content:`❌ Could not ban ${user.tag}: ${e.message}` });
        }
        return;
      }
      if (commandName === 'timeout') {
        const user = interaction.options.getUser('user', true);
        const minutes = interaction.options.getInteger('minutes') ?? 10;
        if (!interaction.guild) return interaction.reply({ ephemeral:true, content:'❌ This command must be used in a server.' });
        if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return interaction.reply({ ephemeral:true, content:'❌ I need the **Timeout Members** permission in this server.' });
        }
        const toMember = await interaction.guild.members.fetch(user.id).catch(()=>null);
        if (!toMember) return interaction.reply({ ephemeral:true, content:`❌ ${user.tag} is not in this server.` });
        if (!toMember.moderatable) return interaction.reply({ ephemeral:true, content:`❌ I cannot timeout ${user.tag} — they likely have a higher role than me.` });
        try {
          await toMember.timeout(minutes * 60 * 1000, `Timeout by ${interaction.user.tag}`);
          await globalLogger.log({ eventType:'TIMEOUT', severity:'warning', guildId: interaction.guildId!, guildName: interaction.guild?.name, userId:user.id, username:user.tag, moderatorId:interaction.user.id, moderatorTag:interaction.user.tag, action:'TIMEOUT', result:`${minutes}m`});
          const toEmbed = new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle('⏳ User Timed Out')
            .addFields(
              { name:'👤 User', value:`${user.tag}
\`${user.id}\``, inline:true },
              { name:'🛡️ Moderator', value:interaction.user.tag, inline:true },
              { name:'⏱️ Duration', value:`${minutes} Minute${minutes!==1?'n':''}`, inline:true }
            )
            .setTimestamp();
          await interaction.reply({ embeds:[toEmbed] });
        } catch (e:any) {
          await interaction.reply({ ephemeral:true, content:`❌ Timeout failed: ${e.message}` });
        }
        return;
      }
      if (commandName === 'purge') {
        const amount = interaction.options.getInteger('amount', true);
        if (!interaction.guild) return interaction.reply({ ephemeral:true, content:'❌ This command must be used in a server.' });
        if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ ephemeral:true, content:'❌ I need the **Manage Messages** permission in this server.' });
        }
        await interaction.deferReply({ ephemeral:true });
        try {
          const deleted = await (interaction.channel as any)?.bulkDelete(amount, true);
          const count = deleted?.size ?? 0;
          await globalLogger.log({ eventType:'COMMAND_EXECUTED', severity:'warning', guildId: interaction.guildId!, guildName: interaction.guild?.name, userId: interaction.user.id, username: interaction.user.tag, command:'purge', action:'PURGE', result:`${count} msgs`, channelId: interaction.channelId, channelName: (interaction.channel as any)?.name });
          await interaction.editReply({ content:`🧹 Deleted **${count}** message${count!==1?'s':''}. (Note: Discord's bulk-delete only works for messages younger than 14 days.)` });
        } catch (e:any) {
          await interaction.editReply({ content:`❌ Could not purge: ${e.message}` });
        }
        return;
      }
      if (commandName === 'serverbuild') {
        if (!interaction.inGuild()) { await interaction.reply({ ephemeral:true, content:'⚠️ Nur in einem Server nutzbar.' }); return; }
        await interaction.deferReply();
        const theme = interaction.options.getString('theme', true);
        const provider = interaction.options.getString('provider') ?? undefined;
        const res = await aiEngine.infer({ module:'AI_SERVER_BUILDER', guildId: interaction.guildId ?? undefined, userId: interaction.user.id, prompt: theme, provider: provider==='auto'?undefined:provider as any } as any);
        await globalLogger.aiAction({
          guildId: interaction.guildId ?? undefined,
          guildName: interaction.guild?.name,
          userId: interaction.user.id,
          username: interaction.user.tag,
          action:'AI_SERVER_BUILDER_PREVIEW',
          command:'serverbuild',
          result: res.model,
          metadata:{ theme, latency: res.latencyMs }
        });
        const token = Math.random().toString(36).slice(2,10);
        pendingServerBuilds.set(token, { plan: res.output, theme, provider, userId: interaction.user.id, guildId: interaction.guildId!, createdAt: Date.now() });
        const { embed, row } = buildServerPreview(res.output, res.model, token);
        await interaction.editReply({ embeds: [embed], components: [row] });
        return;
      }
      if (commandName === 'level') {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const xp = 12480 + Math.floor(Math.random()*8000);
        const level = Math.floor(Math.sqrt(xp/150));
        const embed = new EmbedBuilder()
          .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
          .setTitle(`⭐ Level ${level}`)
          .setDescription(`**${xp.toLocaleString()} XP**\nNext level: ${((level+1)**2*150 - xp).toLocaleString()} XP\n\n📝 Messages: 1,482\n🎙️ Voice: 87h\n💰 ${ (Math.random()*9000|0).toLocaleString()} coins`)
          .setColor(0x06ffa5)
          .setThumbnail(target.displayAvatarURL({ size: 256 }));
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === 'ticket') {
        const subject = interaction.options.getString('subject', true);
        const ai = await aiEngine.infer({ module:'RAG_TICKET_HELPDESK', guildId: interaction.guildId ?? undefined, prompt: subject });
        await globalLogger.log({ eventType:'TICKET_OPEN', severity:'info', guildId:interaction.guildId!, guildName:interaction.guild?.name, userId: interaction.user.id, username: interaction.user.tag, action:'TICKET_OPEN', command:'ticket', reason: subject, result:`AI confidence ${(ai.output.confidence*100).toFixed(0)}%`, metadata:{ aiModel: ai.model } });
        await interaction.reply({ ephemeral: true, content: `🎟️ Ticket opened!\n\n**AI RAG Answer [${ai.model}]:**\n${ai.output.answer}\n\nConfidence: ${(ai.output.confidence*100).toFixed(0)}%` });
        return;
      }
      if (commandName === 'dashboard') {
        const provs = aiEngine.listProviders().filter((p:any)=>p.configured).map((p:any)=>p.id).join(', ');
        const cc = getControlCenter();
        await interaction.reply({ ephemeral:true, content: `📊 **Nexus Command Center v3.2 Global**\n${process.env.DASHBOARD_URL || 'http://localhost:8080'}\n\n🧠 Active AI: ${provs || 'mock'}\n🔐 Zero-Trust: ON\n🌐 Global Control: ${cc?.isReady() ? 'ONLINE ✅' : 'syncing'}\n⚡ 18 Modules\n🛡️ Control Guild: \`${NEXUS_GUILD_ID}\`` });
        return;
      }
      await interaction.reply({ ephemeral:true, content:'Unknown command' });
    } catch (e:any) {
      logger.error(e);
      await globalLogger.log({ eventType:'API_ERROR', severity:'error', guildId: interaction.guildId ?? undefined, userId: interaction.user?.id, username: interaction.user?.tag, action: commandName, command: commandName, result:'error', metadata:{ error: e.message }});
      if (interaction.deferred || interaction.replied) interaction.editReply('❌ Error').catch(()=>{});
      else interaction.reply({ ephemeral:true, content:'❌ Error' }).catch(()=>{});
    }
    return;
  }

  // button interactions — global blacklist pagination etc.
  if(interaction.isButton()){
    const id = interaction.customId;
    if(id.startsWith('gbl_')){
      // simple pagination — re-run command
      await interaction.deferUpdate().catch(()=>{});
      return;
    }
    if(id.startsWith('gb_')){
      await interaction.reply({ ephemeral:true, content:'🔐 Nexus Team action received — logged to audit.' });
      return;
    }

    // ===== AI Server Builder — Bestätigen / Bearbeiten / Ablehnen =====
    if(id.startsWith('sb_confirm_') || id.startsWith('sb_edit_') || id.startsWith('sb_reject_')){
      const token = id.split('_').slice(2).join('_');
      const pending = pendingServerBuilds.get(token);
      if(!pending){
        await interaction.reply({ ephemeral:true, content:'⌛ Diese Vorschau ist abgelaufen oder wurde bereits verarbeitet. Führe /serverbuild erneut aus.' });
        return;
      }
      const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      if(interaction.user.id !== pending.userId && !canManage){
        await interaction.reply({ ephemeral:true, content:'🔒 Nur der Ersteller oder ein Admin mit "Server verwalten" kann diese Vorschau bestätigen.' });
        return;
      }

      if(id.startsWith('sb_reject_')){
        pendingServerBuilds.delete(token);
        await interaction.update({ content:'❌ **AI Server Build abgelehnt.** Nichts wurde verändert.', embeds:[], components:[] });
        await globalLogger.aiAction({ guildId: pending.guildId, guildName: interaction.guild?.name, userId: interaction.user.id, username: interaction.user.tag, action:'AI_SERVER_BUILDER_REJECT', command:'serverbuild', result:'rejected', metadata:{ theme: pending.theme } });
        return;
      }

      if(id.startsWith('sb_edit_')){
        const modal = new ModalBuilder().setCustomId(`sb_editmodal_${token}`).setTitle('Server-Design bearbeiten');
        const input = new TextInputBuilder()
          .setCustomId('sb_edit_instructions')
          .setLabel('Was soll geändert werden?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('z.B. "Mehr Voice-Kanäle, weniger Rollen, Fokus auf Anime-Theme statt Gaming"')
          .setRequired(true)
          .setMaxLength(500);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      if(id.startsWith('sb_confirm_')){
        const guild = interaction.guild;
        if(!guild){ await interaction.reply({ ephemeral:true, content:'⚠️ Server nicht gefunden.' }); return; }
        await interaction.update({ content:'🏗️ **Baue Server...** Bitte warten (Rollen & Kanäle werden erstellt).', embeds:[], components:[] });
        const { created, failed } = await applyServerPlan(guild, pending.plan);
        pendingServerBuilds.delete(token);
        await globalLogger.aiAction({
          guildId: pending.guildId, guildName: guild.name, userId: interaction.user.id, username: interaction.user.tag,
          action:'AI_SERVER_BUILDER_APPLY', command:'serverbuild', result: failed.length ? 'partial' : 'success',
          metadata:{ theme: pending.theme, created, failed }
        });
        const resultEmbed = new EmbedBuilder()
          .setTitle(failed.length ? '⚠️ Server teilweise erstellt' : '✅ Server erfolgreich erstellt!')
          .setColor(failed.length ? 0xfacc15 : 0x06ffa5)
          .addFields(
            { name: '🎭 Rollen erstellt', value: created.roles.length ? created.roles.join(', ') : '—', inline: false },
            { name: '📁 Kategorien erstellt', value: created.categories.length ? created.categories.join(', ') : '—', inline: false },
            { name: '#️⃣ Kanäle erstellt', value: created.channels.length ? created.channels.join(', ').slice(0,1000) : '—', inline: false }
          );
        if(failed.length) resultEmbed.addFields({ name: '❌ Fehler', value: failed.slice(0,10).join('\n').slice(0,1000), inline: false });
        await interaction.editReply({ content: '', embeds: [resultEmbed] });
        return;
      }
    }
  }

  // ===== AI Server Builder — Bearbeiten-Modal ausgewertet =====
  if(interaction.isModalSubmit() && interaction.customId.startsWith('sb_editmodal_')){
    const token = interaction.customId.split('_').slice(2).join('_');
    const pending = pendingServerBuilds.get(token);
    if(!pending){
      await interaction.reply({ ephemeral:true, content:'⌛ Diese Vorschau ist abgelaufen. Führe /serverbuild erneut aus.' });
      return;
    }
    await interaction.deferUpdate();
    const editInstructions = interaction.fields.getTextInputValue('sb_edit_instructions');
    const newPrompt = `${pending.theme}\n\nÄnderungswünsche des Nutzers: ${editInstructions}`;
    const res = await aiEngine.infer({ module:'AI_SERVER_BUILDER', guildId: pending.guildId, userId: interaction.user.id, prompt: newPrompt, provider: pending.provider==='auto'?undefined:pending.provider as any } as any);
    pendingServerBuilds.delete(token);
    const newToken = Math.random().toString(36).slice(2,10);
    pendingServerBuilds.set(newToken, { plan: res.output, theme: newPrompt, provider: pending.provider, userId: pending.userId, guildId: pending.guildId, createdAt: Date.now() });
    const { embed, row } = buildServerPreview(res.output, res.model, newToken);
    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }
});

// Audit log zero-trust hook
client.on(Events.GuildAuditLogEntryCreate as any, async (entry:any, guild:any)=>{
  try {
    const actionMap: any = { 12:'BAN_ADD', 72:'CHANNEL_DELETE', 32:'ROLE_DELETE', 110:'WEBHOOK_CREATE' };
    const act = actionMap[entry.action] as any;
    if (act && entry.executorId) {
      const { securityManager } = await import('../security-center/securityManager.js');
      const alert = await securityManager.evaluateGatewayEvent(guild.id, entry.executorId, act);
      if(alert){
        await globalLogger.securityAlert({
          guildId: guild.id,
          guildName: guild.name,
          userId: entry.executorId,
          action: 'ZERO_TRUST_NUKE_INTERCEPT',
          result: alert.actionsTaken.join(', '),
          metadata: alert
        });
      }
    }
    // log all audit entries globally
    await globalLogger.log({
      eventType:'AUDIT',
      severity:'info',
      guildId: guild.id,
      guildName: guild.name,
      userId: entry.executorId,
      action: `AUDIT_${entry.action}`,
      metadata:{ targetId: entry.targetId, changes: entry.changes }
    });
  } catch {}
});


// ===== AI SERVER BUILDER — Vorschau, Bestätigung & echte Guild-Erstellung =====
function chTypeLabel(t: number){ return t===2 ? '🔊' : t===13 ? '🎙️' : '#'; }

function buildServerPreview(plan: any, model: string, token: string){
  const catLines = (plan.categories||[]).map((cat:any)=>
    `**${cat.name}**\n` + (cat.channels||[]).map((ch:any)=>`  ${chTypeLabel(ch.type)} ${ch.name}`).join('\n')
  ).join('\n\n');
  const roleLines = (plan.roles||[]).map((r:any)=>`🎭 **${r.name}** — ${r.color||'#99aab5'}`).join('\n');
  const totalChannels = (plan.categories||[]).reduce((n:number,c:any)=>n+(c.channels?.length||0),0);

  const embed = new EmbedBuilder()
    .setTitle(`🏗️ AI Server Builder — Vorschau: ${plan.name||'Nexus Generated Server'}`)
    .setDescription(`Thema: *${plan.prompt||''}*\n\n📁 ${plan.categories?.length||0} Kategorien • #️⃣ ${totalChannels} Kanäle • 🎭 ${plan.roles?.length||0} Rollen`)
    .addFields(
      { name: '📂 Struktur', value: catLines.slice(0,1000) || '—', inline: false },
      { name: '🎭 Rollen', value: roleLines.slice(0,1000) || '—', inline: false },
      { name: '🛡️ AutoMod', value: plan.automod?.enabled ? '✅ AntiSpam/AntiRaid/AntiNuke aktiv' : '❌ aus', inline: false }
    )
    .setColor(0x7c3aed)
    .setFooter({ text: `⏱ ~${Math.round(plan.estimatedBuildSec||8)}s Bauzeit • ${model} • Nexus AI Server Builder` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`sb_confirm_${token}`).setLabel('✅ Bestätigen').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sb_edit_${token}`).setLabel('✏️ Bearbeiten').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`sb_reject_${token}`).setLabel('❌ Ablehnen').setStyle(ButtonStyle.Danger)
  );
  return { embed, row };
}

// Baut den Plan real im Discord-Server: Rollen zuerst, dann Kategorien + Kanäle
async function applyServerPlan(guild: any, plan: any){
  const created = { roles: [] as string[], categories: [] as string[], channels: [] as string[] };
  const failed: string[] = [];

  for (const r of (plan.roles || [])) {
    try {
      const role = await guild.roles.create({
        name: r.name,
        color: r.color || undefined,
        permissions: BigInt(r.permissions || '0'),
        reason: 'Nexus AI Server Builder'
      });
      created.roles.push(role.name);
    } catch (e: any) { failed.push(`Rolle "${r.name}": ${e.message}`); }
  }

  for (const cat of (plan.categories || [])) {
    try {
      const category = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        reason: 'Nexus AI Server Builder'
      });
      created.categories.push(category.name);
      for (const ch of (cat.channels || [])) {
        try {
          const chan = await guild.channels.create({
            name: ch.name,
            type: ch.type === 2 ? ChannelType.GuildVoice : ch.type === 13 ? ChannelType.GuildStageVoice : ChannelType.GuildText,
            parent: category.id,
            reason: 'Nexus AI Server Builder'
          });
          created.channels.push(chan.name);
        } catch (e: any) { failed.push(`Kanal "${ch.name}": ${e.message}`); }
      }
    } catch (e: any) { failed.push(`Kategorie "${cat.name}": ${e.message}`); }
  }

  return { created, failed };
}

const token = process.env.DISCORD_TOKEN;
if (!token) {
  logger.warn('⚠️ DISCORD_TOKEN missing — Bot will NOT login. API + Dashboard still work. Set .env to go live.');
} else {
  // register commands then login
  const { REST: R } = await import('discord.js');
  // register is inside registerCommands()
  registerCommands().then(()=> client.login(token)).catch(e=>logger.error(e));
}

export { client };
