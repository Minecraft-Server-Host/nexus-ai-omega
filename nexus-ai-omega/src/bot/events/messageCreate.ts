/**
 * Nexus AI Omega — MessageCreate Event v5.2
 * • Real-time Security Scan (Token, Phishing, API-Keys)
 * • AutoMod Wortfilter (aus DB)
 * • Spam-Velocity-Check (Zero-Trust)
 * • XP / Leveling mit SQLite
 * • Level-Rollen automatisch vergeben
 */
import { Events, type Message } from 'discord.js';
import { securityManager }  from '../../security-center/securityManager.js';
import { globalLogger }     from '../../global/globalLogger.js';
import { statsAggregator }  from '../../global/statisticsAggregator.js';
import { botLogger }        from '../../services/logger.js';
import { cacheGet, cacheSet } from '../../services/redisCache.js';
import { dbGet, dbRun }     from '../../services/database.js';

const XP_PER_MESSAGE     = 15;   // XP pro Nachricht
const XP_COOLDOWN_SECS   = 60;   // Cooldown in Sekunden

function calcLevel(xp: number): number {
  return Math.floor(0.1 * Math.sqrt(xp));
}

export default {
  name: Events.MessageCreate,

  async execute(message: Message): Promise<void> {
    // Bots und DMs ignorieren
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId  = message.author.id;
    const guild   = message.guild;

    // ── 1. Security Scan (< 5ms) ─────────────────────────────────────────
    const scan = securityManager.scanMessage(message.content);
    if (scan.blocked) {
      try {
        await message.delete();
        await message.author.send(
          `⚠️ **Nexus AI Security** — Deine Nachricht auf **${guild.name}** wurde automatisch blockiert.\n` +
          `**Grund:** ${scan.reason}\n\n` +
          `Falls dies ein Fehler ist, wende dich bitte an das Team.`,
        ).catch(() => {});

        await globalLogger.log({
          eventType: scan.type === 'PHISHING' ? 'SCAM_DETECTED' : 'TOKEN_LEAK',
          severity:  'security',
          guildId,
          guildName: guild.name,
          userId,
          username:  message.author.tag,
          channelId: message.channelId,
          action:    'MESSAGE_DELETED',
          reason:    scan.reason,
          metadata:  { type: scan.type },
        });

        botLogger.warn({ userId, guildId, reason: scan.reason, type: scan.type }, '🚨 Nachricht blockiert');
      } catch { /* Nachricht bereits gelöscht */ }
      return;
    }

    // ── 2. Spam-Velocity-Check ────────────────────────────────────────────
    await securityManager.evaluateEvent(guildId, userId, 'MESSAGE_CREATE');

    // ── 3. AutoMod Wortfilter (aus DB) ────────────────────────────────────
    try {
      const automod = await dbGet('SELECT words FROM automod WHERE guild_id = ?', guildId);
      if (automod?.['words']) {
        const words = JSON.parse(String(automod['words'])) as string[];
        const lower = message.content.toLowerCase();
        if (words.length > 0 && words.some(w => lower.includes(w.toLowerCase()))) {
          await message.delete().catch(() => {});
          const warn = await message.channel.send(
            `⚠️ ${message.author} — Deine Nachricht wurde wegen eines verbotenen Ausdrucks gelöscht.`,
          ).catch(() => null);
          if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
          return;
        }
      }
    } catch { /* DB nicht verfügbar */ }

    // ── 4. XP / Leveling (SQLite + Redis-Cooldown) ───────────────────────
    try {
      const cooldownKey = `nexus:v5:xp:cd:${guildId}:${userId}`;
      const onCooldown  = await cacheGet<boolean>(cooldownKey);
      if (!onCooldown) {
        await cacheSet(cooldownKey, true, XP_COOLDOWN_SECS);

        // XP in DB speichern
        const existing = await dbGet(
          'SELECT xp, level FROM levels WHERE guild_id = ? AND user_id = ?',
          guildId, userId,
        );

        if (existing) {
          await dbRun(
            'UPDATE levels SET xp = xp + ?, messages = messages + 1 WHERE guild_id = ? AND user_id = ?',
            XP_PER_MESSAGE, guildId, userId,
          );
        } else {
          await dbRun(
            'INSERT INTO levels (guild_id, user_id, xp, level, messages) VALUES (?, ?, ?, 0, 1)',
            guildId, userId, XP_PER_MESSAGE,
          );
        }

        // Level berechnen
        const data     = await dbGet('SELECT xp, level FROM levels WHERE guild_id = ? AND user_id = ?', guildId, userId);
        const newXp    = Number(data?.['xp'] ?? 0);
        const oldLevel = Number(data?.['level'] ?? 0);
        const newLevel = calcLevel(newXp);

        if (newLevel > oldLevel) {
          // Level-Up!
          await dbRun(
            'UPDATE levels SET level = ? WHERE guild_id = ? AND user_id = ?',
            newLevel, guildId, userId,
          );

          await message.channel.send({
            content: `🎉 <@${userId}> hat **Level ${newLevel}** erreicht! ⭐`,
          }).catch(() => {});

          // Level-Rollen vergeben
          try {
            const settings = await dbGet('SELECT level_roles FROM guild_settings WHERE guild_id = ?', guildId);
            if (settings?.['level_roles']) {
              const roles = JSON.parse(String(settings['level_roles'])) as Record<string, string>;
              const roleId = roles[String(newLevel)];
              if (roleId && message.member) {
                await message.member.roles.add(roleId, `Nexus Level-Rolle — Level ${newLevel}`).catch(() => {});
              }
            }
          } catch { /* Rollen-Vergabe fehlgeschlagen */ }

          await globalLogger.log({
            eventType: 'LEVEL_UP',
            severity:  'success',
            guildId,
            guildName: guild.name,
            userId,
            username:  message.author.tag,
            result:    `Level ${newLevel} erreicht`,
            metadata:  { level: newLevel, xp: newXp },
          });
        }
      }
    } catch { /* XP-System nicht kritisch */ }

    // ── 5. Stats ──────────────────────────────────────────────────────────
    statsAggregator.inc('messagesToday');
  },
};
