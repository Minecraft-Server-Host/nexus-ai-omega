/**
 * Nexus AI Omega — Premium Embed & UI Design System v5.2
 * ═══════════════════════════════════════════════════════
 * Das komplette Discord Design-System für Nexus AI Omega.
 * Jedes Embed, jeder Button, jede Farbe — konsistent und premium.
 */
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ColorResolvable,
  type APIEmbedField,
} from 'discord.js';
import type { ApplicationReview, ServerBuildPlan, TicketPriority } from '../types/index.js';

// ── Brand Colors ──────────────────────────────────────────────────────────────
export const NexusColors = {
  primary:  0x7c3aed as ColorResolvable,   // Nexus Lila
  success:  0x06ffa5 as ColorResolvable,   // Nexus Cyan-Grün
  warning:  0xfbbf24 as ColorResolvable,   // Amber
  error:    0xf43f5e as ColorResolvable,   // Rose Rot
  ai:       0xa855f7 as ColorResolvable,   // AI Violett
  security: 0xdc2626 as ColorResolvable,   // Security Rot
  info:     0x0ea5e9 as ColorResolvable,   // Sky Blau
  dark:     0x0f1117 as ColorResolvable,   // Tief Dunkel
  gold:     0xf59e0b as ColorResolvable,   // Gold (Premium)
  mint:     0x10b981 as ColorResolvable,   // Mint Grün
  cyan:     0x06b6d4 as ColorResolvable,   // Cyan Blau
} as const;

export const PriorityColors: Record<TicketPriority, ColorResolvable> = {
  low:      NexusColors.success,
  medium:   NexusColors.info,
  high:     NexusColors.warning,
  critical: NexusColors.error,
};

// ── Footer & Brand ────────────────────────────────────────────────────────────
const FOOTER      = 'Nexus AI Omega • Premium KI Discord Bot';
const FOOTER_ICON = undefined; // Bot-Icon URL hier eintragen wenn verfügbar

// ── Basis-Embed Fabrik ────────────────────────────────────────────────────────
export function baseEmbed(color: ColorResolvable = NexusColors.primary): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: FOOTER, iconURL: FOOTER_ICON })
    .setTimestamp();
}

// ════════════════════════════════════════════════════════════════════════════
// STATUS EMBEDS
// ════════════════════════════════════════════════════════════════════════════

export const Embeds = {

  success(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder {
    const e = baseEmbed(NexusColors.success)
      .setTitle(`✅  ${title}`);
    if (description) e.setDescription(description);
    if (fields?.length) e.addFields(fields);
    return e;
  },

  error(title: string, description?: string): EmbedBuilder {
    return baseEmbed(NexusColors.error)
      .setTitle(`❌  ${title}`)
      .setDescription(description ?? 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
  },

  warning(title: string, description?: string): EmbedBuilder {
    return baseEmbed(NexusColors.warning)
      .setTitle(`⚠️  ${title}`)
      .setDescription(description ?? '');
  },

  info(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder {
    const e = baseEmbed(NexusColors.info).setTitle(`ℹ️  ${title}`);
    if (description) e.setDescription(description);
    if (fields?.length) e.addFields(fields);
    return e;
  },

  loading(action: string, detail?: string): EmbedBuilder {
    return baseEmbed(NexusColors.primary)
      .setTitle('⏳  Bitte warten…')
      .setDescription(
        `> **${action}**${detail ? `\n> ${detail}` : ''}\n` +
        `> \`🔄 Nexus AI arbeitet…\``,
      );
  },

  ai(
    module: string,
    response: string,
    meta: { provider: string; model: string; latencyMs: number; tokensOut?: number; cached?: boolean },
  ): EmbedBuilder {
    const text = response.length > 4000 ? response.slice(0, 3997) + '…' : response;
    const e = baseEmbed(NexusColors.ai)
      .setTitle(`🤖  Nexus KI — ${module.replace(/_/g, ' ')}`)
      .setDescription(text)
      .addFields(
        { name: '⚡ Provider',  value: `\`${meta.provider}\``,         inline: true },
        { name: '🧠 Modell',   value: `\`${meta.model}\``,            inline: true },
        { name: '⏱️ Latenz',   value: `\`${meta.latencyMs}ms\``,     inline: true },
      );
    if (meta.tokensOut !== undefined)
      e.addFields({ name: '📊 Tokens',  value: `\`${meta.tokensOut}\``,  inline: true });
    if (meta.cached)
      e.addFields({ name: '⚡ Cache',   value: '`HIT`',                  inline: true });
    return e;
  },

  noProvider(): EmbedBuilder {
    return baseEmbed(NexusColors.warning)
      .setTitle('⚠️  Kein KI-Provider konfiguriert')
      .setDescription(
        '> Nexus AI Omega läuft ohne KI-Antworten.\n' +
        '> Füge einen **kostenlosen** API-Key hinzu:\n\n' +
        '**🟢 Groq** (kostenlos, sehr schnell)\n' +
        '> → [console.groq.com/keys](https://console.groq.com/keys)\n' +
        '> → `GROQ_API_KEY=gsk_...` in `.env`\n\n' +
        '**🟢 Google Gemini** (kostenlos bis 60 req/min)\n' +
        '> → [aistudio.google.com/apikey](https://aistudio.google.com/apikey)\n' +
        '> → `GEMINI_API_KEY=AIza...` in `.env`\n\n' +
        '> Nach dem Hinzufügen: `npm run dev` neu starten.',
      );
  },

  security(
    threat: string,
    guildId: string,
    actorId: string,
    actions: string[],
    defcon: number,
  ): EmbedBuilder {
    const defconEmoji = ['', '⚫', '🔴', '🟠', '🟡', '🟢'];
    const defconName  = ['', 'PANIC', 'CRITICAL', 'HIGH', 'ELEVATED', 'NORMAL'];
    return baseEmbed(NexusColors.security)
      .setTitle(`🚨  ZERO-TRUST ALERT — ${threat}`)
      .setDescription(
        `> Ein Sicherheitsereignis wurde erkannt und **automatisch neutralisiert**.\n` +
        `> **DEFCON** ${defconEmoji[defcon] ?? '⚫'} \`${defcon}\` — ${defconName[defcon] ?? 'UNKNOWN'}`,
      )
      .addFields(
        { name: '🏰 Server',   value: `\`${guildId}\``,            inline: true },
        { name: '👤 Akteur',   value: `<@${actorId}>`,              inline: true },
        { name: '⚡ Maßnahmen', value: actions.map(a => `› \`${a}\``).join('\n').slice(0, 1024) || 'Keine', inline: false },
      );
  },
};

// ════════════════════════════════════════════════════════════════════════════
// TICKET SYSTEM EMBEDS
// ════════════════════════════════════════════════════════════════════════════

export function ticketPanelEmbed(
  title    = '🎫  Support Center',
  description = 'Wähle den passenden Ticket-Typ aus dem Menü unten.\nWir helfen dir so schnell wie möglich — KI-Analyse automatisch.',
  color: ColorResolvable = NexusColors.primary,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .addFields(
      { name: '⏱️ Antwortzeit',     value: '> Meist innerhalb **30 Minuten** während der Betriebszeiten.',        inline: true },
      { name: '🔒 Vertraulich',     value: '> Tickets sind **privat** — nur du und das Team sehen sie.',           inline: true },
      { name: '🤖 KI-Unterstützung',value: '> Nexus AI analysiert jede Anfrage für schnellere, bessere Hilfe.',   inline: false },
    )
    .setFooter({ text: `${FOOTER} • Ticket System` });
}

export function ticketButtonRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket:open:bewerbung')    .setLabel('Bewerbung')    .setStyle(ButtonStyle.Primary)  .setEmoji('📋'),
      new ButtonBuilder().setCustomId('ticket:open:support')      .setLabel('Support')      .setStyle(ButtonStyle.Secondary).setEmoji('🛠️'),
      new ButtonBuilder().setCustomId('ticket:open:feedback')     .setLabel('Feedback')     .setStyle(ButtonStyle.Secondary).setEmoji('💡'),
      new ButtonBuilder().setCustomId('ticket:open:bug')          .setLabel('Bug Report')   .setStyle(ButtonStyle.Danger)   .setEmoji('🐞'),
      new ButtonBuilder().setCustomId('ticket:open:sonstiges')    .setLabel('Sonstiges')    .setStyle(ButtonStyle.Secondary).setEmoji('❓'),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket:open:partnerschaft').setLabel('Partnerschaft').setStyle(ButtonStyle.Success).setEmoji('🤝'),
    ),
  ];
}

export function ticketOpenedEmbed(
  type:      string,
  userId:    string,
  ticketId:  string,
  priority:  TicketPriority = 'medium',
  aiSummary?: string,
): EmbedBuilder {
  const pEmoji: Record<TicketPriority, string> = {
    low: '🟢', medium: '🔵', high: '🟡', critical: '🔴',
  };
  const e = new EmbedBuilder()
    .setColor(PriorityColors[priority])
    .setTitle(`🎫  Ticket erstellt — ${type}`)
    .setDescription(
      `Hallo <@${userId}>! Dein Ticket wurde erfolgreich erstellt.\n\n` +
      `> Beschreibe dein Problem hier so detailliert wie möglich.\n` +
      `> Das Team meldet sich so schnell wie möglich bei dir!`,
    )
    .addFields(
      { name: '🎫 Ticket-ID',  value: `\`${ticketId}\``,                                            inline: true },
      { name: '📊 Priorität', value: `${pEmoji[priority]} \`${priority.toUpperCase()}\``,           inline: true },
      { name: '⏰ Erstellt',   value: `<t:${Math.floor(Date.now() / 1000)}:R>`,                     inline: true },
    )
    .setFooter({ text: `${FOOTER} • KI-Ticket System` })
    .setTimestamp();

  if (aiSummary)
    e.addFields({ name: '🤖 KI-Analyse', value: aiSummary.slice(0, 1024), inline: false });

  return e;
}

export function ticketActionRow(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket:claim:${ticketId}`) .setLabel('Annehmen') .setStyle(ButtonStyle.Success).setEmoji('✋'),
    new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`) .setLabel('Schließen').setStyle(ButtonStyle.Danger) .setEmoji('🔒'),
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APPLICATION REVIEW EMBED
// ════════════════════════════════════════════════════════════════════════════

export function applicationReviewEmbed(
  applicantTag: string,
  targetRole:   string,
  review:       ApplicationReview,
): EmbedBuilder {
  const recColors: Record<string, ColorResolvable> = {
    accept:    NexusColors.success,
    consider:  NexusColors.warning,
    reject:    NexusColors.error,
  };
  const recEmoji: Record<string, string> = {
    accept: '✅', consider: '🤔', reject: '❌',
  };

  const bar = (n: number): string =>
    '`' + '█'.repeat(Math.round(n)) + '░'.repeat(10 - Math.round(n)) + ` ${n}/10` + '`';

  const e = new EmbedBuilder()
    .setColor(recColors[review.recommendation] ?? NexusColors.primary)
    .setTitle(`🤖  KI-Bewerbungsanalyse — ${targetRole}`)
    .setDescription(
      `**Bewerber:** ${applicantTag}\n` +
      `**KI-Empfehlung:** ${recEmoji[review.recommendation]} \`${review.recommendation.toUpperCase()}\``,
    )
    .addFields(
      { name: '📝 Grammatik',       value: bar(review.grammar),       inline: false },
      { name: '🎯 Ernsthaftigkeit', value: bar(review.seriousness),   inline: false },
      { name: '📋 Vollständigkeit', value: bar(review.completeness),  inline: false },
      { name: '💼 Erfahrung',       value: bar(review.experience),    inline: false },
      { name: '⭐ Gesamtnote',      value: bar(review.overall),       inline: false },
      { name: '💬 KI-Feedback',     value: review.feedback.slice(0, 1024), inline: false },
    );

  if (review.improvements.length > 0)
    e.addFields({ name: '💡 Verbesserungsvorschläge', value: review.improvements.map(i => `› ${i}`).join('\n').slice(0, 1024), inline: false });

  return e.setFooter({ text: `${FOOTER} • Application Reviewer` }).setTimestamp();
}

// ════════════════════════════════════════════════════════════════════════════
// SERVER BUILDER EMBEDS
// ════════════════════════════════════════════════════════════════════════════

export function serverBuildPreviewEmbed(plan: ServerBuildPlan): EmbedBuilder {
  const channelCount = plan.categories.reduce((s, c) => s + c.channels.length, 0);
  const catPreview   = plan.categories.slice(0, 6).map(c =>
    `> **${c.name}** — ${c.channels.slice(0, 5).map(ch => `#${ch.name}`).join(', ')}${c.channels.length > 5 ? ` +${c.channels.length - 5}` : ''}`,
  ).join('\n');
  const rolePreview  = plan.roles.slice(0, 8).map(r => `> \`${r.name}\``).join('\n');

  return new EmbedBuilder()
    .setColor(parseInt(plan.palette[0]?.replace('#', '') ?? '7c3aed', 16) as ColorResolvable)
    .setTitle(`🏗️  Server Builder — Vorschau`)
    .setDescription(
      `> **Thema:** ${plan.theme}\n` +
      `> **Stil:** ${plan.style}\n` +
      `> **Palette:** ${plan.palette.map(c => `\`${c}\``).join(' ')}`,
    )
    .addFields(
      { name: `📂 Kategorien (${plan.categories.length})`, value: catPreview || 'Keine', inline: false },
      { name: `💬 Channels gesamt`,                        value: `\`${channelCount}\``,  inline: true  },
      { name: `🎭 Rollen (${plan.roles.length})`,         value: rolePreview || 'Keine', inline: false },
      ...(plan.welcomeMessage ? [{ name: '👋 Willkommen', value: `> ${plan.welcomeMessage.slice(0, 200)}`, inline: false }] : []),
    )
    .setFooter({ text: `${FOOTER} • AI Server Builder • Seed: ${plan.seed}` })
    .setTimestamp();
}

export function serverBuildActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('serverbuild:confirm')   .setLabel('Erstellen')      .setStyle(ButtonStyle.Success)  .setEmoji('✅'),
    new ButtonBuilder().setCustomId('serverbuild:edit')      .setLabel('Bearbeiten')     .setStyle(ButtonStyle.Primary)  .setEmoji('✏️'),
    new ButtonBuilder().setCustomId('serverbuild:regenerate').setLabel('Neu generieren') .setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
    new ButtonBuilder().setCustomId('serverbuild:cancel')    .setLabel('Abbrechen')      .setStyle(ButtonStyle.Danger)   .setEmoji('❌'),
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GLOBAL BAN EMBED
// ════════════════════════════════════════════════════════════════════════════

export function globalBanEmbed(
  targetTag:    string,
  targetId:     string,
  avatarUrl:    string | null,
  moderatorTag: string,
  moderatorId:  string,
  reason:       string,
  severity:     number,
  evidence?:    string,
  appealable  = true,
): EmbedBuilder {
  const e = new EmbedBuilder()
    .setColor(NexusColors.error)
    .setTitle('🌐  Global Ban — Nexus AI Omega')
    .setDescription(
      '> Ein globaler Ban wurde erfolgreich durchgesetzt.\n' +
      '> Dieser User ist von **allen** Nexus-Servern ausgeschlossen.',
    )
    .addFields(
      { name: '👤 Gebannter User',   value: `${targetTag}\n\`${targetId}\``,           inline: true  },
      { name: '🛡️ Moderator',        value: `${moderatorTag}\n\`${moderatorId}\``,    inline: true  },
      { name: '⚠️ Schweregrad',      value: `${'🔴'.repeat(severity)}${'⬜'.repeat(5 - severity)} \`${severity}/5\``, inline: true },
      { name: '📝 Begründung',       value: reason,                                    inline: false },
      { name: '📎 Beweise',          value: evidence || '*Keine Beweise angegeben*',  inline: false },
      { name: '🔄 Berufbar',         value: appealable ? '✅ Ja' : '❌ Nein',          inline: true  },
      { name: '🌍 Geltungsbereich',  value: '**Alle Nexus-Server (global)**',          inline: true  },
    )
    .setFooter({ text: `${FOOTER} • Global Security Center` })
    .setTimestamp();

  if (avatarUrl) e.setThumbnail(avatarUrl);
  return e;
}

// ════════════════════════════════════════════════════════════════════════════
// LEVEL EMBED
// ════════════════════════════════════════════════════════════════════════════

export function levelEmbed(
  username:     string,
  avatarUrl:    string | null,
  level:        number,
  xp:           number,
  nextLevelXp:  number,
  rank:         number,
  guildName:    string,
): EmbedBuilder {
  const progress   = nextLevelXp > 0 ? Math.min(100, Math.floor((xp / nextLevelXp) * 100)) : 0;
  const barFilled  = Math.floor(progress / 5);
  const bar        = '▓'.repeat(barFilled) + '░'.repeat(20 - barFilled);

  const e = new EmbedBuilder()
    .setColor(NexusColors.primary)
    .setTitle(`📈  Level-Status — ${username}`)
    .setDescription(`> Server: **${guildName}**`)
    .addFields(
      { name: '🏆 Level',       value: `\`${level}\``,                                                        inline: true },
      { name: '🔢 Rang',        value: `\`#${rank}\``,                                                        inline: true },
      { name: '⭐ XP',          value: `\`${xp.toLocaleString('de-DE')} / ${nextLevelXp.toLocaleString('de-DE')}\``, inline: true },
      { name: '📊 Fortschritt', value: `\`${bar}\` ${progress}%`,                                             inline: false },
    )
    .setFooter({ text: `${FOOTER} • Level System` })
    .setTimestamp();

  if (avatarUrl) e.setThumbnail(avatarUrl);
  return e;
}

// ════════════════════════════════════════════════════════════════════════════
// PING EMBED
// ════════════════════════════════════════════════════════════════════════════

export function pingEmbed(
  wsLatency:   number,
  apiLatency:  number,
  aiProvider:  string,
  guilds:      number,
  uptime:      number,
): EmbedBuilder {
  const ping = (ms: number): string => {
    if (ms < 80)  return `🟢 \`${ms}ms\``;
    if (ms < 200) return `🟡 \`${ms}ms\``;
    return `🔴 \`${ms}ms\``;
  };

  const formatUptime = (s: number): string => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const mem = process.memoryUsage();

  return baseEmbed(NexusColors.info)
    .setTitle('📡  Nexus AI Omega — System Status')
    .addFields(
      { name: '📡 WebSocket',    value: ping(wsLatency),                                               inline: true },
      { name: '⚡ API Latenz',   value: ping(apiLatency),                                              inline: true },
      { name: '🤖 KI Provider',  value: `\`${aiProvider}\``,                                          inline: true },
      { name: '🏰 Server',       value: `\`${guilds.toLocaleString('de-DE')}\``,                      inline: true },
      { name: '⏱️ Uptime',       value: `\`${formatUptime(Math.floor(uptime))}\``,                    inline: true },
      { name: '💾 RAM',          value: `\`${Math.round(mem.rss / 1024 / 1024)} MB\``,               inline: true },
    );
}

// ════════════════════════════════════════════════════════════════════════════
// HELP EMBED — VOLLSTÄNDIG
// ════════════════════════════════════════════════════════════════════════════

export function helpEmbed(category: string): EmbedBuilder {
  const e = baseEmbed();

  switch (category) {
    case 'home':
    default:
      return e.setColor(NexusColors.primary)
        .setTitle('🌐  Nexus AI Omega v5 — Hilfe-Übersicht')
        .setDescription(
          '> Das modernste KI-Discord-System — **75 Commands** · **14 KI-Provider** · **20 Module**.\n' +
          '> Groq ⚡ & Gemini 🟢 kostenlos konfiguriert als Standard-KI.\n' +
          '> Wähle eine Kategorie aus dem Menü unten für Details.',
        )
        .addFields(
          { name: '🤖 KI-System',        value: '`/ai` `/serverbuild`',                                       inline: true },
          { name: '🎵 Musik',             value: '`/play` `/skip` `/queue` `/volume` +9',                      inline: true },
          { name: '🎫 Ticket-System',     value: '`/ticket-setup` `/close` `/claim` +4',                       inline: true },
          { name: '📋 Bewerbungen',       value: '`/bewerbung-setup`',                                         inline: true },
          { name: '🎤 Support-Voice',     value: '`/support-setup` `/support-test` +4',                        inline: true },
          { name: '🛡️ Moderation',        value: '`/ban` `/kick` `/warn` `/timeout` `/defcon` +5',             inline: true },
          { name: '⚙️ Setup & Config',    value: '`/setup` `/autosetup` `/setwelcome` +2',                     inline: true },
          { name: '💰 Economy',           value: '`/balance` `/daily` `/work` `/shop` `/buy` +4',              inline: true },
          { name: '🎮 Fun & Utility',     value: '`/poll` `/giveaway` `/rank` `/remind` `/cmd` +8',            inline: true },
          { name: 'ℹ️ Info-Commands',     value: '`/userinfo` `/serverinfo` `/avatar` `/roleinfo` `/level`',   inline: true },
          { name: '🔑 Admin & Team',      value: '`/clear` `/globalbanuser` `/team`',                          inline: true },
          { name: '🏗️ Server Builder',    value: '`/serverbuild` — KI baut komplette Discord-Server',          inline: true },
          {
            name: '⚡ KI-Status',
            value:
              '> **Groq** (kostenlos) → [console.groq.com/keys](https://console.groq.com/keys) → `GROQ_API_KEY`\n' +
              '> **Gemini** (kostenlos) → [aistudio.google.com](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`',
            inline: false,
          },
        );

    case 'ai':
      return e.setColor(NexusColors.ai)
        .setTitle('🤖  KI-System — Commands & Features')
        .setDescription('> **14 Provider** · **20 Module** · Kontext-Memory · Response-Cache · Prompt-Guard')
        .addFields(
          { name: '`/ai prompt:...`',                  value: '> Stellt der Nexus-KI eine Frage oder gibt ihr eine Aufgabe.\n> Optional: `module:` `provider:` `model:` `ephemeral:`', inline: false },
          { name: '`/ai module:AI_SERVER_BUILDER`',    value: '> KI generiert einen kompletten Server-Plan', inline: true  },
          { name: '`/ai module:HYBRID_AUTOMOD`',       value: '> KI analysiert Text auf Regelverstöße',      inline: true  },
          { name: '`/ai module:AI_CODE_ASSISTANT`',    value: '> KI hilft beim Programmieren',               inline: true  },
          { name: '`/ai module:AI_SECURITY_ADVISOR`',  value: '> KI gibt Sicherheitsempfehlungen',           inline: true  },
          { name: '`/ai module:AI_COMMUNITY_MANAGER`', value: '> KI analysiert Community-Engagement',        inline: true  },
          { name: '`/ai module:AI_EMBED_BUILDER`',     value: '> KI erstellt Embed-Designs',                 inline: true  },
          {
            name: '🔮 14 KI-Provider verfügbar',
            value:
              '`openai` GPT-4o · `anthropic` Claude 3.5\n' +
              '`google` Gemini 1.5 · `groq` Llama 3.3 ⚡\n' +
              '`mistral` · `deepseek` · `xai` Grok\n' +
              '`cohere` · `perplexity` · `openrouter`\n' +
              '`together` · `azure` · `ollama` 🆓 · `auto`',
            inline: false,
          },
          {
            name: '🧠 KI-Features',
            value:
              '› **Kontext-Memory** — 20 Nachrichten pro User gespeichert\n' +
              '› **Response-Cache** — 60s TTL für identische Anfragen\n' +
              '› **Prompt-Guard** — 6 Muster blocken Jailbreaks\n' +
              '› **Auto-Fallback** — nächster Provider bei Ausfall\n' +
              '› **BYO-Key** — eigener API-Key pro Server',
            inline: false,
          },
        );

    case 'tickets':
      return e.setColor(NexusColors.primary)
        .setTitle('🎫  Ticket-System — Commands & Ablauf')
        .setDescription('> **6 Ticket-Typen** mit Discord-Modals · KI-Analyse · Priorität · Rate-Limit')
        .addFields(
          { name: '`/ticket-setup`',  value: '> Panel einrichten\n> `kanal:` `support-rolle:` `kategorie:` `titel:`', inline: false },
          { name: '`/close`',         value: '> Ticket schließen + Transcript + DM an User', inline: true  },
          { name: '`/claim`',         value: '> Ticket als Team-Mitglied übernehmen',        inline: true  },
          { name: '`/unclaim`',       value: '> Ticket wieder freigeben',                    inline: true  },
          { name: '`/add`',           value: '> User zum Ticket-Kanal hinzufügen',           inline: true  },
          { name: '`/remove`',        value: '> User aus Ticket-Kanal entfernen',            inline: true  },
          { name: '`/transcript`',    value: '> Verlauf als .txt Datei exportieren',         inline: true  },
          {
            name: '📋 Ticket-Typen (6)',
            value:
              '📋 **Bewerbung** — KI bewertet 0–10, Quality-Gate\n' +
              '🛠️ **Support** — KI priorisiert + Lösungs-Vorschläge\n' +
              '💡 **Feedback** — Bewertung + Verbesserungsvorschlag\n' +
              '🐞 **Bug Report** — Schritte zum Reproduzieren\n' +
              '🤝 **Partnerschaft** — Server-Info + Angebot\n' +
              '❓ **Sonstiges** — Freie Eingabe',
            inline: false,
          },
          {
            name: '🤖 KI-Funktionen',
            value:
              '› Bewerbungs-Score (Grammar · Ernsthaftigkeit · Vollständigkeit · Erfahrung)\n' +
              '› Quality-Gate: Score < 4 → Verbesserungsvorschläge statt Ticket\n' +
              '› Auto-Priorität: low / medium / high / critical\n' +
              '› Lösungs-Vorschläge bei Support-Tickets\n' +
              '› Rate-Limit: 1 Ticket/Typ/User/24h',
            inline: false,
          },
        );

    case 'support':
      return e.setColor(NexusColors.success)
        .setTitle('🎤  Support-Warteraum — Commands & Ablauf')
        .setDescription('> Voice-Bot · KI-Stimme · Hintergrundmusik · Team-Ping · Privater Call')
        .addFields(
          { name: '`/support-setup`',     value: '> Warteraum einrichten\n> `warteraum:` `team-rolle:` `benachrichtigungs-kanal:` `kategorie:`', inline: false },
          { name: '`/support-musik`',     value: '> Eigene MP3-URL als Hintergrundmusik',       inline: true  },
          { name: '`/support-nachricht`', value: '> Eigenen TTS-Begrüßungstext anpassen',       inline: true  },
          { name: '`/support-info`',      value: '> Konfiguration + aktive Sessions',           inline: true  },
          { name: '`/support-test`',      value: '> TTS & Musik in deinem Voice testen',        inline: true  },
          { name: '`/support-leave`',     value: '> Bot manuell aus Warteraum entfernen',       inline: true  },
          {
            name: '🔄 Automatischer Ablauf',
            value:
              '1️⃣ User betritt Warteraum-Voice\n' +
              '2️⃣ Bot joint automatisch\n' +
              '3️⃣ 🗣️ TTS: *"Willkommen im Support! Ich habe alle Team-Mitglieder benachrichtigt…"*\n' +
              '4️⃣ 🎵 Hintergrundmusik startet (18% Lautstärke, Loop)\n' +
              '5️⃣ Team-Ping mit [✅ Übernehmen] Button\n' +
              '6️⃣ Privater Voice + Text-Kanal wird erstellt\n' +
              '7️⃣ User & Supporter automatisch verschoben\n' +
              '8️⃣ [🔒 Schließen] → Kanäle nach 5s gelöscht',
            inline: false,
          },
        );

    case 'moderation':
      return e.setColor(NexusColors.security)
        .setTitle('🛡️  Moderation — Alle Commands')
        .setDescription('> Zero-Trust AutoMod läuft **immer** im Hintergrund — unter 5ms Reaktionszeit.')
        .addFields(
          { name: '`/ban user:@ reason:...`',       value: '> Permanent-Ban · DM an User · Global-Log',                                                      inline: false },
          { name: '`/kick user:@ grund:...`',        value: '> Kick · DM-Benachrichtigung',                                                                    inline: true  },
          { name: '`/timeout user:@ dauer:...`',    value: '> Timeout 1–40.320 Minuten',                                                                        inline: true  },
          { name: '`/warn user:@ grund:...`',
            value: '> Verwarnung mit Auto-Eskalation:\n> **3. Warn** → Auto-Timeout 10 Min\n> **5. Warn** → Auto-Ban',
            inline: false,
          },
          { name: '`/purge amount:1-100`',          value: '> 1–100 Nachrichten löschen · Optional: `user:@`',     inline: true  },
          { name: '`/defcon level:1-5`',             value: '> DEFCON setzen (Redis-persistent)',                    inline: true  },
          { name: '`/warnings user:@`',              value: '> Alle Verwarnungen anzeigen',                         inline: true  },
          { name: '`/clearwarnings user:@`',         value: '> Alle Verwarnungen löschen',                          inline: true  },
          { name: '`/lock` / `/unlock`',             value: '> Kanal für @everyone sperren / entsperren',           inline: true  },
          { name: '`/slowmode sekunden:0-21600`',    value: '> Slowmode setzen (0 = aus)',                           inline: true  },
          {
            name: '🤖 Zero-Trust AutoMod',
            value:
              '› **Anti-Nuke** < 5ms · 9 Velocity-Typen\n' +
              '› **Anti-Raid** — 15 Joins/5s → Lockdown\n' +
              '› **Token-Scanner** — Discord/OpenAI/Anthropic/Google/GitHub\n' +
              '› **Phishing** — 22+ Domains blockiert\n' +
              '› **Wortfilter** — via `/automod`',
            inline: false,
          },
          {
            name: '🛡️ DEFCON-Stufen',
            value:
              '`5` 🟢 NORMAL · `4` 🟡 ELEVATED · `3` 🟠 HIGH\n' +
              '`2` 🔴 CRITICAL · `1` ⚫ PANIC',
            inline: false,
          },
        );

    case 'setup':
      return e.setColor(NexusColors.info)
        .setTitle('⚙️  Setup & Konfiguration')
        .setDescription('> Auto-Setup erkennt Kanäle anhand von **150+ Namens-Mustern** automatisch.')
        .addFields(
          { name: '`/setup`',            value: '> Vollständiges Auto-Setup auf einmal',                                                               inline: false },
          { name: '`/autosetup`',        value: '> 11 Einzelaktionen: Regeln · Welcome · Logs · Verify · Rollen · Ankündigungen · Vorschläge · Reset', inline: false },
          { name: '`/setwelcome`',       value: '> Welcome-Kanal + KI-Nachricht\n> Platzhalter: `{user}` `{server}` `{count}`',                       inline: false },
          { name: '`/setrules`',         value: '> Regeln-Kanal + KI generiert Regeln\n> Stile: gaming · professional · casual · technical',          inline: false },
          { name: '`/setlogs`',          value: '> Log-Kanal + Event-Filter\n> Alles · Nur Moderation · Nur Security · Mitglieder · Nachrichten',     inline: false },
          { name: '`/verify-setup`',     value: '> Verifizierungs-Button → Member-Rolle automatisch',                                                 inline: false },
          { name: '🔍 Kanal-Erkennung',
            value:
              '**Rules:** `rules` · `regeln` · `server-rules` · `📋rules` …\n' +
              '**Welcome:** `welcome` · `willkommen` · `👋welcome` …\n' +
              '**Logs:** `logs` · `audit-log` · `mod-log` · `📊logs` …',
            inline: false,
          },
        );

    case 'economy':
      return e.setColor(NexusColors.gold)
        .setTitle('💰  Economy-System — Alle Commands')
        .setDescription('> Server-Währung mit Shop, Inventar und täglichen Belohnungen.')
        .addFields(
          { name: '`/balance`',          value: '> Guthaben anzeigen (Portemonnaie + Bank)',                    inline: true  },
          { name: '`/daily`',            value: '> Tägliche Belohnung (500–1000 Coins, 24h)',                   inline: true  },
          { name: '`/work`',             value: '> Arbeiten für Coins (100–300, 1h)',                            inline: true  },
          { name: '`/pay user:@ betrag`',value: '> Coins überweisen',                                           inline: true  },
          { name: '`/shop`',             value: '> Server-Shop anzeigen',                                       inline: true  },
          { name: '`/buy artikel:...`',  value: '> Artikel kaufen (gibt Rolle)',                                 inline: true  },
          { name: '`/sell artikel:...`', value: '> Artikel für 50% verkaufen',                                  inline: true  },
          { name: '`/inventory`',        value: '> Dein Inventar anzeigen',                                     inline: true  },
          { name: '`/additem` *(Admin)*', value: '> Artikel zum Shop hinzufügen\n> `name:` `preis:` `rolle:`', inline: false },
        );

    case 'fun':
      return e.setColor(NexusColors.mint)
        .setTitle('🎮  Fun & Utility — Alle Commands')
        .setDescription('> Leveling · Giveaways · Umfragen · Erinnerungen · Custom Commands')
        .addFields(
          { name: '📈 Leveling', value: '\u200b', inline: false },
          { name: '`/rank`',         value: '> Level & XP-Fortschritt', inline: true },
          { name: '`/leaderboard`',  value: '> Top 10 Rangliste',        inline: true },
          { name: '`/setxp`',        value: '> XP setzen (Admin)',        inline: true },
          { name: '`/levelrole`',    value: '> Rolle bei Level X (Admin)',inline: true },
          { name: '🎉 Events & Fun', value: '\u200b', inline: false },
          { name: '`/poll`',         value: '> Abstimmung (bis 4 Optionen)',                        inline: true },
          { name: '`/giveaway`',     value: '> Giveaway starten (`dauer:10m` `gewinner:2`)',        inline: true },
          { name: '`/remind`',       value: '> Erinnerung setzen (`dauer:30m`)',                    inline: true },
          { name: '⌨️ Custom Commands', value: '\u200b', inline: false },
          { name: '`/cmd Erstellen`',value: '> Eigenen Command erstellen (max 50/Server)',           inline: true },
          { name: '`/cmd Benutzen`', value: '> Custom Command ausführen',                            inline: true },
          { name: '`/cmd Liste`',    value: '> Alle Custom Commands anzeigen',                       inline: true },
          { name: '💡 XP-System',
            value: '› **15 XP** pro Nachricht · **60s** Cooldown\n› Level-Up Benachrichtigung\n› Rollen automatisch vergeben (`/levelrole`)',
            inline: false,
          },
        );

    case 'info':
      return e.setColor(NexusColors.info)
        .setTitle('ℹ️  Info-Commands')
        .addFields(
          { name: '`/ping`',        value: '> Latenz · API-Status · KI-Provider · Uptime · RAM',    inline: false },
          { name: '`/userinfo`',    value: '> User: ID · Badges · Alter · Rollen · Beitrittsdatum', inline: false },
          { name: '`/serverinfo`',  value: '> Server: Owner · Mitglieder · Kanäle · Boosts · Emojis', inline: false },
          { name: '`/roleinfo`',    value: '> Rolle: Farbe · Mitglieder · Position · Berechtigungen', inline: false },
          { name: '`/avatar`',      value: '> Profilbild in 4096px (global + server-spezifisch)',   inline: false },
          { name: '`/level`',       value: '> Level · XP · Fortschrittsbalken · Rang',              inline: false },
          { name: '`/suggest`',     value: '> Vorschlag einreichen → 👍/👎 Voting → Thread',         inline: false },
        );

    case 'admin':
      return e.setColor(NexusColors.error)
        .setTitle('🔑  Admin & Team — Commands')
        .setDescription('> Diese Commands erfordern besondere Berechtigungen.')
        .addFields(
          {
            name: '🗑️ `/clear`  *(Server-Owner ODER Nexus-Team)*',
            value:
              '> Löscht Kanäle · Kategorien · Voice-Chats und/oder Rollen\n' +
              '> **5 Sicherheitsstufen:** Prüfung → Bestätigung → 30s Timeout → 5s Countdown → Löschung\n' +
              '> Scopes: `Alles` · `Nur Kanäle` · `Nur Rollen`',
            inline: false,
          },
          { name: '🌐 `/globalbanuser` *(Nexus-Team)*',  value: '> Globaler Ban über alle Nexus-Server', inline: true  },
          { name: '🔓 `/globalunbanuser`',               value: '> Globalen Ban aufheben',              inline: true  },
          { name: '🔍 `/globaluserinfo`',                value: '> Globale User-Info & Ban-History',    inline: true  },
          { name: '📋 `/globalblacklist`',               value: '> Globale Blacklist verwalten',        inline: true  },
          { name: '👥 `/team info`',                     value: '> Eigene Team-Info & Rang',            inline: true  },
          { name: '📋 `/team list`',                     value: '> Alle Nexus-Team-Mitglieder',         inline: true  },
          {
            name: '🏅 Team-Ränge (8)',
            value:
              '`👑 Owner` > `💎 Co-Owner` > `🛡 Manager` > `⚙️ Developer`\n' +
              '`🤖 AI Manager` > `🛡️ Moderator` > `🎫 Support` > `👥 Team`',
            inline: false,
          },
        );

    case 'musik':
      return e.setColor(0xff0000) // YouTube Rot
        .setTitle('🎵  Musik-System — Alle Commands')
        .setDescription('> YouTube · Spotify-Links → YouTube · Direkte Suche · Warteschlange · DSP-Filter')
        .addFields(
          { name: '`/play song:...`',
            value:
              '> Song abspielen · Unterstützte Formate:\n' +
              '> 🔴 YouTube URL · 🔗 YouTube Playlist\n' +
              '> 🟢 Spotify Song-Link (→ automatisch YouTube)\n' +
              '> 🔍 Suchbegriff (z.B. `"Bohemian Rhapsody Queen"`)',
            inline: false,
          },
          { name: '`/skip anzahl:1`',       value: '> Song(s) überspringen',              inline: true  },
          { name: '`/stop`',                 value: '> Musik stoppen + Kanal verlassen',   inline: true  },
          { name: '`/pause`',               value: '> Musik pausieren',                   inline: true  },
          { name: '`/resume`',              value: '> Fortsetzen',                        inline: true  },
          { name: '`/queue seite:1`',       value: '> Warteschlange anzeigen',            inline: true  },
          { name: '`/nowplaying`',          value: '> Aktuellen Song + Fortschritt',      inline: true  },
          { name: '`/volume lautstärke:80`',value: '> Lautstärke 0–200%',                inline: true  },
          { name: '`/loop modus:...`',      value: '> Loop: keiner / Song / Warteschlange', inline: true },
          { name: '`/shuffle`',             value: '> Warteschlange mischen',             inline: true  },
          { name: '`/remove position:2`',   value: '> Song aus Schlange entfernen',       inline: true  },
          { name: '`/clearqueue`',          value: '> Warteschlange leeren',              inline: true  },
          { name: '`/lyrics song:...`',     value: '> Songtext anzeigen (KI-gestützt)',   inline: false },
          { name: '🎮 Musik-Buttons',
            value:
              '> Jeder `/play` zeigt Control-Buttons:\n' +
              '> ⏸️ Pause · ⏭️ Skip · ⏹️ Stop · 📋 Queue · 🔀 Shuffle',
            inline: false,
          },
          { name: '💡 Tipps',
            value:
              '› Spotify-Links: `https://open.spotify.com/track/...`\n' +
              '› YouTube Playlists bis 50 Songs werden geladen\n' +
              '› Für bessere Qualität: `YOUTUBE_COOKIE` in `.env` setzen\n' +
              '› Lautstärke > 100% = verstärkt (kann verzerren)',
            inline: false,
          },
        );

    case 'builder':
      return e.setColor(NexusColors.primary)
        .setTitle('🏗️  AI Server Builder')
        .setDescription('> KI generiert einen **vollständigen, einzigartigen** Discord-Server aus deiner Idee.')
        .addFields(
          { name: '`/serverbuild theme:... style:...`',
            value:
              '> **Beispiele:**\n' +
              '> `"Valorant Esports 5000 Spieler"` · `"Anime Community deutsch"`\n' +
              '> **Stile:** Auto · Gaming · Esports · Anime · Modern · Dark · Cyber · Luxury · Business · Futuristic',
            inline: false,
          },
          { name: '🔄 Ablauf',
            value:
              '1️⃣ KI generiert einzigartigen Plan (Hash-Seed)\n' +
              '2️⃣ Preview-Embed: Kategorien · Kanäle · Rollen · Palette\n' +
              '3️⃣ [✅ Erstellen] → Lösch-Abfrage mit vollständiger Übersicht\n' +
              '4️⃣ Wahl: [🗑️ Alles löschen] [➕ Hinzufügen] [❌ Abbrechen]\n' +
              '5️⃣ Live-Fortschritts-Embed\n' +
              '6️⃣ Abschlussbericht',
            inline: false,
          },
          { name: '📊 Generiert wird',
            value:
              '📂 Kategorien · 💬 Text-Kanäle · 🎙️ Voice · 💭 Forum\n' +
              '🎭 Rollen mit Farben · 👋 Willkommen · 🎨 Farbpalette',
            inline: false,
          },
        );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// GLOBAL LOG EMBED
// ════════════════════════════════════════════════════════════════════════════

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
  metadata?: Record<string, unknown>;
  color?: ColorResolvable;
}

export function buildGlobalLogEmbed(p: GlobalLogPayload): EmbedBuilder {
  const e = new EmbedBuilder()
    .setTitle(p.eventTitle.slice(0, 256))
    .setColor(p.color ?? NexusColors.primary)
    .setTimestamp(p.timestamp ?? new Date())
    .setFooter({ text: `${FOOTER} • Global Control Center` });

  const fields: APIEmbedField[] = [];
  if (p.guildName)    fields.push({ name: '🏰 Server',    value: `${p.guildName}\n\`${p.guildId}\``,           inline: true });
  if (p.user?.tag)    fields.push({ name: '👤 User',       value: `${p.user.tag}\n\`${p.user.id}\``,            inline: true });
  if (p.moderator?.tag) fields.push({ name: '🛡️ Moderator', value: `${p.moderator.tag}\n\`${p.moderator.id}\``, inline: true });
  if (p.channel?.name)  fields.push({ name: '💬 Channel',  value: `#${p.channel.name}\n\`${p.channel.id}\``,   inline: true });
  if (p.action)       fields.push({ name: '⚡ Aktion',     value: p.action.slice(0, 1024),                      inline: false });
  if (p.command)      fields.push({ name: '⌨️ Befehl',     value: `\`/${p.command}\``,                          inline: true });
  if (p.result)       fields.push({ name: '📊 Ergebnis',   value: p.result.slice(0, 1024),                      inline: false });
  if (p.reason)       fields.push({ name: '📝 Begründung', value: p.reason.slice(0, 1024),                      inline: false });
  if (p.metadata) {
    const meta = Object.entries(p.metadata)
      .map(([k, v]) => `**${k}:** ${typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : String(v)}`)
      .join('\n').slice(0, 1024);
    if (meta) fields.push({ name: '🔎 Details', value: meta, inline: false });
  }
  if (fields.length) e.addFields(fields.slice(0, 25));
  if (p.user?.avatar) e.setThumbnail(p.user.avatar);
  return e;
}

export function colorForEvent(eventType: string): ColorResolvable {
  const t = eventType.toLowerCase();
  if (t.includes('ban') || t.includes('error') || t.includes('nuke') || t.includes('emergency')) return NexusColors.error;
  if (t.includes('warn') || t.includes('timeout') || t.includes('kick'))  return NexusColors.warning;
  if (t.includes('ai'))      return NexusColors.ai;
  if (t.includes('security') || t.includes('raid') || t.includes('phish')) return NexusColors.security;
  if (t.includes('success') || t.includes('join') || t.includes('unban'))  return NexusColors.success;
  return NexusColors.info;
}

// Re-export FOOTER for external use
export { FOOTER };
