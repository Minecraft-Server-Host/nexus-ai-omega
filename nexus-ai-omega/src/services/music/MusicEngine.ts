/**
 * Nexus AI Omega — Music Engine v5.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Vollständige Musik-Engine mit:
 *   • YouTube Suche & Streaming (via play-dl)
 *   • Spotify Track-Auflösung → YouTube
 *   • Warteschlange mit Shuffle, Loop, Autoplay
 *   • Lautstärke-Kontrolle (0–200%)
 *   • DSP Filter (Bassboost, Nightcore, 8D, Vaporwave…)
 *   • Auto-Disconnect nach Inaktivität
 *   • Premium Embeds mit Fortschrittsbalken
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  type AudioPlayer,
  type VoiceConnection,
  type AudioResource,
} from '@discordjs/voice';
import type { VoiceBasedChannel, TextChannel, Guild } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { botLogger } from '../logger.js';
import { NexusColors } from '../../utils/embeds.js';

// ── Song Interface ──────────────────────────────────────────────────────────
export interface Song {
  title:      string;
  url:        string;
  duration:   string;
  durationSec: number;
  thumbnail:  string | null;
  requester:  string;
  requesterId:string;
  source:     'youtube' | 'spotify' | 'soundcloud' | 'direct';
  artist?:    string;
  album?:     string;
}

// ── Queue Interface ─────────────────────────────────────────────────────────
export interface MusicQueue {
  guildId:      string;
  songs:        Song[];
  player:       AudioPlayer;
  connection:   VoiceConnection;
  textChannel:  TextChannel;
  voiceChannel: VoiceBasedChannel;
  playing:      boolean;
  paused:       boolean;
  loopMode:     'none' | 'song' | 'queue';
  volume:       number;        // 0–200
  filter:       string | null; // aktueller DSP-Filter
  startedAt:    number;        // Timestamp wann Song started
  idleTimer?:   ReturnType<typeof setTimeout>;
  resource?:    AudioResource;
}

// ── DSP Filter Definitionen ─────────────────────────────────────────────────
export const DSP_FILTERS: Record<string, { name: string; emoji: string; timescale?: { speed?: number; pitch?: number; rate?: number } }> = {
  none:       { name: 'Kein Filter',  emoji: '🎵' },
  bassboost:  { name: 'Bassboost',    emoji: '🔊' },
  nightcore:  { name: 'Nightcore',    emoji: '🌙' },
  vaporwave:  { name: 'Vaporwave',    emoji: '🌊' },
  '8d':       { name: '8D Audio',     emoji: '🎧' },
  slowed:     { name: 'Slowed',       emoji: '🐢' },
  speed:      { name: 'Geschwindigkeit', emoji: '⚡' },
  soft:       { name: 'Soft',         emoji: '🌸' },
  pop:        { name: 'Pop',          emoji: '🎤' },
  earrape:    { name: 'Earrape',      emoji: '💥' },
};

// ── Globaler Queue-Manager ──────────────────────────────────────────────────
const queues = new Map<string, MusicQueue>();

export function getQueue(guildId: string): MusicQueue | null {
  return queues.get(guildId) ?? null;
}

export function deleteQueue(guildId: string): void {
  const q = queues.get(guildId);
  if (q) {
    clearTimeout(q.idleTimer);
    try { q.player.stop(true); } catch { /* ignore */ }
    try { q.connection.destroy(); } catch { /* ignore */ }
  }
  queues.delete(guildId);
}

// ── Fortschrittsbalken ──────────────────────────────────────────────────────
export function buildProgressBar(currentSec: number, totalSec: number, width = 20): string {
  if (totalSec <= 0) return '`' + '▬'.repeat(width) + '`';
  const progress = Math.min(1, currentSec / totalSec);
  const filled   = Math.floor(progress * width);
  const bar      = '▓'.repeat(filled) + '░'.repeat(width - filled);
  return `\`${bar}\``;
}

export function formatTime(seconds: number): string {
  if (seconds <= 0 || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Now Playing Embed ───────────────────────────────────────────────────────
export function buildNowPlayingEmbed(queue: MusicQueue): EmbedBuilder {
  const song    = queue.songs[0];
  const elapsed = Math.floor((Date.now() - queue.startedAt) / 1000);
  const bar     = buildProgressBar(elapsed, song.durationSec);
  const filter  = queue.filter ? DSP_FILTERS[queue.filter] : null;

  const loopEmoji: Record<string, string> = {
    none: '', song: '🔂', queue: '🔁',
  };

  return new EmbedBuilder()
    .setColor(NexusColors.primary)
    .setTitle(`${queue.paused ? '⏸️' : '🎵'}  Läuft gerade`)
    .setDescription(
      `### [${song.title}](${song.url})\n\n` +
      `${bar}\n` +
      `\`${formatTime(elapsed)}\` / \`${song.duration}\``,
    )
    .setThumbnail(song.thumbnail ?? null)
    .addFields(
      { name: '👤 Angefragt von', value: song.requester,                                      inline: true  },
      { name: '🔊 Lautstärke',   value: `${queue.volume}%`,                                  inline: true  },
      { name: '📋 Warteschlange', value: `${Math.max(0, queue.songs.length - 1)} Songs`,     inline: true  },
      { name: '🔀 Loop',         value: queue.loopMode === 'none' ? 'Aus' : loopEmoji[queue.loopMode] + ' ' + queue.loopMode, inline: true  },
      { name: '🎛️ Filter',      value: filter ? `${filter.emoji} ${filter.name}` : '❌ Kein', inline: true  },
      { name: '📡 Quelle',       value: song.source.charAt(0).toUpperCase() + song.source.slice(1), inline: true },
    )
    .setFooter({ text: 'Nexus AI Omega v5 • Music System' })
    .setTimestamp();
}

// ── Song Suche & Streaming ──────────────────────────────────────────────────
export async function searchSong(query: string, requesterTag: string, requesterId: string): Promise<Song | null> {
  try {
    const playdl = await import('play-dl');

    // YouTube Cookie wenn vorhanden
    if (process.env.YOUTUBE_COOKIE) {
      try {
        await playdl.setToken({ youtube: { cookie: process.env.YOUTUBE_COOKIE } });
      } catch { /* ignore */ }
    }

    // Spotify URL erkennen und in YouTube umwandeln
    if (query.includes('spotify.com/track')) {
      try {
        const sp = await playdl.spotify(query);
        if (sp.type === 'track') {
          const track = sp as { name: string; artists: { name: string }[] };
          query = `${track.name} ${track.artists[0]?.name ?? ''}`;
        }
      } catch {
        // Spotify API nicht konfiguriert → direkt suchen
        const urlParts = query.split('/').pop()?.split('?')[0];
        query = urlParts ?? query;
      }
    }

    // YouTube URL direkt
    const urlValidation = playdl.yt_validate(query);
    if (urlValidation === 'video') {
      const info = await playdl.video_info(query);
      const v    = info.video_details;
      return {
        title:       v.title ?? 'Unbekannt',
        url:         v.url,
        duration:    v.durationRaw ?? '0:00',
        durationSec: v.durationInSec ?? 0,
        thumbnail:   v.thumbnails?.[v.thumbnails.length - 1]?.url ?? null,
        requester:   requesterTag,
        requesterId,
        source:      'youtube',
        artist:      v.channel?.name,
      };
    }

    // Suche
    const results = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
    if (!results.length) return null;

    const v = results[0];
    return {
      title:       v.title ?? 'Unbekannt',
      url:         v.url,
      duration:    v.durationRaw ?? '0:00',
      durationSec: v.durationInSec ?? 0,
      thumbnail:   v.thumbnails?.[v.thumbnails.length - 1]?.url ?? null,
      requester:   requesterTag,
      requesterId,
      source:      'youtube',
      artist:      v.channel?.name,
    };
  } catch (err) {
    botLogger.error({ err, query }, 'Song-Suche fehlgeschlagen');
    return null;
  }
}

// ── Playlist laden ──────────────────────────────────────────────────────────
export async function loadPlaylist(url: string, requesterTag: string, requesterId: string): Promise<Song[]> {
  try {
    const playdl = await import('play-dl');
    const playlist = await playdl.playlist_info(url, { incomplete: true });
    if (!playlist) return [];

    const videos = await playlist.all_videos();
    return videos.slice(0, 50).map(v => ({
      title:       v.title ?? 'Unbekannt',
      url:         v.url,
      duration:    v.durationRaw ?? '0:00',
      durationSec: v.durationInSec ?? 0,
      thumbnail:   v.thumbnails?.[v.thumbnails.length - 1]?.url ?? null,
      requester:   requesterTag,
      requesterId,
      source:      'youtube' as const,
    }));
  } catch (err) {
    botLogger.error({ err, url }, 'Playlist-Laden fehlgeschlagen');
    return [];
  }
}

// ── Song abspielen ──────────────────────────────────────────────────────────
export async function playSong(guildId: string): Promise<void> {
  const queue = queues.get(guildId);
  if (!queue || queue.songs.length === 0) {
    // Warteschlange leer → Auto-Disconnect nach 3 Minuten
    if (queue) {
      queue.playing = false;
      queue.idleTimer = setTimeout(() => {
        const q = queues.get(guildId);
        if (q && !q.playing) {
          q.textChannel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(NexusColors.dark)
                .setTitle('👋  Nexus Musik verlässt den Kanal')
                .setDescription('> Warteschlange leer — Bot verlässt den Voice-Kanal nach 3 Minuten Inaktivität.')
                .setFooter({ text: 'Nexus AI Omega v5 • Music System' }),
            ],
          }).catch(() => {});
          deleteQueue(guildId);
        }
      }, 3 * 60 * 1000);
    }
    return;
  }

  const song = queue.songs[0];
  queue.startedAt = Date.now();

  try {
    const playdl   = await import('play-dl');
    const source   = await playdl.stream(song.url, { quality: 2 });
    const resource = createAudioResource(source.stream, {
      inputType: source.type as import('@discordjs/voice').StreamType,
      inlineVolume: true,
    });

    // Lautstärke setzen
    resource.volume?.setVolume(queue.volume / 100);
    queue.resource = resource;

    queue.player.play(resource);
    queue.playing = true;
    queue.paused  = false;
    clearTimeout(queue.idleTimer);

    // Now-Playing Nachricht
    await queue.textChannel.send({
      embeds: [buildNowPlayingEmbed(queue)],
    }).catch(() => {});

    // Song-Ende Handler
    queue.player.removeAllListeners(AudioPlayerStatus.Idle);
    queue.player.once(AudioPlayerStatus.Idle, async () => {
      // Loop-Modus
      if (queue.loopMode === 'song') {
        // Gleichen Song nochmal abspielen
        await playSong(guildId);
        return;
      }
      if (queue.loopMode === 'queue') {
        // Song ans Ende der Schlange
        const current = queue.songs.shift()!;
        queue.songs.push(current);
      } else {
        // Song entfernen
        queue.songs.shift();
      }
      await playSong(guildId);
    });

    // Player-Fehler
    queue.player.on('error', async (err: Error) => {
      botLogger.error({ err: err.message, guildId, song: song.title }, 'Audio Player Fehler');
      queue.songs.shift();
      await playSong(guildId);
    });

  } catch (err) {
    botLogger.error({ err, guildId, song: song.title }, 'Stream-Fehler');
    queue.songs.shift();
    await playSong(guildId);
  }
}

// ── Voice-Kanal beitreten ───────────────────────────────────────────────────
export async function joinChannel(
  voiceChannel: VoiceBasedChannel,
  textChannel:  TextChannel,
  guild:        Guild,
): Promise<MusicQueue | null> {
  try {
    // Alte Verbindung trennen
    const oldConn = getVoiceConnection(guild.id);
    if (oldConn) oldConn.destroy();

    const connection = joinVoiceChannel({
      channelId:      voiceChannel.id,
      guildId:        guild.id,
      adapterCreator: guild.voiceAdapterCreator as any,
      selfDeaf:       true,
    });

    // Warten bis bereit
    await entersState(connection, VoiceConnectionStatus.Ready, 12_000);

    const player = createAudioPlayer();
    connection.subscribe(player);

    // Auto-Reconnect
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        deleteQueue(guild.id);
      }
    });

    const queue: MusicQueue = {
      guildId:      guild.id,
      songs:        [],
      player,
      connection,
      textChannel,
      voiceChannel,
      playing:      false,
      paused:       false,
      loopMode:     'none',
      volume:       80,
      filter:       null,
      startedAt:    0,
    };

    queues.set(guild.id, queue);
    return queue;

  } catch (err) {
    botLogger.error({ err, guildId: guild.id }, 'Voice-Join fehlgeschlagen');
    return null;
  }
}

// ── Shuffle ─────────────────────────────────────────────────────────────────
export function shuffleQueue(guildId: string): boolean {
  const queue = queues.get(guildId);
  if (!queue || queue.songs.length < 2) return false;

  const current = queue.songs[0];
  const rest    = queue.songs.slice(1);

  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  queue.songs = [current, ...rest];
  return true;
}

// ── Lautstärke setzen ────────────────────────────────────────────────────────
export function setVolume(guildId: string, volume: number): boolean {
  const queue = queues.get(guildId);
  if (!queue) return false;
  const clamped    = Math.max(0, Math.min(200, volume));
  queue.volume     = clamped;
  queue.resource?.volume?.setVolume(clamped / 100);
  return true;
}

// ── Alle Queues aufräumen (Shutdown) ─────────────────────────────────────────
export function destroyAllQueues(): void {
  for (const [guildId] of queues) {
    deleteQueue(guildId);
  }
}
