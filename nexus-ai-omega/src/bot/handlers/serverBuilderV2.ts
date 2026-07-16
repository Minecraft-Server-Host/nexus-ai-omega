/**
 * Nexus AI Omega — Server Builder v2.0 Handler
 * ═══════════════════════════════════════════════════════════════════
 *
 * Vollständig KI-gesteuerter Server Builder.
 * Kein Template — jeder generierte Server ist einzigartig.
 *
 * Enthält:
 *  - Modal-Handler (Prompt-Eingabe)
 *  - KI-Analyse & Generierung (Deep Prompt Engineering)
 *  - Preview-System (vollständige Vorschau)
 *  - Build-Engine (Kategorien, Kanäle, Rollen, Permissions)
 *  - Validation (Duplikate, fehlende Permissions, schlechte Layouts)
 *  - Logging (jede Aktion wird geloggt)
 *  - Nexus Team Role Auto-Sync
 * ═══════════════════════════════════════════════════════════════════
 */

import {
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Guild,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  PermissionsBitField,
  type CategoryChannel,
  type TextChannel,
} from 'discord.js';
import { aiEngine }         from '../../ai-center/aiEngine.js';
import { builderLogger }    from '../../services/logger.js';
import { cacheGet, cacheSet } from '../../services/redisCache.js';
import { globalLogger }     from '../../global/globalLogger.js';
import { NexusColors }      from '../../utils/embeds.js';
import { randomUUID }       from 'node:crypto';
import { createHash }       from 'node:crypto';

// ── Plan-Cache Key ─────────────────────────────────────────────────────────
const planKey = (userId: string, guildId: string) =>
  `nexus:v5:serverbuilder:plan:${guildId}:${userId}`;

// ── Typen ──────────────────────────────────────────────────────────────────
export interface AIServerPlan {
  id:               string;
  serverName:       string;
  serverDescription:string;
  iconPrompt:       string;
  theme:            string;
  style:            string;
  purpose:          string;
  targetAudience:   string;
  estimatedSize:    string;
  palette:          string[];          // 3–5 Hex-Farben
  accentColor:      string;
  categories: Array<{
    name:     string;
    emoji:    string;
    private?: boolean;
    channels: Array<{
      name:      string;
      type:      'text' | 'voice' | 'forum' | 'announcement' | 'stage';
      topic?:    string;
      nsfw?:     boolean;
      slowmode?: number;
      private?:  boolean;
      emoji?:    string;
    }>;
  }>;
  roles: Array<{
    name:        string;
    color:       string;
    permissions: string[];
    hoist:       boolean;
    mentionable: boolean;
    emoji?:      string;
    description: string;
  }>;
  welcomeMessage:    string;
  rulesTemplate:     string;
  verificationLevel: 0 | 1 | 2 | 3 | 4;
  boosterPerks:      string;
  aiChannels:        string[];
  suggestedBots:     string[];
  uniqueFeatures:    string[];         // Besondere Features dieses Servers
  seed:              string;
  generatedAt:       number;
  prompt:            string;
  analysisNotes:     string;           // Was die KI erkannt hat
}

// ═══════════════════════════════════════════════════════════════════
// MODAL BUILDER
// ═══════════════════════════════════════════════════════════════════

export function buildServerPromptModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('serverbuilder:modal_submit')
    .setTitle('🏗️ KI Server Builder 2.0')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('server_idea')
          .setLabel('🌐 Server-Idee & Beschreibung')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(20)
          .setMaxLength(1000)
          .setPlaceholder(
            'Beispiel: "Eine moderne Minecraft SMP Community mit 500+ Spielern. ' +
            'Soll Support, Events, Voice-Chats, ein Ranking-System und ein ' +
            'Premium-Design in Blau und Lila haben. Zielgruppe: Teenager 13-18."',
          ),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('style')
          .setLabel('🎨 Design-Stil (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(50)
          .setPlaceholder('Modern · Gaming · Cyber · Anime · Luxury · Professional · Minimal · Cute · Futuristic'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('special_requests')
          .setLabel('✨ Besondere Wünsche (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500)
          .setPlaceholder(
            'z.B. "Unbedingt ein Ticket-System, Giveaway-Kanal, ' +
            'Partner-System, Musik-Bot-Kanäle und separate Staff-Bereich"',
          ),
      ),
    );
}

// ═══════════════════════════════════════════════════════════════════
// KI-ANALYSE & GENERIERUNG
// ═══════════════════════════════════════════════════════════════════

async function generateAIServerPlan(
  serverIdea:      string,
  style:           string,
  specialRequests: string,
  guildId:         string,
  userId:          string,
): Promise<AIServerPlan> {

  const seed = createHash('sha256')
    .update(serverIdea + style + specialRequests + Date.now().toString(36) + userId)
    .digest('hex')
    .slice(0, 12);

  const analysisPrompt = `You are an expert Discord server designer with 10 years of experience.
Analyze this server request and generate a COMPLETELY UNIQUE Discord server plan.

USER REQUEST:
- Server Idea: "${serverIdea}"
- Preferred Style: "${style || 'auto-detect from idea'}"
- Special Requests: "${specialRequests || 'none'}"
- Uniqueness Seed: "${seed}"

ANALYSIS REQUIRED:
Think deeply about:
1. What TYPE of community is this? (gaming, social, educational, professional, creative, etc.)
2. What is the PRIMARY PURPOSE of this server?
3. Who is the TARGET AUDIENCE? (age range, interests, expertise level)
4. What SYSTEMS are needed? (moderation, ticketing, events, economy, leveling, etc.)
5. What DESIGN LANGUAGE fits best? (colors, emojis, naming style)
6. What makes this server UNIQUE? What special features should it have?
7. What TONE should the server have? (casual, professional, fun, serious)
8. What SIZE is appropriate? (small 50, medium 500, large 5000+)

STRICT RULES:
- NEVER generate a generic "gaming server" or "community server" layout
- EVERY channel must have a clear PURPOSE specific to this server's theme
- Channel names must be CREATIVE and fit the server theme
- Roles must reflect the server's HIERARCHY and CULTURE
- Generate ONLY channels that make sense for this specific request
- Include UNIQUE features that differentiate this server
- Make channel emojis match the SERVER THEME, not just generic ones
- Color palette must match the MOOD and THEME

Return ONLY valid JSON, no markdown, no comments:
{
  "serverName": "Creative unique server name fitting the theme",
  "serverDescription": "Engaging 2-3 sentence server description for Discord bio",
  "iconPrompt": "Detailed prompt for AI image generation to create a server icon",
  "theme": "Detected theme",
  "style": "Detected or chosen style",
  "purpose": "Primary purpose",
  "targetAudience": "Target audience description",
  "estimatedSize": "small|medium|large",
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "accentColor": "#hex - main accent color",
  "analysisNotes": "Brief explanation of what you detected and why you made these choices",
  "uniqueFeatures": ["Feature 1", "Feature 2", "Feature 3"],
  "suggestedBots": ["Bot 1", "Bot 2"],
  "aiChannels": ["channel-name-for-ai-chat"],
  "welcomeMessage": "Engaging welcome message for new members",
  "rulesTemplate": "5-7 server rules appropriate for this community",
  "verificationLevel": 1,
  "boosterPerks": "What boosters get",
  "categories": [
    {
      "name": "📋 CATEGORY NAME",
      "emoji": "📋",
      "private": false,
      "channels": [
        {
          "name": "channel-name",
          "type": "text|voice|forum|announcement|stage",
          "topic": "Channel purpose/topic",
          "nsfw": false,
          "slowmode": 0,
          "private": false,
          "emoji": "💬"
        }
      ]
    }
  ],
  "roles": [
    {
      "name": "Role Name",
      "color": "#hex",
      "permissions": ["ADMINISTRATOR"],
      "hoist": true,
      "mentionable": false,
      "emoji": "👑",
      "description": "What this role is for"
    }
  ]
}`;

  builderLogger.info({ userId, guildId, seed }, '🤖 KI analysiert Server-Prompt…');

  try {
    const result = await aiEngine.infer({
      module:      'AI_SERVER_BUILDER',
      prompt:      analysisPrompt,
      guildId,
      userId,
      maxTokens:   4000,
      temperature: 0.82,
    });

    const text = String(result.text);

    // JSON extrahieren (auch wenn KI Markdown drumrum schreibt)
    const jsonMatches = [
      text.match(/```json\n?([\s\S]*?)```/),
      text.match(/```\n?([\s\S]*?)```/),
      text.match(/(\{[\s\S]*\})/),
    ];

    for (const match of jsonMatches) {
      if (match) {
        try {
          const parsed = JSON.parse(match[1] ?? match[0]) as Partial<AIServerPlan>;
          if (parsed.categories && parsed.roles) {
            const plan: AIServerPlan = {
              id:               randomUUID(),
              serverName:       parsed.serverName       ?? 'My Discord Server',
              serverDescription:parsed.serverDescription ?? '',
              iconPrompt:       parsed.iconPrompt        ?? '',
              theme:            parsed.theme             ?? serverIdea.slice(0, 50),
              style:            parsed.style             ?? style,
              purpose:          parsed.purpose           ?? '',
              targetAudience:   parsed.targetAudience    ?? '',
              estimatedSize:    parsed.estimatedSize     ?? 'medium',
              palette:          parsed.palette           ?? ['#7c3aed', '#06ffa5'],
              accentColor:      parsed.accentColor       ?? '#7c3aed',
              categories:       parsed.categories        ?? [],
              roles:            parsed.roles             ?? [],
              welcomeMessage:   parsed.welcomeMessage    ?? '',
              rulesTemplate:    parsed.rulesTemplate     ?? '',
              verificationLevel:(parsed.verificationLevel as 0|1|2|3|4) ?? 1,
              boosterPerks:     parsed.boosterPerks      ?? '',
              aiChannels:       parsed.aiChannels        ?? [],
              suggestedBots:    parsed.suggestedBots     ?? [],
              uniqueFeatures:   parsed.uniqueFeatures    ?? [],
              analysisNotes:    parsed.analysisNotes     ?? '',
              seed,
              generatedAt:      Date.now(),
              prompt:           serverIdea,
            };

            builderLogger.info({
              userId, guildId, seed,
              serverName:  plan.serverName,
              categories:  plan.categories.length,
              totalChannels: plan.categories.reduce((s, c) => s + c.channels.length, 0),
              roles:       plan.roles.length,
            }, '✅ KI Plan generiert');

            return plan;
          }
        } catch { /* weiter versuchen */ }
      }
    }
  } catch (err) {
    builderLogger.error({ err, userId, guildId }, 'KI Generierung fehlgeschlagen');
  }

  // Fallback mit dem Prompt als Basis
  return generateFallbackPlan(serverIdea, style, seed);
}

function generateFallbackPlan(idea: string, style: string, seed: string): AIServerPlan {
  const isGaming     = /game|gaming|esport|minecraft|fortnite|valorant|lol|fps|rpg/i.test(idea);
  const isAnime      = /anime|manga|waifu|otaku|japan/i.test(idea);
  const isBusiness   = /business|company|startup|work|professional|team/i.test(idea);
  const isCommunity  = /community|social|friends|chat/i.test(idea);

  const theme = isGaming ? 'gaming' : isAnime ? 'anime' : isBusiness ? 'business' : 'community';
  const palette = isGaming ? ['#f43f5e', '#0ea5e9', '#1f2937'] :
                  isAnime  ? ['#a855f7', '#ec4899', '#fbbf24'] :
                  isBusiness ? ['#0ea5e9', '#06b6d4', '#1f2937'] :
                  ['#7c3aed', '#06ffa5', '#0ea5e9'];

  return {
    id:               randomUUID(),
    serverName:       idea.slice(0, 30),
    serverDescription:`Welcome to our ${theme} community!`,
    iconPrompt:       `${theme} server icon, modern design`,
    theme,
    style:            style || theme,
    purpose:          'Community & Entertainment',
    targetAudience:   'General audience',
    estimatedSize:    'medium',
    palette,
    accentColor:      palette[0],
    analysisNotes:    'Fallback plan used — KI temporarily unavailable',
    uniqueFeatures:   ['Community Hub', 'Active Moderation', 'Fun Events'],
    suggestedBots:    ['MEE6', 'Carl-bot'],
    aiChannels:       ['ai-chat'],
    welcomeMessage:   `Welcome! We're glad you're here.`,
    rulesTemplate:    '1. Be respectful\n2. No spam\n3. Follow Discord ToS',
    verificationLevel: 1,
    boosterPerks:     'Exclusive booster role and special channel access',
    categories: [
      {
        name: '📋 INFORMATION', emoji: '📋',
        channels: [
          { name: 'rules',          type: 'text' as const, topic: 'Server rules', emoji: '📜' },
          { name: 'announcements',  type: 'announcement' as const, topic: 'Important updates', emoji: '📢' },
          { name: 'welcome',        type: 'text' as const, topic: 'Welcome new members', emoji: '👋' },
        ],
      },
      {
        name: '💬 COMMUNITY', emoji: '💬',
        channels: [
          { name: 'general',       type: 'text' as const, topic: 'General chat', emoji: '💬' },
          { name: 'introductions', type: 'text' as const, topic: 'Introduce yourself', emoji: '👤' },
          { name: 'off-topic',     type: 'text' as const, topic: 'Random chat', emoji: '🎲' },
        ],
      },
      {
        name: '🎙️ VOICE', emoji: '🎙️',
        channels: [
          { name: 'General',  type: 'voice' as const, emoji: '🔊' },
          { name: 'AFK',      type: 'voice' as const, emoji: '💤' },
        ],
      },
    ],
    roles: [
      { name: '👑 Owner',     color: '#fbbf24', permissions: ['ADMINISTRATOR'], hoist: true,  mentionable: false, emoji: '👑', description: 'Server Owner' },
      { name: '⚙️ Admin',     color: '#f43f5e', permissions: ['ADMINISTRATOR'], hoist: true,  mentionable: true,  emoji: '⚙️', description: 'Server Administrator' },
      { name: '🛡️ Moderator', color: '#06ffa5', permissions: ['KICK_MEMBERS', 'BAN_MEMBERS', 'MANAGE_MESSAGES'], hoist: true,  mentionable: true,  emoji: '🛡️', description: 'Server Moderator' },
      { name: '🎫 Support',   color: '#0ea5e9', permissions: ['MANAGE_MESSAGES'], hoist: false, mentionable: true,  emoji: '🎫', description: 'Support Team' },
      { name: '💎 VIP',       color: '#a855f7', permissions: [], hoist: false, mentionable: false, emoji: '💎', description: 'VIP Members' },
      { name: '👥 Member',    color: '#6b7280', permissions: [], hoist: false, mentionable: false, emoji: '👥', description: 'Regular Members' },
    ],
    seed,
    generatedAt: Date.now(),
    prompt: idea,
  };
}

// ═══════════════════════════════════════════════════════════════════
// AI VALIDATION — Prüft und repariert den Plan
// ═══════════════════════════════════════════════════════════════════

function validateAndFixPlan(plan: AIServerPlan): { plan: AIServerPlan; fixes: string[] } {
  const fixes: string[] = [];

  // 1. Duplikat-Kanäle entfernen
  const seenChannels = new Set<string>();
  for (const cat of plan.categories) {
    cat.channels = cat.channels.filter(ch => {
      const key = ch.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenChannels.has(key)) {
        fixes.push(`Duplikat-Kanal entfernt: ${ch.name}`);
        return false;
      }
      seenChannels.add(key);
      return true;
    });
  }

  // 2. Leere Kategorien entfernen
  plan.categories = plan.categories.filter(cat => {
    if (cat.channels.length === 0) {
      fixes.push(`Leere Kategorie entfernt: ${cat.name}`);
      return false;
    }
    return true;
  });

  // 3. Duplikat-Rollen entfernen
  const seenRoles = new Set<string>();
  plan.roles = plan.roles.filter(role => {
    const key = role.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenRoles.has(key)) {
      fixes.push(`Duplikat-Rolle entfernt: ${role.name}`);
      return false;
    }
    seenRoles.add(key);
    return true;
  });

  // 4. Fehlende Owner-Rolle hinzufügen
  const hasOwner = plan.roles.some(r =>
    r.permissions.includes('ADMINISTRATOR') ||
    r.permissions.includes('*') ||
    r.name.toLowerCase().includes('owner'),
  );
  if (!hasOwner && plan.roles.length > 0) {
    fixes.push('Owner-Rolle mit Admin-Rechten hinzugefügt');
    plan.roles.unshift({
      name: '👑 Owner',
      color: '#fbbf24',
      permissions: ['ADMINISTRATOR'],
      hoist: true,
      mentionable: false,
      emoji: '👑',
      description: 'Server Owner',
    });
  }

  // 5. Kanal-Namen bereinigen (Discord-konform)
  for (const cat of plan.categories) {
    for (const ch of cat.channels) {
      const original = ch.name;
      ch.name = ch.name
        .toLowerCase()
        .replace(/[äöü]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[c] ?? c))
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9\-_]/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 100);
      if (!ch.name) ch.name = 'channel';
      if (original !== ch.name) fixes.push(`Kanal bereinigt: ${original} → ${ch.name}`);
    }
  }

  // 6. Limit prüfen (Discord: max 500 Kanäle, 250 Rollen)
  let totalChannels = plan.categories.reduce((s, c) => s + c.channels.length, 0);
  if (totalChannels > 200) {
    fixes.push(`Zu viele Kanäle (${totalChannels}) — auf 200 begrenzt`);
    // Trimmen bis < 200
    while (totalChannels > 200) {
      const lastCat = plan.categories[plan.categories.length - 1];
      if (lastCat.channels.length > 1) {
        lastCat.channels.pop();
      } else {
        plan.categories.pop();
      }
      totalChannels = plan.categories.reduce((s, c) => s + c.channels.length, 0);
    }
  }
  if (plan.roles.length > 50) {
    fixes.push(`Zu viele Rollen (${plan.roles.length}) — auf 50 begrenzt`);
    plan.roles = plan.roles.slice(0, 50);
  }

  return { plan, fixes };
}

// ═══════════════════════════════════════════════════════════════════
// PREVIEW EMBED GENERATOR
// ═══════════════════════════════════════════════════════════════════

function buildPreviewEmbeds(plan: AIServerPlan): EmbedBuilder[] {
  const totalChannels = plan.categories.reduce((s, c) => s + c.channels.length, 0);
  const textChannels  = plan.categories.reduce((s, c) => s + c.channels.filter(ch => ch.type === 'text').length, 0);
  const voiceChannels = plan.categories.reduce((s, c) => s + c.channels.filter(ch => ch.type === 'voice').length, 0);
  const forumChannels = plan.categories.reduce((s, c) => s + c.channels.filter(ch => ch.type === 'forum').length, 0);

  const paletteDisplay = plan.palette.slice(0, 4).map(c => `\`${c}\``).join(' ');

  // ── Haupt-Preview Embed ─────────────────────────────────────────
  const mainEmbed = new EmbedBuilder()
    .setColor(parseInt(plan.accentColor?.replace('#', '') ?? '7c3aed', 16) as import('discord.js').ColorResolvable)
    .setTitle(`🏗️  Server Preview — ${plan.serverName}`)
    .setDescription(
      `> *${plan.serverDescription}*\n\n` +
      `> **🤖 KI-Analyse:** ${plan.analysisNotes}\n`,
    )
    .addFields(
      { name: '🎨 Theme',          value: plan.theme,                         inline: true },
      { name: '💅 Style',          value: plan.style,                         inline: true },
      { name: '🎯 Zielgruppe',     value: plan.targetAudience || '—',         inline: true },
      { name: '📊 Servergröße',   value: `${plan.estimatedSize} server`,     inline: true },
      { name: '🎭 Verifikation',   value: `Level ${plan.verificationLevel}`, inline: true },
      { name: '🎨 Farbpalette',   value: paletteDisplay,                     inline: false },
    );

  if (plan.uniqueFeatures?.length > 0) {
    mainEmbed.addFields({
      name: '✨ Besondere Features',
      value: plan.uniqueFeatures.map(f => `› ${f}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  // Stats
  mainEmbed.addFields(
    { name: '📂 Kategorien',  value: `\`${plan.categories.length}\``, inline: true },
    { name: '💬 Channels',    value: `\`${totalChannels}\``,          inline: true },
    { name: '🎭 Rollen',      value: `\`${plan.roles.length}\``,      inline: true },
    { name: '📝 Text',        value: `\`${textChannels}\``,           inline: true },
    { name: '🎙️ Voice',       value: `\`${voiceChannels}\``,          inline: true },
    { name: '💬 Forum',       value: `\`${forumChannels}\``,          inline: true },
  )
  .setFooter({ text: `Nexus AI Omega v5 • Server Builder 2.0 • Seed: ${plan.seed}` })
  .setTimestamp();

  // ── Kanal-Übersicht Embed ───────────────────────────────────────
  const structureEmbed = new EmbedBuilder()
    .setColor(NexusColors.info)
    .setTitle('📋  Server-Struktur')
    .setDescription('Vollständige Kanal- und Kategorien-Übersicht:');

  const categoryChunks: string[] = [];
  for (const cat of plan.categories) {
    const channels = cat.channels.slice(0, 8).map(ch => {
      const icon = ch.type === 'voice'        ? '🔊' :
                   ch.type === 'forum'        ? '💭' :
                   ch.type === 'announcement' ? '📢' :
                   ch.type === 'stage'        ? '🎭' : '💬';
      return `  ${icon} ${ch.name}`;
    }).join('\n');
    const more = cat.channels.length > 8 ? `\n  *+${cat.channels.length - 8} weitere*` : '';
    categoryChunks.push(`**${cat.name}**\n${channels}${more}`);
  }

  // Aufteilen in Felder (max 1024 Zeichen pro Feld)
  let currentChunk = '';
  let fieldCount = 0;
  for (const chunk of categoryChunks) {
    if (currentChunk.length + chunk.length > 900 || fieldCount === 0) {
      if (currentChunk && fieldCount <= 25) {
        structureEmbed.addFields({ name: '\u200b', value: currentChunk, inline: false });
      }
      currentChunk = chunk;
      fieldCount++;
    } else {
      currentChunk += '\n\n' + chunk;
    }
  }
  if (currentChunk && structureEmbed.data.fields && structureEmbed.data.fields.length < 25) {
    structureEmbed.addFields({ name: '\u200b', value: currentChunk, inline: false });
  }

  // ── Rollen Embed ────────────────────────────────────────────────
  const rolesEmbed = new EmbedBuilder()
    .setColor(NexusColors.ai)
    .setTitle('🎭  Rollen-Hierarchie')
    .setDescription(
      plan.roles.slice(0, 20).map((r, i) =>
        `${i + 1}. **${r.name}** — ${r.description}\n` +
        `   \`${r.color}\` • Hoist: ${r.hoist ? '✅' : '❌'} • Mention: ${r.mentionable ? '✅' : '❌'}`,
      ).join('\n') || '—',
    )
    .setFooter({ text: `${plan.roles.length} Rollen gesamt` });

  return [mainEmbed, structureEmbed, rolesEmbed];
}

// ── Action Buttons ─────────────────────────────────────────────────
function buildPreviewButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('serverbuilder:build_confirm')
      .setLabel('✅  Build Server')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('serverbuilder:edit_prompt')
      .setLabel('✏️  Edit Prompt')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('serverbuilder:regenerate')
      .setLabel('🔄  Generate Again')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('serverbuilder:cancel')
      .setLabel('❌  Cancel')
      .setStyle(ButtonStyle.Danger),
  );
}

// ═══════════════════════════════════════════════════════════════════
// BUILD ENGINE — Erstellt den Server
// ═══════════════════════════════════════════════════════════════════

async function executeBuild(
  guild:  Guild,
  plan:   AIServerPlan,
  userId: string,
  updateProgress: (embed: EmbedBuilder) => Promise<void>,
): Promise<{
  categoriesCreated: number;
  channelsCreated:   number;
  rolesCreated:      number;
  errors:            string[];
  durationMs:        number;
}> {
  const start  = performance.now();
  const errors: string[] = [];
  let categoriesCreated = 0;
  let channelsCreated   = 0;
  let rolesCreated      = 0;

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const progressEmbed = (phase: string, detail = '') => new EmbedBuilder()
    .setColor(NexusColors.warning)
    .setTitle('🏗️  Server wird gebaut…')
    .setDescription(`> **${phase}**${detail ? `\n> ${detail}` : ''}`)
    .addFields(
      { name: '🎭 Rollen',     value: `\`${rolesCreated}\``,      inline: true },
      { name: '📂 Kategorien', value: `\`${categoriesCreated}\``, inline: true },
      { name: '💬 Channels',   value: `\`${channelsCreated}\``,   inline: true },
    )
    .setFooter({ text: 'Nexus AI Omega v5 • Server Builder 2.0 • Bitte warten…' });

  // ── PHASE 1: Rollen erstellen ─────────────────────────────────
  await updateProgress(progressEmbed('🎭 Phase 1/3 — Rollen werden erstellt…'));

  // Rollen in umgekehrter Reihenfolge erstellen (höchste zuerst)
  const reversedRoles = [...plan.roles].reverse();
  for (const roleDef of reversedRoles) {
    try {
      const colorNum = parseInt(roleDef.color?.replace('#', '') ?? '6b7280', 16);
      const perms = buildPermissions(roleDef.permissions ?? []);

      await guild.roles.create({
        name:        roleDef.name,
        color:       isNaN(colorNum) ? undefined : colorNum,
        hoist:       roleDef.hoist       ?? false,
        mentionable: roleDef.mentionable ?? false,
        permissions: perms,
        reason:      `Nexus Server Builder 2.0 — ${plan.theme}`,
      });
      rolesCreated++;
      await sleep(200);
    } catch (err) {
      const msg = `Rolle "${roleDef.name}": ${(err as Error).message}`;
      errors.push(msg);
      builderLogger.warn({ err, role: roleDef.name, guildId: guild.id }, 'Rolle fehlgeschlagen');
    }
  }

  await updateProgress(progressEmbed('🎭 Rollen fertig', `${rolesCreated} Rollen erstellt`));

  // ── PHASE 2: Kategorien & Kanäle erstellen ───────────────────
  for (let catIdx = 0; catIdx < plan.categories.length; catIdx++) {
    const catDef = plan.categories[catIdx];

    await updateProgress(progressEmbed(
      `📂 Phase 2/3 — Kategorien (${catIdx + 1}/${plan.categories.length})`,
      `"${catDef.name}"`,
    ));

    let category: CategoryChannel | null = null;
    try {
      category = await guild.channels.create({
        name:   catDef.name.slice(0, 100),
        type:   ChannelType.GuildCategory,
        reason: `Nexus Server Builder 2.0 — ${plan.theme}`,
        permissionOverwrites: catDef.private ? [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        ] : [],
      }) as CategoryChannel;
      categoriesCreated++;
      await sleep(300);
    } catch (err) {
      errors.push(`Kategorie "${catDef.name}": ${(err as Error).message}`);
      builderLogger.warn({ err, category: catDef.name }, 'Kategorie fehlgeschlagen');
      continue;
    }

    // Kanäle in dieser Kategorie erstellen
    for (const chDef of catDef.channels) {
      try {
        const chType =
          chDef.type === 'voice'        ? ChannelType.GuildVoice :
          chDef.type === 'forum'        ? ChannelType.GuildForum :
          chDef.type === 'announcement' ? ChannelType.GuildAnnouncement :
          chDef.type === 'stage'        ? ChannelType.GuildStageVoice :
          ChannelType.GuildText;

        const createOpts: Parameters<typeof guild.channels.create>[0] = {
          name:   chDef.name.slice(0, 100) || 'channel',
          type:   chType,
          parent: category.id,
          reason: `Nexus Server Builder 2.0`,
          permissionOverwrites: chDef.private ? [
            { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          ] : [],
        };

        if (chDef.topic    && chType === ChannelType.GuildText)
          (createOpts as Record<string, unknown>).topic = chDef.topic.slice(0, 1024);
        if (chDef.slowmode && chType === ChannelType.GuildText)
          (createOpts as Record<string, unknown>).rateLimitPerUser = Math.min(chDef.slowmode, 21600);
        if (chDef.nsfw     && chType === ChannelType.GuildText)
          (createOpts as Record<string, unknown>).nsfw = true;

        await guild.channels.create(createOpts);
        channelsCreated++;
        await sleep(350); // Rate-Limit Puffer
      } catch (err) {
        errors.push(`Kanal "${chDef.name}": ${(err as Error).message}`);
      }
    }

    // Progress aktualisieren nach jeder Kategorie
    await updateProgress(progressEmbed(
      `📂 Phase 2/3 — Kategorien (${catIdx + 1}/${plan.categories.length})`,
      `${channelsCreated} Channels bisher`,
    ));
  }

  const durationMs = Math.round(performance.now() - start);

  // ── Logging ─────────────────────────────────────────────────
  await globalLogger.log({
    eventType: 'AI_ACTION',
    severity:  'success',
    guildId:   guild.id,
    guildName: guild.name,
    userId,
    action:    'SERVER_BUILDER_COMPLETE',
    result:
      `${categoriesCreated} Kategorien, ${channelsCreated} Channels, ${rolesCreated} Rollen` +
      ` | Dauer: ${(durationMs / 1000).toFixed(1)}s | Fehler: ${errors.length}`,
    metadata: {
      plan_id:    plan.id,
      seed:       plan.seed,
      theme:      plan.theme,
      style:      plan.style,
      durationMs,
      errors:     errors.length,
    },
  });

  builderLogger.info({
    guildId: guild.id,
    userId,
    categoriesCreated, channelsCreated, rolesCreated,
    errors: errors.length, durationMs,
  }, '✅ Server Build abgeschlossen');

  return { categoriesCreated, channelsCreated, rolesCreated, errors, durationMs };
}

// ── Permissions Builder ─────────────────────────────────────────────
function buildPermissions(perms: string[]): PermissionsBitField {
  const bits = new PermissionsBitField();
  for (const p of perms) {
    if (p === '*' || p === 'ADMINISTRATOR') {
      bits.add(PermissionFlagsBits.Administrator);
      continue;
    }
    const key = p.toUpperCase().replace(/\s/g, '_') as keyof typeof PermissionFlagsBits;
    if (key in PermissionFlagsBits) bits.add(PermissionFlagsBits[key] as bigint);
  }
  return bits;
}

// ═══════════════════════════════════════════════════════════════════
// BUTTON HANDLERS
// ═══════════════════════════════════════════════════════════════════

/** [📝 Create AI Server] Button → öffnet Modal */
export async function handleOpenModal(interaction: ButtonInteraction): Promise<void> {
  await interaction.showModal(buildServerPromptModal());
}

/** Modal-Submit → KI generiert Plan → Preview */
export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: false });

  const serverIdea      = interaction.fields.getTextInputValue('server_idea');
  const style           = interaction.fields.getTextInputValue('style');
  const specialRequests = interaction.fields.getTextInputValue('special_requests');
  const guildId         = interaction.guildId!;
  const userId          = interaction.user.id;

  // Logging: Prompt erhalten
  await globalLogger.log({
    eventType: 'AI_ACTION',
    severity:  'ai',
    guildId,
    guildName: interaction.guild?.name,
    userId,
    username:  interaction.user.tag,
    action:    'SERVER_BUILDER_PROMPT',
    result:    `Prompt: "${serverIdea.slice(0, 100)}"`,
    metadata:  { serverIdea, style, specialRequests },
  });

  // Loading-Embed
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(NexusColors.ai)
        .setTitle('🤖  KI analysiert deinen Prompt…')
        .setDescription(
          `> **Prompt:** "${serverIdea.slice(0, 200)}"\n\n` +
          '> Die KI denkt über deine Idee nach:\n' +
          '> ├── 🔍 Analysiert Community-Typ & Zweck\n' +
          '> ├── 🎨 Wählt passendes Design\n' +
          '> ├── 📋 Generiert einzigartige Struktur\n' +
          '> ├── 🎭 Erstellt Rollen-Hierarchie\n' +
          '> └── ✅ Validiert & optimiert alles\n',
        )
        .setFooter({ text: 'Nexus AI Omega v5 • Server Builder 2.0 • KI arbeitet…' }),
    ],
  });

  // Plan generieren
  let plan = await generateAIServerPlan(serverIdea, style, specialRequests, guildId, userId);

  // Validieren & fixen
  const { plan: fixedPlan, fixes } = validateAndFixPlan(plan);
  plan = fixedPlan;

  if (fixes.length > 0) {
    builderLogger.info({ guildId, userId, fixes }, `KI-Validierung: ${fixes.length} Fixes angewendet`);
  }

  // Plan im Cache speichern (15 Min TTL)
  await cacheSet(planKey(userId, guildId), plan, 900);

  // Logging: Preview generiert
  await globalLogger.log({
    eventType: 'AI_ACTION',
    severity:  'success',
    guildId,
    userId,
    action:    'SERVER_BUILDER_PREVIEW',
    result:    `Plan generiert: "${plan.serverName}" | ${plan.categories.length} Kategorien | ${plan.roles.length} Rollen`,
    metadata:  { planId: plan.id, fixes: fixes.length },
  });

  // Preview anzeigen
  const previewEmbeds = buildPreviewEmbeds(plan);

  // Fixes anzeigen wenn vorhanden
  if (fixes.length > 0) {
    previewEmbeds.push(
      new EmbedBuilder()
        .setColor(NexusColors.warning)
        .setTitle('🔧  KI-Optimierungen angewendet')
        .setDescription(fixes.slice(0, 10).map(f => `› ${f}`).join('\n')),
    );
  }

  await interaction.editReply({
    embeds:     previewEmbeds,
    components: [buildPreviewButtons()],
  });
}

/** [✅ Build Server] → Zeigt Optionen: Löschen oder Hinzufügen */
export async function handleBuildConfirm(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  const userId  = interaction.user.id;
  const guildId = interaction.guildId!;
  const guild   = interaction.guild!;

  const plan = await cacheGet<AIServerPlan>(planKey(userId, guildId));
  if (!plan) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(NexusColors.error)
        .setTitle('❌  Plan abgelaufen')
        .setDescription('> Der Server-Plan ist abgelaufen (15 Min Limit).\n> Bitte starte mit `/serverbuilder ai` neu.')],
      components: [],
    });
    return;
  }

  const existingCats = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
  const existingChs  = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).size;
  const existingRoles = guild.roles.cache.filter(r => !r.managed && r.id !== guild.roles.everyone.id).size;

  const modeEmbed = new EmbedBuilder()
    .setColor(NexusColors.warning)
    .setTitle('🏗️  Build-Modus wählen')
    .setDescription(
      `> **Aktueller Server:**
` +
      `> 📂 ${existingCats} Kategorien · 💬 ${existingChs} Kanäle · 🎭 ${existingRoles} Rollen

` +
      `> **Wie soll der neue Server gebaut werden?**`,
    )
    .addFields(
      { name: '🗑️ Alles löschen & neu bauen', value: '> Alle vorhandenen Kanäle/Rollen werden gelöscht\n> Dann wird der KI-Plan komplett neu gebaut', inline: false },
      { name: '➕ Nur hinzufügen',             value: '> Vorhandene Kanäle/Rollen bleiben erhalten\n> Neue Kanäle/Rollen werden hinzugefügt',      inline: false },
    )
    .setFooter({ text: 'Nexus AI Omega v5 • Server Builder 2.0' });

  const modeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('serverbuilder:build_delete').setLabel('🗑️  Alles löschen & neu').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('serverbuilder:build_add')   .setLabel('➕  Nur hinzufügen')    .setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('serverbuilder:cancel')      .setLabel('❌  Abbrechen')          .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [modeEmbed], components: [modeRow] });
}

/** [🗑️ Delete & Build] oder [➕ Add Only] */
export async function handleBuildExecute(interaction: ButtonInteraction, deleteFirst: boolean): Promise<void> {
  await interaction.deferUpdate();

  const userId  = interaction.user.id;
  const guildId = interaction.guildId!;
  const guild   = interaction.guild!;

  const plan = await cacheGet<AIServerPlan>(planKey(userId, guildId));
  if (!plan) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(NexusColors.error).setTitle('❌  Plan abgelaufen')
        .setDescription('> Bitte starte neu mit `/serverbuilder ai`.')], components: [],
    });
    return;
  }

  if (deleteFirst) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(NexusColors.warning)
        .setTitle('🗑️  Lösche vorhandene Inhalte…').setDescription('> Alle Kanäle und Rollen werden entfernt…')], components: [],
    });
    const nonCats = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory);
    const cats    = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
    for (const [, ch]  of nonCats) { await ch.delete('Server Builder v2').catch(() => {}); await new Promise(r => setTimeout(r, 300)); }
    for (const [, cat] of cats)    { await cat.delete('Server Builder v2').catch(() => {}); await new Promise(r => setTimeout(r, 300)); }
    const delRoles = guild.roles.cache.filter(r => !r.managed && r.id !== guild.roles.everyone.id && r.editable);
    for (const [, role] of delRoles) { await role.delete('Server Builder v2').catch(() => {}); await new Promise(r => setTimeout(r, 300)); }
  }

  // Progress-Funktion
  const updateProgress = async (embed: EmbedBuilder) => {
    await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
  };

  // Build starten
  const result = await executeBuild(guild, plan, userId, updateProgress);

  // Abschluss-Embed
  const hasErrors  = result.errors.length > 0;
  const durationSec = (result.durationMs / 1000).toFixed(1);

  const finalEmbed = new EmbedBuilder()
    .setColor(hasErrors ? NexusColors.warning : NexusColors.success)
    .setTitle(hasErrors ? '⚠️  Server gebaut (mit kleinen Problemen)' : '✅  Server erfolgreich gebaut!')
    .setDescription(
      `> **Server:** ${plan.serverName}\n` +
      `> **Theme:** ${plan.theme} • **Style:** ${plan.style}\n` +
      `> **Dauer:** ${durationSec}s`,
    )
    .addFields(
      { name: '🎭 Rollen',     value: `\`${result.rolesCreated}\``,      inline: true },
      { name: '📂 Kategorien', value: `\`${result.categoriesCreated}\``, inline: true },
      { name: '💬 Channels',   value: `\`${result.channelsCreated}\``,   inline: true },
      ...(hasErrors ? [{
        name: `⚠️ Probleme (${result.errors.length})`,
        value: result.errors.slice(0, 5).join('\n').slice(0, 1024),
        inline: false,
      }] : []),
      {
        name:  '💡 Nächste Schritte',
        value:
          '› `/ticketsetup` — Ticket-System einrichten\n' +
          '› `/setwelcome` — Willkommensnachricht\n' +
          '› `/setrules` — Regeln mit KI generieren\n' +
          '› `/setup` — Auto-Setup ausführen',
        inline: false,
      },
    )
    .setFooter({ text: `Nexus AI Omega v5 • Server Builder 2.0 • Seed: ${plan.seed}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [finalEmbed], components: [] });
}

/** [✏️ Edit Prompt] → Öffnet Modal erneut */
export async function handleEditPrompt(interaction: ButtonInteraction): Promise<void> {
  await interaction.showModal(buildServerPromptModal());
}

/** [🔄 Generate Again] → Neu generieren mit gleichem Prompt */
export async function handleRegenerate(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  const userId  = interaction.user.id;
  const guildId = interaction.guildId!;

  const oldPlan = await cacheGet<AIServerPlan>(planKey(userId, guildId));
  if (!oldPlan) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(NexusColors.error)
        .setTitle('❌  Plan nicht gefunden')
        .setDescription('> Bitte starte neu mit `/serverbuilder ai`.')],
      components: [],
    });
    return;
  }

  // Loading
  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(NexusColors.ai)
      .setTitle('🔄  Neuen Plan generieren…')
      .setDescription('> KI generiert eine vollständig neue Version…')],
    components: [],
  });

  // Neu generieren
  let plan = await generateAIServerPlan(
    oldPlan.prompt,
    oldPlan.style,
    '',
    guildId,
    userId,
  );
  const { plan: fixedPlan } = validateAndFixPlan(plan);
  plan = fixedPlan;

  await cacheSet(planKey(userId, guildId), plan, 900);

  const previewEmbeds = buildPreviewEmbeds(plan);
  await interaction.editReply({
    embeds:     previewEmbeds,
    components: [buildPreviewButtons()],
  });
}

/** [❌ Cancel] */
export async function handleCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(NexusColors.dark)
        .setTitle('❌  Abgebrochen')
        .setDescription('> Server-Build wurde abgebrochen. Nichts wurde verändert.'),
    ],
    components: [],
  });
}
