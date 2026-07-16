/**
 * Nexus AI Omega — Musik Commands v5.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Alle Musik-Befehle:
 *   /play       — Song abspielen (YouTube, Spotify, Suche)
 *   /skip       — Song überspringen
 *   /stop       — Musik stoppen & Kanal verlassen
 *   /pause      — Musik pausieren
 *   /resume     — Musik fortsetzen
 *   /queue      — Warteschlange anzeigen
 *   /nowplaying — Aktuellen Song anzeigen
 *   /volume     — Lautstärke setzen (0–200%)
 *   /loop       — Loop-Modus setzen
 *   /shuffle    — Warteschlange mischen
 *   /remove     — Song aus Warteschlange entfernen
 *   /clear      — Warteschlange leeren
 *   /move       — Song verschieben
 *   /lyrics     — Songtexte (KI-gestützt)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import {
  getQueue,
  deleteQueue,
  searchSong,
  loadPlaylist,
  joinChannel,
  playSong,
  shuffleQueue,
  setVolume,
  buildNowPlayingEmbed,
  formatTime,
  DSP_FILTERS,
  type MusicQueue,
} from '../../../services/music/MusicEngine.js';
import { NexusColors, Embeds } from '../../../utils/embeds.js';
import { botLogger } from '../../../services/logger.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

// ── Helper: User im Voice-Check ──────────────────────────────────────────────
function getUserVoice(interaction: ChatInputCommandInteraction): {
  ok: boolean;
  channel?: import('discord.js').VoiceBasedChannel;
  error?: string;
} {
  const member = interaction.member as GuildMember;
  const vc     = member.voice.channel;
  if (!vc) return { ok: false, error: '❌ Du musst in einem **Voice-Kanal** sein!' };

  const perms = vc.permissionsFor(interaction.client.user!);
  if (!perms?.has('Connect'))
    return { ok: false, error: '❌ Ich habe keine **Berechtigung** dem Kanal beizutreten!' };
  if (!perms?.has('Speak'))
    return { ok: false, error: '❌ Ich habe keine **Berechtigung** im Kanal zu sprechen!' };

  return { ok: true, channel: vc };
}

// ── Musik Controls Buttons ───────────────────────────────────────────────────
function musicControlRow(guildId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`music:pause:${guildId}`) .setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music:skip:${guildId}`)  .setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music:stop:${guildId}`)  .setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`music:queue:${guildId}`) .setEmoji('📋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`music:shuffle:${guildId}`).setEmoji('🔀').setStyle(ButtonStyle.Secondary),
  );
}

// ════════════════════════════════════════════════════════════════════════════
// /play
// ════════════════════════════════════════════════════════════════════════════
export const playCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Song oder Playlist abspielen (YouTube, Spotify, Suche)')
    .addStringOption(o =>
      o.setName('song')
        .setDescription('YouTube/Spotify URL oder Songname')
        .setRequired(true)
        .setMaxLength(500),
    )
    .setDMPermission(false),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const vc = getUserVoice(interaction);
    if (!vc.ok || !vc.channel) {
      await interaction.reply({ embeds: [Embeds.error('Kein Voice-Kanal', vc.error)], ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const query = interaction.options.getString('song', true);
    const guild = interaction.guild!;
    const isPlaylist = query.includes('list=') || query.includes('playlist');

    // Playlist laden
    if (isPlaylist && query.includes('youtube.com')) {
      await interaction.editReply({ embeds: [Embeds.loading('Playlist wird geladen…', 'Bitte warten — lade Songs…')] });

      const songs = await loadPlaylist(query, interaction.user.tag, interaction.user.id);
      if (!songs.length) {
        await interaction.editReply({ embeds: [Embeds.error('Playlist leer', 'Konnte keine Songs aus der Playlist laden.')] });
        return;
      }

      let queue = getQueue(guild.id);
      if (!queue) {
        queue = await joinChannel(vc.channel, interaction.channel as TextChannel, guild);
        if (!queue) {
          await interaction.editReply({ embeds: [Embeds.error('Voice-Fehler', 'Konnte dem Voice-Kanal nicht beitreten!')] });
          return;
        }
      }

      queue.songs.push(...songs);

      if (!queue.playing) await playSong(guild.id);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.success)
            .setTitle('📋  Playlist hinzugefügt!')
            .addFields(
              { name: '🎵 Songs',      value: `\`${songs.length}\``,      inline: true },
              { name: '🔊 Kanal',      value: vc.channel.name,            inline: true },
              { name: '📋 Gesamt',     value: `\`${queue.songs.length}\``, inline: true },
            )
            .setFooter({ text: 'Nexus AI Omega v5 • Music System' }),
        ],
        components: [musicControlRow(guild.id)],
      });
      return;
    }

    // Einzelner Song
    await interaction.editReply({ embeds: [Embeds.loading(`Suche: "${query}"`, 'YouTube wird durchsucht…')] });

    const song = await searchSong(query, interaction.user.tag, interaction.user.id);
    if (!song) {
      await interaction.editReply({ embeds: [Embeds.error('Nicht gefunden', `Kein Song für **${query}** gefunden.\nVersuche eine direktere Suche oder YouTube-URL.`)] });
      return;
    }

    let queue = getQueue(guild.id);
    if (!queue) {
      queue = await joinChannel(vc.channel, interaction.channel as TextChannel, guild);
      if (!queue) {
        await interaction.editReply({ embeds: [Embeds.error('Voice-Fehler', 'Konnte dem Voice-Kanal nicht beitreten!')] });
        return;
      }
    }

    queue.songs.push(song);

    if (!queue.playing) {
      // Erster Song → sofort abspielen
      await playSong(guild.id);
      await interaction.editReply({
        embeds: [buildNowPlayingEmbed(queue)],
        components: [musicControlRow(guild.id)],
      });
    } else {
      // Song zur Warteschlange
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.primary)
            .setTitle('➕  Zur Warteschlange hinzugefügt')
            .setDescription(`### [${song.title}](${song.url})`)
            .setThumbnail(song.thumbnail)
            .addFields(
              { name: '⏱️ Dauer',   value: song.duration,                         inline: true },
              { name: '📍 Position',value: `\`#${queue.songs.length}\``,           inline: true },
              { name: '👤 Von',     value: interaction.user.tag,                   inline: true },
            )
            .setFooter({ text: 'Nexus AI Omega v5 • Music System' }),
        ],
        components: [musicControlRow(guild.id)],
      });
    }
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /skip
// ════════════════════════════════════════════════════════════════════════════
export const skipCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('⏭️ Aktuellen Song überspringen')
    .addIntegerOption(o => o.setName('anzahl').setDescription('Wie viele Songs überspringen? (Standard: 1)').setMinValue(1).setMaxValue(20))
    .setDMPermission(false),
  cooldown: 2,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(i.guild!.id);
    if (!queue?.playing) {
      await i.reply({ embeds: [Embeds.error('Keine Musik', 'Gerade spielt keine Musik.')], ephemeral: true });
      return;
    }
    const count = i.options.getInteger('anzahl') ?? 1;
    // Mehrere Songs überspringen
    if (count > 1) queue.songs.splice(1, count - 1);
    queue.player.stop();
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.info)
          .setTitle('⏭️  Übersprungen')
          .setDescription(count > 1 ? `${count} Songs übersprungen.` : 'Song übersprungen.')
          .setFooter({ text: `Angefragt von ${i.user.tag}` }),
      ],
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /stop
// ════════════════════════════════════════════════════════════════════════════
export const stopCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('⏹️ Musik stoppen und Voice-Kanal verlassen')
    .setDMPermission(false),
  cooldown: 3,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(i.guild!.id);
    if (!queue) {
      await i.reply({ embeds: [Embeds.error('Keine Musik', 'Gerade läuft keine Musik.')], ephemeral: true });
      return;
    }
    deleteQueue(i.guild!.id);
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.error)
          .setTitle('⏹️  Gestoppt')
          .setDescription('Musik gestoppt und Voice-Kanal verlassen.')
          .setFooter({ text: `Gestoppt von ${i.user.tag}` }),
      ],
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /pause
// ════════════════════════════════════════════════════════════════════════════
export const pauseCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('⏸️ Musik pausieren')
    .setDMPermission(false),
  cooldown: 2,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(i.guild!.id);
    if (!queue?.playing || queue.paused) {
      await i.reply({ embeds: [Embeds.error('Fehler', 'Keine Musik läuft oder bereits pausiert.')], ephemeral: true });
      return;
    }
    queue.player.pause();
    queue.paused = true;
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.warning)
          .setTitle('⏸️  Pausiert')
          .setDescription(`**${queue.songs[0]?.title ?? 'Unbekannt'}** wurde pausiert.\nNutze \`/resume\` zum Fortsetzen.`),
      ],
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /resume
// ════════════════════════════════════════════════════════════════════════════
export const resumeCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('▶️ Pausierte Musik fortsetzen')
    .setDMPermission(false),
  cooldown: 2,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(i.guild!.id);
    if (!queue || !queue.paused) {
      await i.reply({ embeds: [Embeds.error('Fehler', 'Keine pausierte Musik vorhanden.')], ephemeral: true });
      return;
    }
    queue.player.unpause();
    queue.paused = false;
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('▶️  Fortgesetzt')
          .setDescription(`**${queue.songs[0]?.title ?? 'Unbekannt'}** wird fortgesetzt.`),
      ],
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /queue
// ════════════════════════════════════════════════════════════════════════════
export const queueCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('📋 Warteschlange anzeigen')
    .addIntegerOption(o => o.setName('seite').setDescription('Seite').setMinValue(1))
    .setDMPermission(false),
  cooldown: 3,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(i.guild!.id);
    if (!queue?.songs.length) {
      await i.reply({ embeds: [Embeds.info('📋 Warteschlange', '> Die Warteschlange ist leer.\n> Nutze `/play <Song>` um Musik abzuspielen!')], ephemeral: true });
      return;
    }

    const page     = i.options.getInteger('seite') ?? 1;
    const perPage  = 10;
    const pages    = Math.ceil((queue.songs.length - 1) / perPage) || 1;
    const pageNum  = Math.min(page, pages);
    const start    = (pageNum - 1) * perPage + 1;
    const end      = Math.min(start + perPage - 1, queue.songs.length - 1);

    const current  = queue.songs[0];
    const upcoming = queue.songs.slice(start, end + 1);

    const totalDurSec = queue.songs.reduce((s, song) => s + song.durationSec, 0);

    const embed = new EmbedBuilder()
      .setColor(NexusColors.primary)
      .setTitle(`📋  Warteschlange — ${i.guild!.name}`)
      .addFields({
        name: `${queue.paused ? '⏸️' : '▶️'}  Läuft gerade`,
        value: `[${current.title}](${current.url}) \`${current.duration}\`\nAngefragt von: ${current.requester}`,
        inline: false,
      });

    if (upcoming.length > 0) {
      embed.addFields({
        name: `Als nächstes (${queue.songs.length - 1} Songs):`,
        value: upcoming.map((s, idx) =>
          `\`${start + idx}.\` [${s.title.slice(0, 45)}${s.title.length > 45 ? '…' : ''}](${s.url}) \`${s.duration}\``,
        ).join('\n'),
        inline: false,
      });
    }

    embed.addFields(
      { name: '🎵 Gesamt Songs',    value: `\`${queue.songs.length}\``,             inline: true },
      { name: '⏱️ Gesamt Dauer',    value: `\`${formatTime(totalDurSec)}\``,        inline: true },
      { name: '🔁 Loop',            value: `\`${queue.loopMode}\``,                 inline: true },
      { name: '🔊 Lautstärke',      value: `\`${queue.volume}%\``,                  inline: true },
    )
    .setFooter({ text: `Seite ${pageNum}/${pages} • Nexus AI Omega v5 • Music System` });

    await i.reply({ embeds: [embed], components: [musicControlRow(i.guild!.id)] });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /nowplaying
// ════════════════════════════════════════════════════════════════════════════
export const nowplayingCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('🎵 Aktuell abgespielten Song anzeigen')
    .setDMPermission(false),
  cooldown: 3,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(i.guild!.id);
    if (!queue?.playing || !queue.songs.length) {
      await i.reply({ embeds: [Embeds.info('Kein Song', '> Gerade läuft keine Musik.\n> Starte mit `/play <Song>`!')], ephemeral: true });
      return;
    }
    await i.reply({ embeds: [buildNowPlayingEmbed(queue)], components: [musicControlRow(i.guild!.id)] });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /volume
// ════════════════════════════════════════════════════════════════════════════
export const volumeCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('🔊 Lautstärke einstellen (0–200%)')
    .addIntegerOption(o =>
      o.setName('lautstärke').setDescription('Lautstärke in Prozent (0–200)').setRequired(true).setMinValue(0).setMaxValue(200),
    )
    .setDMPermission(false),
  cooldown: 2,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const vol = i.options.getInteger('lautstärke', true);
    const ok  = setVolume(i.guild!.id, vol);
    if (!ok) {
      await i.reply({ embeds: [Embeds.error('Keine Musik', 'Gerade läuft keine Musik.')], ephemeral: true });
      return;
    }
    const emoji = vol === 0 ? '🔇' : vol < 50 ? '🔈' : vol < 100 ? '🔉' : '🔊';
    const bar   = '█'.repeat(Math.floor(vol / 10)) + '░'.repeat(20 - Math.floor(vol / 10));
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.info)
          .setTitle(`${emoji}  Lautstärke gesetzt`)
          .setDescription(`\`${bar}\`\n**${vol}%**`),
      ],
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /loop
// ════════════════════════════════════════════════════════════════════════════
export const loopCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('🔁 Loop-Modus setzen')
    .addStringOption(o =>
      o.setName('modus').setDescription('Loop-Modus').setRequired(true)
        .addChoices(
          { name: '❌ Kein Loop',       value: 'none'  },
          { name: '🔂 Aktuellen Song',  value: 'song'  },
          { name: '🔁 Ganze Warteschlange', value: 'queue' },
        ),
    )
    .setDMPermission(false),
  cooldown: 2,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(i.guild!.id);
    if (!queue) {
      await i.reply({ embeds: [Embeds.error('Keine Musik', 'Gerade läuft keine Musik.')], ephemeral: true });
      return;
    }
    const modus = i.options.getString('modus', true) as 'none' | 'song' | 'queue';
    queue.loopMode = modus;
    const labels: Record<string, string> = {
      none: '❌ Loop deaktiviert', song: '🔂 Song-Loop aktiviert', queue: '🔁 Warteschlangen-Loop aktiviert',
    };
    await i.reply({
      embeds: [
        new EmbedBuilder().setColor(NexusColors.primary).setTitle(labels[modus])
          .setDescription(
            modus === 'none'  ? 'Songs werden nach dem Abspielen aus der Warteschlange entfernt.' :
            modus === 'song'  ? 'Der aktuelle Song wird endlos wiederholt.' :
            'Die gesamte Warteschlange wird wiederholt.',
          ),
      ],
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /shuffle
// ════════════════════════════════════════════════════════════════════════════
export const shuffleCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('🔀 Warteschlange zufällig mischen')
    .setDMPermission(false),
  cooldown: 3,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const ok = shuffleQueue(i.guild!.id);
    if (!ok) {
      await i.reply({ embeds: [Embeds.error('Fehler', 'Nicht genug Songs zum Mischen (mind. 2 benötigt).')], ephemeral: true });
      return;
    }
    const queue = getQueue(i.guild!.id)!;
    await i.reply({
      embeds: [
        new EmbedBuilder().setColor(NexusColors.success)
          .setTitle('🔀  Warteschlange gemischt!')
          .setDescription(`${queue.songs.length - 1} Songs wurden zufällig neu sortiert.`),
      ],
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /remove
// ════════════════════════════════════════════════════════════════════════════
export const removeCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('🗑️ Song aus Warteschlange entfernen')
    .addIntegerOption(o =>
      o.setName('position').setDescription('Position in der Warteschlange (1 = nächster Song)').setRequired(true).setMinValue(1),
    )
    .setDMPermission(false),
  cooldown: 2,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(i.guild!.id);
    if (!queue || queue.songs.length < 2) {
      await i.reply({ embeds: [Embeds.error('Fehler', 'Die Warteschlange ist leer.')], ephemeral: true });
      return;
    }
    const pos  = i.options.getInteger('position', true);
    if (pos >= queue.songs.length) {
      await i.reply({ embeds: [Embeds.error('Ungültige Position', `Warteschlange hat nur ${queue.songs.length - 1} Songs.`)], ephemeral: true });
      return;
    }
    const removed = queue.songs.splice(pos, 1)[0];
    await i.reply({
      embeds: [
        new EmbedBuilder().setColor(NexusColors.warning)
          .setTitle('🗑️  Song entfernt')
          .setDescription(`**${removed.title}** wurde aus der Warteschlange entfernt.`),
      ],
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /clearqueue
// ════════════════════════════════════════════════════════════════════════════
export const clearqueueCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('🗑️ Gesamte Warteschlange leeren (aktueller Song bleibt)')
    .setDMPermission(false),
  cooldown: 3,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(i.guild!.id);
    if (!queue || queue.songs.length < 2) {
      await i.reply({ embeds: [Embeds.error('Fehler', 'Die Warteschlange ist bereits leer.')], ephemeral: true });
      return;
    }
    const count   = queue.songs.length - 1;
    queue.songs   = [queue.songs[0]];
    await i.reply({
      embeds: [
        new EmbedBuilder().setColor(NexusColors.warning)
          .setTitle('🗑️  Warteschlange geleert')
          .setDescription(`${count} Songs wurden entfernt. Der aktuelle Song läuft weiter.`),
      ],
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// /lyrics (KI-gestützt)
// ════════════════════════════════════════════════════════════════════════════
export const lyricsCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('📜 Songtext anzeigen (KI-gestützt)')
    .addStringOption(o =>
      o.setName('song').setDescription('Songname (leer = aktueller Song)').setMaxLength(200),
    )
    .setDMPermission(false),
  cooldown: 10,
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    await i.deferReply();

    const queue      = getQueue(i.guild!.id);
    const songQuery  = i.options.getString('song') ?? queue?.songs[0]?.title;

    if (!songQuery) {
      await i.editReply({ embeds: [Embeds.error('Kein Song', 'Kein Song angegeben und keine Musik läuft.')] });
      return;
    }

    try {
      const { aiEngine } = await import('../../../ai-center/aiEngine.js');
      const result = await aiEngine.infer({
        module: 'AI_COMMUNITY_MANAGER',
        prompt:
          `Finde den deutschen oder englischen Songtext für: "${songQuery}"\n` +
          `Gib nur den Songtext zurück (erste 2 Strophen + Chorus). ` +
          `Falls du den Text nicht kennst, sage das ehrlich auf Deutsch.`,
        maxTokens: 800,
        temperature: 0.2,
      });

      await i.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.primary)
            .setTitle(`📜  Songtext — ${songQuery}`)
            .setDescription(String(result.text).slice(0, 4000))
            .setFooter({ text: `KI-generiert via ${result.provider} • Nexus AI Omega v5` }),
        ],
      });
    } catch {
      await i.editReply({ embeds: [Embeds.error('Fehler', 'Songtext konnte nicht gefunden werden.')] });
    }
  },
};

// ════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER (für Musik-Control-Buttons)
// ════════════════════════════════════════════════════════════════════════════
export async function handleMusicButton(interaction: import('discord.js').ButtonInteraction): Promise<void> {
  const parts   = interaction.customId.split(':');
  const action  = parts[1];
  const guildId = parts[2];

  // Sicherheit: nur Queue-Owner oder Mods
  const queue = getQueue(guildId);

  switch (action) {
    case 'pause': {
      if (!queue?.playing || queue.paused) {
        await interaction.reply({ content: '❌ Keine Musik oder bereits pausiert.', ephemeral: true }); return;
      }
      queue.player.pause();
      queue.paused = true;
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(NexusColors.warning).setTitle('⏸️  Pausiert').setDescription(`Song wurde pausiert. Nutze ▶️ zum Fortsetzen.`)],
        ephemeral: true,
      });
      break;
    }
    case 'resume': {
      if (!queue?.paused) {
        await interaction.reply({ content: '❌ Musik läuft bereits.', ephemeral: true }); return;
      }
      queue.player.unpause();
      queue.paused = false;
      await interaction.reply({ content: '▶️ Fortgesetzt!', ephemeral: true });
      break;
    }
    case 'skip': {
      if (!queue?.playing) {
        await interaction.reply({ content: '❌ Keine Musik läuft.', ephemeral: true }); return;
      }
      queue.player.stop();
      await interaction.reply({ content: '⏭️ Übersprungen!', ephemeral: true });
      break;
    }
    case 'stop': {
      if (!queue) {
        await interaction.reply({ content: '❌ Keine Musik läuft.', ephemeral: true }); return;
      }
      deleteQueue(guildId);
      await interaction.reply({ content: '⏹️ Gestoppt!', ephemeral: true });
      break;
    }
    case 'shuffle': {
      shuffleQueue(guildId);
      await interaction.reply({ content: '🔀 Gemischt!', ephemeral: true });
      break;
    }
    case 'queue': {
      if (!queue?.songs.length) {
        await interaction.reply({ content: '📋 Warteschlange ist leer.', ephemeral: true }); return;
      }
      const preview = queue.songs.slice(0, 8).map((s, idx) =>
        `\`${idx === 0 ? '▶' : idx}.\` ${s.title.slice(0, 40)} \`${s.duration}\``,
      ).join('\n');
      await interaction.reply({
        embeds: [
          new EmbedBuilder().setColor(NexusColors.primary)
            .setTitle(`📋  Warteschlange (${queue.songs.length} Songs)`)
            .setDescription(preview)
            .setFooter({ text: 'Nutze /queue für die vollständige Liste' }),
        ],
        ephemeral: true,
      });
      break;
    }
    default:
      await interaction.reply({ content: '❓ Unbekannte Aktion.', ephemeral: true });
  }
}

// ── Export aller Musik-Commands ──────────────────────────────────────────────
export const musicCommands: NexusCommand[] = [
  playCmd,
  skipCmd,
  stopCmd,
  pauseCmd,
  resumeCmd,
  queueCmd,
  nowplayingCmd,
  volumeCmd,
  loopCmd,
  shuffleCmd,
  removeCmd,
  clearqueueCmd,
  lyricsCmd,
];
