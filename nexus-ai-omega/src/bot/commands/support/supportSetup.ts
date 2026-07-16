/**
 * Nexus AI Omega — Support Warteraum Commands v5.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Commands:
 *   /support-setup    → Warteraum konfigurieren
 *   /support-musik    → Eigene Musik-URL setzen
 *   /support-nachricht → Eigene TTS-Nachricht setzen
 *   /support-info     → Aktuelle Konfiguration anzeigen
 *   /support-test     → TTS & Musik testen
 *   /support-leave    → Bot aus Warteraum kicken
 *
 * Events (aus VoiceStateUpdate):
 *   → User joint Warteraum → Bot joint, TTS, Musik, Team benachrichtigen
 *   → User verlässt → Warteraum leer → Bot verlässt automatisch
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import { dbGet, dbRun } from '../../services/database.js';
import { Embeds, NexusColors } from '../../utils/embeds.js';
import { botLogger } from '../../services/logger.js';
import { joinSupportWaitroom, leaveSupportWaitroom, getSupportVoiceStatus } from '../../services/voice/supportVoice.js';
import type { NexusCommand } from '../events/interactionCreate.js';

// ── Standard TTS-Begrüßungstext ────────────────────────────────────────────────
export const DEFAULT_WELCOME_TEXT =
  'Willkommen im Support! Ich habe alle Team-Mitglieder benachrichtigt. ' +
  'Sie werden so schnell wie möglich kommen und dir helfen. ' +
  'Bitte warte einen kurzen Moment. Danke für deine Geduld!';

// ── Tabellen erstellen ─────────────────────────────────────────────────────────
export async function initSupportTables(): Promise<void> {
  await dbRun(`CREATE TABLE IF NOT EXISTS support_settings (
    guild_id           TEXT PRIMARY KEY,
    wait_channel_id    TEXT,
    support_category_id TEXT,
    notify_channel_id  TEXT,
    admin_role_id      TEXT,
    music_url          TEXT,
    welcome_text       TEXT,
    auto_text_channel  INTEGER DEFAULT 1
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS support_sessions (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id           TEXT,
    user_id            TEXT,
    wait_channel_id    TEXT,
    support_channel_id TEXT,
    text_channel_id    TEXT,
    status             TEXT DEFAULT 'waiting',
    claimed_by         TEXT,
    created_at         INTEGER DEFAULT (strftime('%s','now') * 1000),
    closed_at          INTEGER
  )`);

  // Legacy-Spalten ergänzen (falls Tabelle schon existiert)
  const addCols = [
    `ALTER TABLE support_settings ADD COLUMN welcome_text TEXT`,
    `ALTER TABLE support_settings ADD COLUMN auto_text_channel INTEGER DEFAULT 1`,
    `ALTER TABLE support_sessions ADD COLUMN text_channel_id TEXT`,
    `ALTER TABLE support_sessions ADD COLUMN claimed_by TEXT`,
    `ALTER TABLE support_sessions ADD COLUMN closed_at INTEGER`,
  ];
  for (const sql of addCols) {
    await dbRun(sql).catch(() => {}); // Spalte existiert schon → ignorieren
  }
}

// ══════════════════════════════════════════════════════════════════
// /support-setup
// ══════════════════════════════════════════════════════════════════
export const supportSetupCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('support-setup')
    .setDescription('🎤 Support-Warteraum einrichten')
    .addChannelOption(o =>
      o.setName('warteraum')
        .setDescription('Voice-Kanal der als Warteraum dient')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true),
    )
    .addRoleOption(o =>
      o.setName('team-rolle')
        .setDescription('Team-Rolle die benachrichtigt wird wenn jemand wartet')
        .setRequired(true),
    )
    .addChannelOption(o =>
      o.setName('benachrichtigungs-kanal')
        .setDescription('Text-Kanal für Support-Benachrichtigungen')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addChannelOption(o =>
      o.setName('kategorie')
        .setDescription('Kategorie für private Support-Kanäle (optional)')
        .addChannelTypes(ChannelType.GuildCategory),
    )
    .addBooleanOption(o =>
      o.setName('text-kanal')
        .setDescription('Automatisch Text-Kanal beim Support erstellen? (Standard: Ja)'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await initSupportTables();

    const waitChannel    = interaction.options.getChannel('warteraum', true);
    const teamRole       = interaction.options.getRole('team-rolle', true);
    const notifyChannel  = interaction.options.getChannel('benachrichtigungs-kanal', true);
    const category       = interaction.options.getChannel('kategorie');
    const autoText       = interaction.options.getBoolean('text-kanal') ?? true;

    await dbRun(
      `INSERT INTO support_settings
         (guild_id, wait_channel_id, support_category_id, notify_channel_id, admin_role_id, auto_text_channel)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET
         wait_channel_id     = excluded.wait_channel_id,
         support_category_id = excluded.support_category_id,
         notify_channel_id   = excluded.notify_channel_id,
         admin_role_id       = excluded.admin_role_id,
         auto_text_channel   = excluded.auto_text_channel`,
      interaction.guildId,
      waitChannel.id,
      category?.id ?? null,
      notifyChannel.id,
      teamRole.id,
      autoText ? 1 : 0,
    );

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('✅ Support-Warteraum konfiguriert!')
          .setDescription(
            '> **So funktioniert es:**\n' +
            '> 1️⃣ User betritt den Warteraum\n' +
            '> 2️⃣ Bot joint automatisch\n' +
            '> 3️⃣ KI-Willkommensnachricht per TTS wird abgespielt\n' +
            '> 4️⃣ Hintergrundmusik läuft in Schleife\n' +
            '> 5️⃣ Team wird per Ping benachrichtigt\n' +
            '> 6️⃣ Team-Mitglied klickt "Übernehmen"\n' +
            '> 7️⃣ Privater Voice + Text-Kanal wird erstellt\n' +
            '> 8️⃣ User & Supporter werden automatisch verschoben',
          )
          .addFields(
            { name: '🎤 Warteraum',          value: `${waitChannel}`,                        inline: true },
            { name: '👥 Team-Rolle',          value: `${teamRole}`,                           inline: true },
            { name: '📢 Benachrichtigungen', value: `${notifyChannel}`,                      inline: true },
            { name: '📁 Kategorie',          value: category ? `${category}` : 'Keine',      inline: true },
            { name: '💬 Text-Kanal',         value: autoText ? '✅ Automatisch' : '❌ Nein', inline: true },
            { name: '🗣️ TTS',               value: '✅ Aktiv (Google TTS)',                   inline: true },
            { name: '🎵 Musik',             value: '✅ Standard (änderbar mit /support-musik)', inline: false },
          )
          .addFields({
            name: '💡 Weitere Befehle',
            value:
              '› `/support-musik url:...` — Eigene Musik-URL setzen\n' +
              '› `/support-nachricht text:...` — Eigene TTS-Nachricht\n' +
              '› `/support-info` — Konfiguration anzeigen\n' +
              '› `/support-test` — TTS & Musik testen\n' +
              '› `/support-leave` — Bot aus Warteraum entfernen',
            inline: false,
          })
          .setFooter({ text: 'Nexus AI Omega v5 • Support Voice System' })
          .setTimestamp(),
      ],
    });
  },
};

// ══════════════════════════════════════════════════════════════════
// /support-musik
// ══════════════════════════════════════════════════════════════════
export const supportMusikCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('support-musik')
    .setDescription('🎵 Hintergrundmusik für den Warteraum setzen')
    .addStringOption(o =>
      o.setName('url')
        .setDescription('Direkte MP3-URL (leer = Standard zurücksetzen)')
        .setMaxLength(500),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const settings = await dbGet('SELECT guild_id FROM support_settings WHERE guild_id = ?', interaction.guildId);
    if (!settings) {
      await interaction.reply({ embeds: [Embeds.error('Nicht konfiguriert', 'Bitte zuerst `/support-setup` ausführen.')], ephemeral: true });
      return;
    }

    const url = interaction.options.getString('url');

    await dbRun('UPDATE support_settings SET music_url = ? WHERE guild_id = ?', url ?? null, interaction.guildId);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('🎵 Musik konfiguriert!')
          .addFields(
            { name: '🔗 URL', value: url ?? '`Standard (SoundHelix Tracks)`', inline: false },
            { name: '💡 Tipp', value: '`/support-test` um die Musik direkt zu testen!', inline: false },
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Support Voice' }),
      ],
      ephemeral: true,
    });
  },
};

// ══════════════════════════════════════════════════════════════════
// /support-nachricht
// ══════════════════════════════════════════════════════════════════
export const supportNachrichtCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('support-nachricht')
    .setDescription('🗣️ KI-Willkommens-Nachricht anpassen')
    .addStringOption(o =>
      o.setName('text')
        .setDescription('Text der per TTS gesprochen wird (leer = Standard)')
        .setMaxLength(500),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const settings = await dbGet('SELECT guild_id FROM support_settings WHERE guild_id = ?', interaction.guildId);
    if (!settings) {
      await interaction.reply({ embeds: [Embeds.error('Nicht konfiguriert', 'Bitte zuerst `/support-setup` ausführen.')], ephemeral: true });
      return;
    }

    const text = interaction.options.getString('text');
    const finalText = text ?? DEFAULT_WELCOME_TEXT;

    await dbRun('UPDATE support_settings SET welcome_text = ? WHERE guild_id = ?', finalText, interaction.guildId);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('🗣️ Willkommens-Nachricht gesetzt!')
          .addFields(
            { name: '📝 Text', value: `> ${finalText}`, inline: false },
            { name: '💡 Tipp', value: '`/support-test` um die Nachricht zu testen!', inline: false },
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Support TTS' }),
      ],
      ephemeral: true,
    });
  },
};

// ══════════════════════════════════════════════════════════════════
// /support-info
// ══════════════════════════════════════════════════════════════════
export const supportInfoCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('support-info')
    .setDescription('📊 Support-Warteraum Konfiguration anzeigen')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const settings = await dbGet('SELECT * FROM support_settings WHERE guild_id = ?', interaction.guildId);
    if (!settings) {
      await interaction.reply({ embeds: [Embeds.error('Nicht konfiguriert', 'Bitte `/support-setup` ausführen.')], ephemeral: true });
      return;
    }

    const sessions = await import('../../services/database.js').then(m => m.dbAll(
      'SELECT status, COUNT(*) as c FROM support_sessions WHERE guild_id = ? GROUP BY status',
      interaction.guildId,
    ));

    const sessionMap = Object.fromEntries(sessions.map(s => [String(s['status']), Number(s['c'])]));
    const voiceStatus = getSupportVoiceStatus(interaction.guildId!);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.info)
          .setTitle('⚙️ Support-Warteraum Konfiguration')
          .addFields(
            { name: '🎤 Warteraum',          value: `<#${settings['wait_channel_id']}>`,              inline: true },
            { name: '👥 Team-Rolle',          value: `<@&${settings['admin_role_id']}>`,               inline: true },
            { name: '📢 Benachrichtigungen', value: `<#${settings['notify_channel_id']}>`,            inline: true },
            { name: '📁 Kategorie',          value: settings['support_category_id'] ? `<#${settings['support_category_id']}>` : 'Keine', inline: true },
            { name: '💬 Text-Kanal',         value: settings['auto_text_channel'] ? '✅ Ja' : '❌ Nein', inline: true },
            { name: '🎵 Musik',             value: settings['music_url'] ? `[Link](${settings['music_url']})` : 'Standard', inline: true },
            { name: '🗣️ TTS-Nachricht',     value: `> ${String(settings['welcome_text'] ?? DEFAULT_WELCOME_TEXT).slice(0, 200)}`, inline: false },
            { name: '🔴 Voice Status',       value: voiceStatus.active ? `✅ Aktiv (${voiceStatus.userCount} User)` : '⚫ Inaktiv', inline: true },
            { name: '📊 Sessions',           value:
                `🟡 Wartend: ${sessionMap['waiting'] ?? 0}\n` +
                `🟢 Aktiv: ${sessionMap['active'] ?? 0}\n` +
                `🔴 Geschlossen: ${sessionMap['closed'] ?? 0}`, inline: true },
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Support Voice System' })
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  },
};

// ══════════════════════════════════════════════════════════════════
// /support-test
// ══════════════════════════════════════════════════════════════════
export const supportTestCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('support-test')
    .setDescription('🧪 TTS & Musik im Warteraum testen')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const settings = await dbGet('SELECT * FROM support_settings WHERE guild_id = ?', interaction.guildId);
    if (!settings) {
      await interaction.editReply({ embeds: [Embeds.error('Nicht konfiguriert', 'Bitte `/support-setup` ausführen.')] });
      return;
    }

    // User muss im Voice sein
    const member = interaction.member as import('discord.js').GuildMember;
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      await interaction.editReply({ embeds: [Embeds.warning('Kein Voice-Kanal', 'Du musst in einem Voice-Kanal sein um zu testen!')] });
      return;
    }

    try {
      await joinSupportWaitroom({
        guildId: interaction.guildId!,
        channelId: voiceChannel.id,
        userId: interaction.user.id,
        welcomeText: String(settings['welcome_text'] ?? DEFAULT_WELCOME_TEXT),
        musicUrl: settings['music_url'] ? String(settings['music_url']) : null,
        guild: interaction.guild!,
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.success)
            .setTitle('🧪 Test gestartet!')
            .setDescription(
              `> Bot ist **${voiceChannel}** beigetreten.\n\n` +
              `> **Ablauf:**\n` +
              `> 1️⃣ 2 Sekunden Pause\n` +
              `> 2️⃣ 🗣️ TTS-Willkommensnachricht\n` +
              `> 3️⃣ 🎵 Hintergrundmusik startet\n\n` +
              `> Nutze \`/support-leave\` um den Bot zu beenden.`,
            )
            .setFooter({ text: 'Nexus AI Omega v5 • Support Test' }),
        ],
      });

      // Auto-Leave nach 60 Sekunden (Test-Modus)
      setTimeout(() => leaveSupportWaitroom(interaction.guildId!), 60_000);

    } catch (err) {
      await interaction.editReply({ embeds: [Embeds.error('Test fehlgeschlagen', `${(err as Error).message}`)] });
    }
  },
};

// ══════════════════════════════════════════════════════════════════
// /support-leave
// ══════════════════════════════════════════════════════════════════
export const supportLeaveCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('support-leave')
    .setDescription('🚪 Bot aus Warteraum entfernen')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    leaveSupportWaitroom(interaction.guildId!);
    await interaction.reply({
      embeds: [Embeds.success('Bot verlassen', 'Der Bot hat den Warteraum verlassen.')],
      ephemeral: true,
    });
  },
};

// ══════════════════════════════════════════════════════════════════
// BUTTON HANDLER — Claim / Ignore / Close
// ══════════════════════════════════════════════════════════════════
export async function handleSupportClaim(
  interaction: ButtonInteraction,
  sessionId: string,
  userId: string,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const session = await dbGet('SELECT * FROM support_sessions WHERE id = ?', parseInt(sessionId));
  if (!session || session['status'] !== 'waiting') {
    await interaction.editReply({ embeds: [Embeds.error('Session nicht aktiv', 'Diese Support-Session ist nicht mehr offen.')] });
    return;
  }

  const member = await interaction.guild!.members.fetch(userId).catch(() => null);
  if (!member) {
    await dbRun('UPDATE support_sessions SET status = ? WHERE id = ?', 'left', parseInt(sessionId));
    const leftEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(NexusColors.dark)
      .setTitle('👋 User hat verlassen')
      .setFooter({ text: 'User hat den Warteraum verlassen' });
    await interaction.message.edit({ embeds: [leftEmbed], components: [] }).catch(() => {});
    await interaction.editReply({ content: '⚠️ Der User ist nicht mehr auf dem Server.' });
    return;
  }

  if (!member.voice.channelId) {
    await dbRun('UPDATE support_sessions SET status = ? WHERE id = ?', 'left', parseInt(sessionId));
    const leftEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(NexusColors.dark)
      .setTitle('👋 User hat Warteraum verlassen')
      .setFooter({ text: 'Nicht mehr im Voice-Kanal' });
    await interaction.message.edit({ embeds: [leftEmbed], components: [] }).catch(() => {});
    await interaction.editReply({ content: '⚠️ Der User ist nicht mehr im Warteraum.' });
    return;
  }

  const claimMember = interaction.member as import('discord.js').GuildMember;
  if (!claimMember.voice.channelId) {
    await interaction.editReply({ embeds: [Embeds.error('Kein Voice-Kanal', 'Du musst selbst in einem Voice-Kanal sein!')] });
    return;
  }

  const settings = await dbGet('SELECT * FROM support_settings WHERE guild_id = ?', interaction.guildId);

  try {
    // Privaten Voice-Kanal erstellen
    const supportVoice = await interaction.guild!.channels.create({
      name: `🎫│${member.user.username}-support`,
      type: ChannelType.GuildVoice,
      parent: settings?.['support_category_id'] as string | undefined ?? undefined,
      userLimit: 10,
      permissionOverwrites: [
        { id: interaction.guild!.roles.everyone, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageChannels] },
        ...(settings?.['admin_role_id'] ? [{ id: String(settings['admin_role_id']), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers] }] : []),
      ],
      reason: 'Nexus Support Call',
    });

    // Text-Kanal erstellen (optional)
    let textChannel: import('discord.js').TextChannel | null = null;
    if (settings?.['auto_text_channel']) {
      textChannel = await interaction.guild!.channels.create({
        name: `📝│${member.user.username}-chat`,
        type: ChannelType.GuildText,
        parent: settings?.['support_category_id'] as string | undefined ?? undefined,
        permissionOverwrites: [
          { id: interaction.guild!.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
          ...(settings?.['admin_role_id'] ? [{ id: String(settings['admin_role_id']), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }] : []),
        ],
        reason: 'Nexus Support Call',
      }) as import('discord.js').TextChannel;
    }

    // DB updaten
    await dbRun(
      'UPDATE support_sessions SET status = ?, support_channel_id = ?, text_channel_id = ?, claimed_by = ? WHERE id = ?',
      'active', supportVoice.id, textChannel?.id ?? null, interaction.user.id, parseInt(sessionId),
    );

    // Bot verlässt Warteraum
    leaveSupportWaitroom(interaction.guildId!);

    // User & Supporter verschieben
    const moved = { member: false, claimer: false };
    await member.voice.setChannel(supportVoice).then(() => { moved.member = true; }).catch(() => {});
    await claimMember.voice.setChannel(supportVoice).then(() => { moved.claimer = true; }).catch(() => {});

    // Text-Kanal Begrüßung
    if (textChannel) {
      const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`support:close:${supportVoice.id}:${textChannel.id}`)
          .setLabel('🔒 Support schließen')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`support:transcript:${interaction.guildId}:${parseInt(sessionId)}`)
          .setLabel('📄 Transcript')
          .setStyle(ButtonStyle.Secondary),
      );

      await textChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.success)
            .setTitle('🎫 Support Call gestartet!')
            .setDescription(
              `Hallo ${member}! 👋\n\n` +
              `> **${interaction.user}** übernimmt deinen Support.\n` +
              `> Beschreibe dein Problem gerne hier in diesem Kanal!`,
            )
            .addFields(
              { name: '👤 Mitglied',   value: member.user.tag,           inline: true },
              { name: '🛡️ Supporter', value: interaction.user.tag,       inline: true },
              { name: '⏰ Gestartet', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
            )
            .setFooter({ text: 'Nexus AI Omega v5 • Support System' })
            .setTimestamp(),
        ],
        components: [closeRow],
      });
    }

    // Benachrichtigung updaten
    const successEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(NexusColors.success)
      .setTitle('✅ Support übernommen!')
      .setFooter({ text: `Übernommen von ${interaction.user.tag} • ${new Date().toLocaleTimeString('de-DE')}` });
    await interaction.message.edit({ embeds: [successEmbed], components: [] }).catch(() => {});

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('✅ Support-Call erstellt!')
          .addFields(
            { name: '🎤 Voice-Kanal', value: `${supportVoice}`,                       inline: true },
            { name: '💬 Text-Kanal', value: textChannel ? `${textChannel}` : 'Keiner', inline: true },
            { name: '👤 Mitglied',   value: `${moved.member ? '✅' : '⚠️'} ${member.user.tag}`, inline: true },
            { name: '🛡️ Du',        value: moved.claimer ? '✅ Verschoben' : '⚠️ Manuell joinen', inline: true },
          ),
      ],
    });

    botLogger.info({ guildId: interaction.guildId, sessionId, userId }, '✅ Support-Call gestartet');

  } catch (err) {
    botLogger.error({ err, sessionId }, 'Support-Claim fehlgeschlagen');
    await interaction.editReply({ embeds: [Embeds.error('Fehler', `${(err as Error).message}`)] });
  }
}

// ── Ignore ────────────────────────────────────────────────────────────────────
export async function handleSupportIgnore(
  interaction: ButtonInteraction,
  sessionId: string,
): Promise<void> {
  await dbRun('UPDATE support_sessions SET status = ? WHERE id = ?', 'ignored', parseInt(sessionId));
  const ignoredEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(NexusColors.dark)
    .setTitle('❌ Support-Anfrage ignoriert')
    .setFooter({ text: `Ignoriert von ${interaction.user.tag}` });
  await interaction.update({ embeds: [ignoredEmbed], components: [] });
}

// ── Close ─────────────────────────────────────────────────────────────────────
export async function handleSupportClose(
  interaction: ButtonInteraction,
  voiceChannelId: string,
  textChannelId: string,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const session = await dbGet(
    'SELECT * FROM support_sessions WHERE support_channel_id = ? AND status = ?',
    voiceChannelId, 'active',
  );
  if (session) {
    await dbRun('UPDATE support_sessions SET status = ?, closed_at = ? WHERE id = ?',
      'closed', Date.now(), session['id']);
  }

  const voiceCh = interaction.guild!.channels.cache.get(voiceChannelId);
  if (voiceCh) await voiceCh.delete('Support Call beendet').catch(() => {});

  await interaction.editReply({ content: '✅ Support-Call wird geschlossen…' });

  setTimeout(async () => {
    const textCh = interaction.guild!.channels.cache.get(textChannelId);
    if (textCh) await textCh.delete('Support Call beendet').catch(() => {});
  }, 5000);
}

// ── Transcript ────────────────────────────────────────────────────────────────
export async function handleSupportTranscript(
  interaction: ButtonInteraction,
  _guildId: string,
  sessionId: string,
): Promise<void> {
  const session = await dbGet('SELECT * FROM support_sessions WHERE id = ?', parseInt(sessionId));
  if (!session) {
    await interaction.reply({ embeds: [Embeds.error('Nicht gefunden')], ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(NexusColors.info)
        .setTitle('📄 Support Transcript')
        .addFields(
          { name: '🆔 Session-ID', value: `\`${sessionId}\``,                                 inline: true },
          { name: '👤 User-ID',    value: `\`${session['user_id']}\``,                        inline: true },
          { name: '🛡️ Übernommen', value: session['claimed_by'] ? `<@${session['claimed_by']}>` : 'Niemand', inline: true },
          { name: '⏰ Erstellt',   value: `<t:${Math.floor(Number(session['created_at']) / 1000)}:F>`, inline: true },
          { name: '📊 Status',    value: String(session['status']).toUpperCase(),             inline: true },
        )
        .setFooter({ text: 'Nexus AI Omega v5 • Support System' }),
    ],
    ephemeral: true,
  });
}

export const supportCommands: NexusCommand[] = [
  supportSetupCmd,
  supportMusikCmd,
  supportNachrichtCmd,
  supportInfoCmd,
  supportTestCmd,
  supportLeaveCmd,
];
