/**
 * Nexus AI Omega — Support Voice Engine v5.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Vollständige Voice-Engine für den Support-Warteraum:
 *
 *  1. Bot betritt Warteraum wenn User joint
 *  2. KI-generierte Willkommensnachricht per TTS (Google TTS)
 *  3. Hintergrundmusik läuft in dauerhafter Loop
 *  4. Musik stoppt wenn kein User mehr im Raum
 *  5. Bot verlässt Raum automatisch
 *
 * TTS-Anbieter (in Reihenfolge):
 *   → Google Translate TTS (kostenlos, kein Key)
 *   → Fallback: gespeicherte MP3
 *
 * Musik:
 *   → Eigene URL (per /support-musik konfigurierbar)
 *   → Standard: Royalty-Free Loop-Tracks
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import https from 'node:https';
import http from 'node:http';
import { Readable } from 'node:stream';
import { botLogger } from '../logger.js';

// ── Typen ─────────────────────────────────────────────────────────────────────
type VoiceConnection  = import('@discordjs/voice').VoiceConnection;
type AudioPlayer      = import('@discordjs/voice').AudioPlayer;
type AudioPlayerState = import('@discordjs/voice').AudioPlayerState;

// ── Royalty-Free Hintergrundmusik (loopfähig) ─────────────────────────────────
const DEFAULT_MUSIC_TRACKS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
];

// ── Aktive Verbindungen pro Guild ─────────────────────────────────────────────
interface GuildVoiceState {
  connection: VoiceConnection;
  player: AudioPlayer;
  musicUrl: string | null;
  guildId: string;
  channelId: string;
  userIds: Set<string>;
  musicLoopTimer?: ReturnType<typeof setTimeout>;
}

const activeConnections = new Map<string, GuildVoiceState>();

// ── HTTP-Stream Helper ─────────────────────────────────────────────────────────
function fetchStream(url: string, extraHeaders: Record<string, string> = {}): Promise<Readable> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/mpeg, audio/*, */*',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
        ...extraHeaders,
      },
    };

    const req = lib.request(options, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Redirect folgen
        fetchStream(res.headers.location!, extraHeaders).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} für ${url}`));
        return;
      }
      resolve(res as unknown as Readable);
    });

    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ── TTS-URLs generieren ────────────────────────────────────────────────────────
function buildTTSUrls(text: string): string[] {
  const encoded = encodeURIComponent(text);
  return [
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=de&client=tw-ob&ttsspeed=0.9`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encoded}&tl=de&client=gtx&sl=de`,
  ];
}

// ── Hintergrundmusik abspielen ─────────────────────────────────────────────────
async function playMusic(
  state: GuildVoiceState,
  AudioPlayerStatus: typeof import('@discordjs/voice').AudioPlayerStatus,
  createAudioResource: typeof import('@discordjs/voice').createAudioResource,
): Promise<void> {
  const tracks = state.musicUrl ? [state.musicUrl] : DEFAULT_MUSIC_TRACKS;
  const url = tracks[Math.floor(Math.random() * tracks.length)];

  try {
    const stream = await fetchStream(url);
    const resource = createAudioResource(stream, { inlineVolume: true });
    resource.volume?.setVolume(0.18); // Leise im Hintergrund
    state.player.play(resource);
    botLogger.debug({ guildId: state.guildId, url }, '🎵 Musik spielt');
  } catch (err) {
    botLogger.warn({ err: (err as Error).message, guildId: state.guildId }, '🎵 Musik-Stream fehlgeschlagen');
    // Nächstes Mal erneut versuchen (via Idle-Event)
  }
}

// ── TTS Willkommensnachricht abspielen ─────────────────────────────────────────
async function playWelcomeTTS(
  state: GuildVoiceState,
  text: string,
  AudioPlayerStatus: typeof import('@discordjs/voice').AudioPlayerStatus,
  createAudioResource: typeof import('@discordjs/voice').createAudioResource,
  onFinished: () => void,
): Promise<void> {
  const ttsUrls = buildTTSUrls(text);

  for (const ttsUrl of ttsUrls) {
    try {
      const stream = await fetchStream(ttsUrl, {
        'Referer': 'https://translate.google.com/',
        'Accept': 'audio/mpeg, audio/*, */*',
      });

      const resource = createAudioResource(stream, { inlineVolume: true });
      resource.volume?.setVolume(0.9); // TTS laut & klar

      state.player.play(resource);
      botLogger.info({ guildId: state.guildId }, '🗣️ TTS Willkommens-Nachricht läuft');

      // Warte auf Ende → dann Musik starten
      state.player.once('stateChange', (_: AudioPlayerState, newState: AudioPlayerState) => {
        if (newState.status === AudioPlayerStatus.Idle) {
          botLogger.debug({ guildId: state.guildId }, '🗣️ TTS fertig → starte Musik');
          setTimeout(onFinished, 600);
        }
      });

      return; // Erfolgreich → abbrechen
    } catch (err) {
      botLogger.warn({ err: (err as Error).message, url: ttsUrl }, 'TTS-URL fehlgeschlagen — nächste probieren');
    }
  }

  // Alle TTS-URLs fehlgeschlagen → direkt Musik
  botLogger.warn({ guildId: state.guildId }, 'Alle TTS-URLs fehlgeschlagen → starte Musik direkt');
  onFinished();
}

// ── Haupt-Funktion: Bot betritt Warteraum ────────────────────────────────────
export async function joinSupportWaitroom(options: {
  guildId: string;
  channelId: string;
  userId: string;
  welcomeText: string;
  musicUrl: string | null;
  guild: import('discord.js').Guild;
}): Promise<void> {
  const { guildId, channelId, userId, welcomeText, musicUrl, guild } = options;

  // @discordjs/voice dynamisch laden (optional dependency)
  let voice: typeof import('@discordjs/voice');
  try {
    voice = await import('@discordjs/voice');
  } catch {
    botLogger.warn({ guildId }, '⚠️ @discordjs/voice nicht installiert — Voice-Features deaktiviert');
    return;
  }

  const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = voice;

  // Alte Verbindung trennen falls vorhanden
  const existing = activeConnections.get(guildId);
  if (existing) {
    existing.userIds.add(userId);
    botLogger.debug({ guildId, userId }, 'User joined existing support session');
    return;
  }

  try {
    // Alten Voice-Connection trennen
    const oldConnection = getVoiceConnection(guildId);
    if (oldConnection) oldConnection.destroy();

    // Neuen Voice-Channel betreten
    const connection = joinVoiceChannel({
      channelId,
      guildId,
      adapterCreator: guild.voiceAdapterCreator as any,
      selfDeaf: false,
      selfMute: false,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    const state: GuildVoiceState = {
      connection,
      player,
      musicUrl,
      guildId,
      channelId,
      userIds: new Set([userId]),
    };

    activeConnections.set(guildId, state);

    // Musik-Loop via Idle-Event
    player.on('stateChange', (_: AudioPlayerState, newState: AudioPlayerState) => {
      if (newState.status === AudioPlayerStatus.Idle) {
        const s = activeConnections.get(guildId);
        if (!s || s.userIds.size === 0) return;

        // Kurze Pause zwischen Tracks
        setTimeout(() => {
          if (activeConnections.has(guildId)) {
            playMusic(s, AudioPlayerStatus, createAudioResource);
          }
        }, 1500);
      }
    });

    // Connection-Fehler
    connection.on('error', (err: Error) => {
      botLogger.error({ err, guildId }, 'Voice Connection Fehler');
      leaveSupportWaitroom(guildId);
    });

    // 2 Sekunden warten → dann TTS → dann Musik
    setTimeout(() => {
      const s = activeConnections.get(guildId);
      if (!s) return;

      playWelcomeTTS(
        s,
        welcomeText,
        AudioPlayerStatus,
        createAudioResource,
        () => {
          const current = activeConnections.get(guildId);
          if (current && current.userIds.size > 0) {
            playMusic(current, AudioPlayerStatus, createAudioResource);
          }
        },
      );
    }, 2000);

    botLogger.info({ guildId, channelId, userId }, '🎤 Bot ist Warteraum beigetreten');

  } catch (err) {
    botLogger.error({ err, guildId }, 'joinSupportWaitroom fehlgeschlagen');
    activeConnections.delete(guildId);
  }
}

// ── User verlässt Warteraum ────────────────────────────────────────────────────
export function userLeftWaitroom(guildId: string, userId: string): void {
  const state = activeConnections.get(guildId);
  if (!state) return;

  state.userIds.delete(userId);

  // Niemand mehr im Raum → Bot verlässt
  if (state.userIds.size === 0) {
    botLogger.info({ guildId }, '🎤 Warteraum leer → Bot verlässt');
    setTimeout(() => leaveSupportWaitroom(guildId), 2000);
  }
}

// ── Bot verlässt Warteraum ─────────────────────────────────────────────────────
export function leaveSupportWaitroom(guildId: string): void {
  const state = activeConnections.get(guildId);
  if (!state) return;

  try {
    state.player.stop(true);
    state.connection.destroy();
  } catch { /* ignore */ }

  activeConnections.delete(guildId);
  botLogger.info({ guildId }, '🎤 Bot hat Warteraum verlassen');
}

// ── Status abfragen ────────────────────────────────────────────────────────────
export function getSupportVoiceStatus(guildId: string): {
  active: boolean;
  userCount: number;
  channelId?: string;
} {
  const state = activeConnections.get(guildId);
  if (!state) return { active: false, userCount: 0 };
  return { active: true, userCount: state.userIds.size, channelId: state.channelId };
}

// ── Alle aktiven Verbindungen (für shutdown) ───────────────────────────────────
export function disconnectAll(): void {
  for (const [guildId] of activeConnections) {
    leaveSupportWaitroom(guildId);
  }
}
