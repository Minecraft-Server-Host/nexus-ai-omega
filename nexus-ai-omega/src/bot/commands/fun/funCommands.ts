/**
 * Nexus AI Omega — Fun & Utility Commands v5.0
 * Übernommen & upgraded von discord-bot-source
 * /poll /giveaway /remind /rank /leaderboard /setxp /levelrole /lock /unlock /slowmode /warnings /clearwarnings /cmd
 */
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { dbGet, dbRun, dbAll, getGuildSettings } from '../../services/database.js';
import { Embeds, NexusColors } from '../../utils/embeds.js';
import { statsAggregator } from '../../global/statisticsAggregator.js';
import type { NexusCommand } from '../events/interactionCreate.js';

// ── Duration-Parser ───────────────────────────────────────────────────────────
function parseDuration(str: string): number | null {
  const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  return parseInt(match[1]) * units[match[2]];
}

// ── Level-Formel ──────────────────────────────────────────────────────────────
function getLevelFromXp(xp: number): number { return Math.floor(0.1 * Math.sqrt(xp)); }
function getXpForLevel(level: number): number { return Math.pow(level / 0.1, 2); }

// ── /rank ─────────────────────────────────────────────────────────────────────
export const rankCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('rank').setDescription('⭐ Deinen Rang anzeigen')
    .addUserOption(o => o.setName('benutzer').setDescription('Anderer Benutzer')),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const target = i.options.getUser('benutzer') ?? i.user;
    const data = await dbGet('SELECT * FROM levels WHERE guild_id = ? AND user_id = ?', i.guildId, target.id);
    if (!data) return i.reply({ content: `${target.username} hat noch keine XP gesammelt.`, ephemeral: true });
    const level = getLevelFromXp(Number(data['xp']));
    const curLvlXp = getXpForLevel(level), nextLvlXp = getXpForLevel(level + 1);
    const progress = Math.floor(((Number(data['xp']) - curLvlXp) / (nextLvlXp - curLvlXp)) * 20);
    const bar = '█'.repeat(Math.max(0, progress)) + '░'.repeat(Math.max(0, 20 - progress));
    const rankPos = await dbGet('SELECT COUNT(*) as r FROM levels WHERE guild_id = ? AND xp > ?', i.guildId, data['xp']) as { r: number } | null;
    await i.reply({ embeds: [new EmbedBuilder().setColor(NexusColors.primary).setTitle(`⭐ Rang von ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Level',    value: `**${level}**`,              inline: true },
        { name: 'Rang',     value: `**#${(rankPos?.r ?? 0) + 1}**`, inline: true },
        { name: 'XP',       value: `**${Number(data['xp']).toLocaleString('de-DE')}**`, inline: true },
        { name: 'Fortschritt', value: `\`[${bar}]\`\n${Math.floor(Number(data['xp']) - curLvlXp)} / ${Math.floor(nextLvlXp - curLvlXp)} XP` },
        { name: 'Nachrichten', value: `**${Number(data['messages']).toLocaleString('de-DE')}**`, inline: true },
      )] });
  },
};

// ── /leaderboard ──────────────────────────────────────────────────────────────
export const leaderboardCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 XP-Rangliste anzeigen'),
  cooldown: 10,
  async execute(i: ChatInputCommandInteraction) {
    await i.deferReply();
    const top = await dbAll('SELECT * FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10', i.guildId);
    if (!top.length) return i.editReply({ content: '📊 Noch keine Daten vorhanden.' });
    const lines = await Promise.all(top.map(async (row, idx) => {
      const user = await i.client.users.fetch(String(row['user_id'])).catch(() => null);
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**${idx + 1}.**`;
      return `${medal} ${user?.username ?? 'Unbekannt'} — Level ${getLevelFromXp(Number(row['xp']))} | ${Number(row['xp']).toLocaleString('de-DE')} XP`;
    }));
    await i.editReply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 XP Rangliste').setDescription(lines.join('\n')).setTimestamp()] });
  },
};

// ── /setxp ────────────────────────────────────────────────────────────────────
export const setxpCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('setxp').setDescription('⚙️ XP setzen (Admin)')
    .addUserOption(o => o.setName('benutzer').setDescription('Benutzer').setRequired(true))
    .addIntegerOption(o => o.setName('xp').setDescription('XP-Menge').setRequired(true).setMinValue(0))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const target = i.options.getUser('benutzer', true);
    const xp = i.options.getInteger('xp', true);
    await dbRun('INSERT INTO levels (guild_id, user_id, xp, level, messages) VALUES (?, ?, ?, 0, 0) ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = ?', i.guildId, target.id, xp, xp);
    await i.reply({ content: `✅ XP von ${target.username} auf **${xp.toLocaleString('de-DE')}** gesetzt.`, ephemeral: true });
  },
};

// ── /levelrole ────────────────────────────────────────────────────────────────
export const levelroleCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('levelrole').setDescription('🎭 Rolle mit Level verknüpfen (Admin)')
    .addIntegerOption(o => o.setName('level').setDescription('Level').setRequired(true).setMinValue(1))
    .addRoleOption(o => o.setName('rolle').setDescription('Rolle').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const level = i.options.getInteger('level', true);
    const role = i.options.getRole('rolle', true);
    const settings = await dbGet('SELECT level_roles FROM guild_settings WHERE guild_id = ?', i.guildId);
    const roles = JSON.parse(String(settings?.['level_roles'] ?? '{}')) as Record<string, string>;
    roles[level] = role.id;
    await dbRun('INSERT INTO guild_settings (guild_id, level_roles) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET level_roles = ?', i.guildId, JSON.stringify(roles), JSON.stringify(roles));
    await i.reply({ content: `✅ ${role} wird bei Level **${level}** vergeben.`, ephemeral: true });
  },
};

// ── /warnings ─────────────────────────────────────────────────────────────────
export const warningsCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('warnings').setDescription('⚠️ Verwarnungen anzeigen')
    .addUserOption(o => o.setName('benutzer').setDescription('Benutzer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const target = i.options.getUser('benutzer', true);
    const warns = await dbAll('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC', i.guildId, target.id);
    if (!warns.length) return i.reply({ content: `✅ Keine Verwarnungen für ${target.username}.`, ephemeral: true });
    await i.reply({ embeds: [new EmbedBuilder().setColor(NexusColors.warning).setTitle(`⚠️ Verwarnungen — ${target.username}`)
      .setDescription(warns.map((w, idx) => `**#${idx + 1}** <t:${Math.floor(Number(w['timestamp']) / 1000)}:R>\n> ${w['reason'] ?? 'Kein Grund'}`).join('\n\n').slice(0, 4096))] });
  },
};

// ── /clearwarnings ────────────────────────────────────────────────────────────
export const clearwarningsCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('clearwarnings').setDescription('🗑️ Verwarnungen löschen')
    .addUserOption(o => o.setName('benutzer').setDescription('Benutzer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const target = i.options.getUser('benutzer', true);
    await dbRun('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?', i.guildId, target.id);
    await i.reply({ embeds: [Embeds.success('Verwarnungen gelöscht', `Alle Verwarnungen von **${target.username}** wurden gelöscht.`)] });
  },
};

// ── /lock ─────────────────────────────────────────────────────────────────────
export const lockCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('lock').setDescription('🔒 Kanal sperren')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    await i.channel!.permissionOverwrites.edit(i.guild!.roles.everyone, { SendMessages: false });
    await i.reply({ embeds: [new EmbedBuilder().setColor(NexusColors.error).setTitle('🔒 Kanal gesperrt').setDescription('> Niemand kann jetzt mehr in diesem Kanal schreiben.')] });
  },
};

// ── /unlock ───────────────────────────────────────────────────────────────────
export const unlockCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('unlock').setDescription('🔓 Kanal entsperren')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    await i.channel!.permissionOverwrites.edit(i.guild!.roles.everyone, { SendMessages: null });
    await i.reply({ embeds: [new EmbedBuilder().setColor(NexusColors.success).setTitle('🔓 Kanal entsperrt').setDescription('> Alle können wieder schreiben.')] });
  },
};

// ── /slowmode ─────────────────────────────────────────────────────────────────
export const slowmodeCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('slowmode').setDescription('⏱️ Slowmode setzen')
    .addIntegerOption(o => o.setName('sekunden').setDescription('0 = deaktiviert').setRequired(true).setMinValue(0).setMaxValue(21600))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const s = i.options.getInteger('sekunden', true);
    await (i.channel as import('discord.js').TextChannel).setRateLimitPerUser(s);
    await i.reply({ embeds: [new EmbedBuilder().setColor(NexusColors.info).setTitle('⏱️ Slowmode').setDescription(s === 0 ? 'Deaktiviert.' : `Auf **${s}s** gesetzt.`)] });
  },
};

// ── /poll ─────────────────────────────────────────────────────────────────────
export const pollCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('poll').setDescription('📊 Umfrage erstellen')
    .addStringOption(o => o.setName('frage').setDescription('Die Frage').setRequired(true).setMaxLength(200))
    .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true).setMaxLength(80))
    .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true).setMaxLength(80))
    .addStringOption(o => o.setName('option3').setDescription('Option 3 (optional)').setMaxLength(80))
    .addStringOption(o => o.setName('option4').setDescription('Option 4 (optional)').setMaxLength(80)),
  cooldown: 10,
  async execute(i: ChatInputCommandInteraction) {
    const frage = i.options.getString('frage', true);
    const options = [1, 2, 3, 4].map(n => i.options.getString(`option${n}`)).filter(Boolean) as string[];
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    const msg = await i.reply({
      embeds: [new EmbedBuilder().setColor(NexusColors.primary)
        .setTitle(`📊 ${frage}`)
        .setDescription(options.map((o, idx) => `${emojis[idx]} **${o}**`).join('\n\n'))
        .setFooter({ text: `Umfrage von ${i.user.tag}` })
        .setTimestamp()],
      fetchReply: true,
    });
    for (let idx = 0; idx < options.length; idx++) await msg.react(emojis[idx]);
  },
};

// ── /giveaway ─────────────────────────────────────────────────────────────────
export const giveawayCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('giveaway').setDescription('🎉 Giveaway starten')
    .addStringOption(o => o.setName('preis').setDescription('Was wird verlost?').setRequired(true).setMaxLength(200))
    .addStringOption(o => o.setName('dauer').setDescription('Dauer (z.B. 10m, 1h, 1d)').setRequired(true))
    .addIntegerOption(o => o.setName('gewinner').setDescription('Anzahl Gewinner').setMinValue(1).setMaxValue(10))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 10,
  async execute(i: ChatInputCommandInteraction) {
    const prize   = i.options.getString('preis', true);
    const durStr  = i.options.getString('dauer', true);
    const winners = i.options.getInteger('gewinner') ?? 1;
    const dur     = parseDuration(durStr);
    if (!dur) return i.reply({ content: '❌ Ungültige Dauer! Beispiele: `10m`, `1h`, `1d`', ephemeral: true });

    const endTime = Date.now() + dur;
    const msg = await i.reply({
      embeds: [new EmbedBuilder().setColor(0xFF8C00)
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription(`**${prize}**\n\nReagiere mit 🎉 um teilzunehmen!`)
        .addFields(
          { name: '⏰ Endet', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
          { name: '🏆 Gewinner', value: `${winners}`, inline: true },
          { name: '👤 Veranstalter', value: `${i.user}`, inline: true },
        )
        .setTimestamp(endTime)],
      fetchReply: true,
    });

    await msg.react('🎉');
    await dbRun('INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winners, end_time, host_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      i.guildId, i.channelId, msg.id, prize, winners, endTime, i.user.id);

    setTimeout(async () => {
      const fresh = await i.channel!.messages.fetch(msg.id).catch(() => null);
      if (!fresh) return;
      const reaction = fresh.reactions.cache.get('🎉');
      const users = await reaction?.users.fetch();
      const eligible = [...(users?.values() ?? [])].filter(u => !u.bot);
      if (!eligible.length) {
        await i.channel!.send({ embeds: [new EmbedBuilder().setColor(NexusColors.error).setTitle('🎉 Giveaway beendet').setDescription('Niemand hat teilgenommen! 😢')] });
        return;
      }
      const selected: typeof eligible = [];
      const pool = [...eligible];
      for (let idx = 0; idx < Math.min(winners, pool.length); idx++) {
        selected.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      await i.channel!.send({
        embeds: [new EmbedBuilder().setColor(0xFF8C00)
          .setTitle('🎉 Giveaway beendet!')
          .setDescription(`**Preis:** ${prize}\n**Gewinner:** ${selected.map(u => u.toString()).join(', ')}\n\nGlückwunsch! 🎊`)],
      });
    }, dur);
  },
};

// ── /remind ───────────────────────────────────────────────────────────────────
export const remindCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('remind').setDescription('⏰ Erinnerung setzen')
    .addStringOption(o => o.setName('dauer').setDescription('In wann? (z.B. 10m, 2h)').setRequired(true))
    .addStringOption(o => o.setName('nachricht').setDescription('Woran erinnern?').setRequired(true).setMaxLength(300)),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const durStr  = i.options.getString('dauer', true);
    const message = i.options.getString('nachricht', true);
    const dur     = parseDuration(durStr);
    if (!dur) return i.reply({ content: '❌ Ungültige Dauer! Beispiele: `10m`, `2h`, `1d`', ephemeral: true });
    const remindAt = Date.now() + dur;
    await dbRun('INSERT INTO reminders (user_id, channel_id, message, remind_at) VALUES (?, ?, ?, ?)', i.user.id, i.channelId, message, remindAt);
    await i.reply({
      embeds: [new EmbedBuilder().setColor(NexusColors.info).setTitle('⏰ Erinnerung gesetzt')
        .setDescription(`Ich erinnere dich <t:${Math.floor(remindAt / 1000)}:R> an:\n**${message}**`)],
      ephemeral: true,
    });
  },
};

// ── /cmd (Custom Commands) ────────────────────────────────────────────────────
export const cmdCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('cmd').setDescription('⌨️ Custom Commands verwalten')
    .addStringOption(o => o.setName('aktion').setDescription('Aktion').setRequired(true)
      .addChoices(
        { name: '➕ Erstellen', value: 'create' },
        { name: '🗑️ Löschen',   value: 'delete' },
        { name: '📋 Liste',     value: 'list' },
        { name: '▶️ Benutzen',  value: 'use' },
      ))
    .addStringOption(o => o.setName('name').setDescription('Command-Name').setMaxLength(20))
    .addStringOption(o => o.setName('antwort').setDescription('Antwort des Commands').setMaxLength(1000)),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const aktion  = i.options.getString('aktion', true);
    const name    = i.options.getString('name')?.toLowerCase();
    const antwort = i.options.getString('antwort');

    if (aktion === 'create') {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return i.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });
      if (!name || !antwort) return i.reply({ content: '❌ Bitte Name und Antwort angeben.', ephemeral: true });
      const count = await dbGet('SELECT COUNT(*) as c FROM custom_commands WHERE guild_id = ?', i.guildId) as { c: number } | null;
      if ((count?.c ?? 0) >= 50) return i.reply({ content: '❌ Maximum 50 Custom Commands erlaubt.', ephemeral: true });
      try {
        await dbRun('INSERT INTO custom_commands (guild_id, name, response, created_by) VALUES (?, ?, ?, ?)', i.guildId, name, antwort, i.user.id);
        await i.reply({ embeds: [Embeds.success('Custom Command erstellt!', `\`/${name}\` wurde erstellt.`)] });
      } catch {
        await i.reply({ content: `❌ Command \`${name}\` existiert bereits.`, ephemeral: true });
      }
    } else if (aktion === 'delete') {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return i.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });
      if (!name) return i.reply({ content: '❌ Bitte Namen angeben.', ephemeral: true });
      const result = await dbRun('DELETE FROM custom_commands WHERE guild_id = ? AND name = ?', i.guildId, name);
      await i.reply({ content: result.changes > 0 ? `✅ \`${name}\` gelöscht.` : `❌ \`${name}\` nicht gefunden.`, ephemeral: true });
    } else if (aktion === 'list') {
      const cmds = await dbAll('SELECT name, uses FROM custom_commands WHERE guild_id = ? ORDER BY uses DESC', i.guildId);
      await i.reply({ embeds: [new EmbedBuilder().setColor(NexusColors.info).setTitle('⌨️ Custom Commands')
        .setDescription(cmds.length ? cmds.map(c => `\`${c['name']}\` — ${c['uses']} Nutzungen`).join('\n') : '*Keine vorhanden*')] });
    } else if (aktion === 'use') {
      if (!name) return i.reply({ content: '❌ Bitte Namen angeben.', ephemeral: true });
      const cmd = await dbGet('SELECT * FROM custom_commands WHERE guild_id = ? AND name = ?', i.guildId, name);
      if (!cmd) return i.reply({ content: `❌ \`${name}\` nicht gefunden.`, ephemeral: true });
      await dbRun('UPDATE custom_commands SET uses = uses + 1 WHERE id = ?', cmd['id']);
      await i.reply({ content: String(cmd['response']) });
    }
  },
};

export const funCommands: NexusCommand[] = [
  rankCmd, leaderboardCmd, setxpCmd, levelroleCmd,
  warningsCmd, clearwarningsCmd,
  lockCmd, unlockCmd, slowmodeCmd,
  pollCmd, giveawayCmd, remindCmd, cmdCmd,
];
