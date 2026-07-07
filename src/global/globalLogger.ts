/**
 * Nexus AI Omega — Global Log System v3.2
 * Routes every important event to Nexus Team Control Server
 */
import { Client } from 'discord.js';
import { logger } from '../services/logger.js';
import { NexusControlCenter } from './nexusControlCenter.js';
import { buildGlobalLogEmbed, colorForEvent, NexusColors } from './embeds.js';

// simple prisma mock fallback if DB not connected
let prisma: any = null;
try{ const { PrismaClient } = await import('@prisma/client'); prisma = new PrismaClient(); }catch{}

export interface GlobalLogInput {
  eventType: string;
  severity?: 'success'|'warning'|'info'|'error'|'ai'|'security';
  guildId?: string;
  guildName?: string;
  channelId?: string;
  channelName?: string;
  userId?: string;
  username?: string;
  userAvatar?: string;
  moderatorId?: string;
  moderatorTag?: string;
  action?: string;
  command?: string;
  reason?: string;
  result?: string;
  metadata?: Record<string, any>;
  shardId?: number;
  latencyMs?: number;
}

const EVENT_CHANNEL_MAP: Record<string, string> = {
  // server
  SERVER_JOIN: 'server-join', SERVER_LEAVE: 'server-leave', SERVER_UPDATE: 'server-logs',
  // moderation
  BAN: 'ban-logs', UNBAN: 'unban-logs', KICK: 'kick-logs', WARN: 'warn-logs', TIMEOUT: 'timeout-logs',
  // messages
  MESSAGE_DELETE: 'message-delete-logs', MESSAGE_EDIT: 'message-edit-logs',
  // channels
  CHANNEL_CREATE: 'channel-logs', CHANNEL_DELETE: 'channel-logs', CHANNEL_UPDATE: 'channel-logs',
  // roles / perms
  ROLE_CREATE: 'role-logs', ROLE_DELETE: 'role-logs', ROLE_UPDATE: 'role-logs',
  PERMISSION_UPDATE: 'permission-logs', NICKNAME_UPDATE: 'nickname-logs',
  // voice
  VOICE_JOIN: 'voice-logs', VOICE_LEAVE: 'voice-logs', VOICE_MOVE: 'voice-logs',
  // misc
  EMOJI_UPDATE: 'emoji-logs', STICKER_UPDATE: 'sticker-logs', THREAD_UPDATE: 'thread-logs',
  WEBHOOK_UPDATE: 'webhook-logs', INVITE_CREATE: 'invite-logs',
  MEMBER_JOIN: 'join-logs', MEMBER_LEAVE: 'leave-logs',
  REACTION_ADD: 'reaction-logs', VERIFICATION: 'verification-logs',
  TICKET_OPEN: 'ticket-logs', TICKET_CLOSE: 'ticket-logs',
  ECONOMY: 'economy-logs', LEVEL_UP: 'level-logs',
  // AI
  AI_ACTION: 'ai-logs', AI_ERROR: 'ai-errors',
  // security
  SECURITY_ALERT: 'security-logs', RAID_DETECTED: 'raid-detection', SPAM_DETECTED: 'spam-detection',
  SCAM_DETECTED: 'scam-detection', TOKEN_LEAK: 'token-alerts',
  // command
  COMMAND_EXECUTED: 'command-logs',
  // system
  DATABASE_ERROR: 'error-logs', API_ERROR: 'error-logs', SYSTEM: 'system-logs',
  BACKUP: 'backup-logs', PLUGIN: 'plugin-logs', DASHBOARD: 'dashboard-logs',
  AUDIT: 'audit-logs', DEVELOPER: 'developer-logs',
};

export class GlobalLogger {
  private static instance: GlobalLogger;
  private controlCenter: NexusControlCenter | null = null;
  private buffer: GlobalLogInput[] = [];
  private client: Client | null = null;

  private constructor(){}

  static getInstance(){ if(!GlobalLogger.instance) GlobalLogger.instance = new GlobalLogger(); return GlobalLogger.instance; }

  attach(client: Client, controlCenter: NexusControlCenter){
    this.client = client;
    this.controlCenter = controlCenter;
  }

  private channelFor(eventType: string): string {
    return EVENT_CHANNEL_MAP[eventType.toUpperCase()] 
      || EVENT_CHANNEL_MAP[eventType.split('_')[0]] 
      || (eventType.toLowerCase().includes('ai') ? 'ai-logs'
        : eventType.toLowerCase().includes('security') ? 'security-logs'
        : eventType.toLowerCase().includes('command') ? 'command-logs'
        : 'system-logs');
  }

  private colorFor(severity?: string){
    switch(severity){
      case 'success': return NexusColors.success;
      case 'warning': return NexusColors.warning;
      case 'error': return NexusColors.error;
      case 'ai': return NexusColors.ai;
      case 'security': return NexusColors.security;
      default: return NexusColors.info;
    }
  }

  async log(input: GlobalLogInput){
    const ts = new Date();
    // 1. persist to DB (best effort)
    try{
      if(prisma?.globalLog?.create){
        await prisma.globalLog.create({ data:{
          eventType: input.eventType,
          severity: input.severity || 'info',
          guildId: input.guildId,
          guildName: input.guildName,
          channelId: input.channelId,
          channelName: input.channelName,
          userId: input.userId,
          username: input.username,
          moderatorId: input.moderatorId,
          moderatorTag: input.moderatorTag,
          action: input.action,
          command: input.command,
          reason: input.reason,
          result: input.result,
          metadata: input.metadata || {},
          shardId: input.shardId,
          latencyMs: input.latencyMs,
          success: (input.severity !== 'error'),
          logChannel: this.channelFor(input.eventType),
          createdAt: ts
        }}).catch(()=>{});
      }
    }catch{}

    // 2. send to control center
    if(this.controlCenter?.isReady()){
      const ch = this.channelFor(input.eventType);
      const embed = buildGlobalLogEmbed({
        eventTitle: `${this.icon(input.severity)} ${input.eventType.replace(/_/g,' ')}`,
        timestamp: ts,
        guildName: input.guildName,
        guildId: input.guildId,
        user: input.userId ? { tag: input.username || 'Unknown', id: input.userId, avatar: input.userAvatar } : undefined,
        moderator: input.moderatorId ? { tag: input.moderatorTag || 'System', id: input.moderatorId } : undefined,
        channel: input.channelName ? { name: input.channelName, id: input.channelId } : undefined,
        action: input.action,
        command: input.command,
        reason: input.reason,
        result: input.result,
        metadata: input.metadata,
        color: this.colorFor(input.severity) || colorForEvent(input.eventType)
      });
      // send via control center
      const ok = await this.controlCenter.sendTo(ch, {
        color: Number(embed.data.color),
        title: embed.data.title ?? undefined,
        description: embed.data.description ?? undefined,
        fields: (embed.data.fields as any) ?? undefined,
        footer: embed.data.footer?.text
      });
      if(!ok){
        this.buffer.push(input);
        if(this.buffer.length>400) this.buffer.shift();
      }
      return ok;
    } else {
      // buffer
      this.buffer.push(input);
      logger.debug({event:input.eventType, guild:input.guildName}, 'global log buffered (control center not ready)');
      return false;
    }
  }

  async flushBuffer(){
    if(!this.controlCenter?.isReady() || !this.buffer.length) return;
    const copy = [...this.buffer]; this.buffer = [];
    for(const item of copy){ await this.log(item); }
  }

  private icon(sev?:string){
    switch(sev){
      case 'success': return '🟢';
      case 'warning': return '🟡';
      case 'error': return '🔴';
      case 'ai': return '🟣';
      case 'security': return '⚫';
      default: return '🔵';
    }
  }

  // convenience shortcuts
  serverJoin(g:any){ return this.log({ eventType:'SERVER_JOIN', severity:'success', guildId:g.id, guildName:g.name, metadata:{ members:g.memberCount, ownerId:g.ownerId }, result:'Bot added to guild' }); }
  serverLeave(g:any){ return this.log({ eventType:'SERVER_LEAVE', severity:'warning', guildId:g.id, guildName:g.name, result:'Bot removed' }); }
  commandExec(i:any){ return this.log({ eventType:'COMMAND_EXECUTED', severity:'info', guildId:i.guildId, guildName:i.guild?.name, channelId:i.channelId, channelName:(i.channel as any)?.name, userId:i.user.id, username:i.user.tag, command:i.commandName, metadata:{ options: i.options?.data?.map((o:any)=>`${o.name}:${o.value}`).join(', ') } }); }
  ban(o:any){ return this.log({ eventType:'BAN', severity:'error', ...o }); }
  aiAction(o:any){ return this.log({ eventType:'AI_ACTION', severity:'ai', ...o }); }
  securityAlert(o:any){ return this.log({ eventType:'SECURITY_ALERT', severity:'security', ...o }); }
}

export const globalLogger = GlobalLogger.getInstance();
