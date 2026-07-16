/**
 * Nexus AI Omega — GuildCreate Event v5.2
 * Vollständiges, professionelles Onboarding beim Server-Beitritt.
 */
import { Events, type Guild, EmbedBuilder } from 'discord.js';
import { serverRegistry }                   from '../../global/serverRegistry.js';
import { globalLogger }                     from '../../global/globalLogger.js';
import { botLogger }                        from '../../services/logger.js';
import { NexusColors }                      from '../../utils/embeds.js';
import { runAutoSetup, buildSetupResultEmbed, findChannel } from '../systems/autoSetup.js';
import { roleSyncService } from '../../global/team/roleSyncService.js';

export default {
  name: Events.GuildCreate,

  async execute(guild: Guild): Promise<void> {
    botLogger.info(
      { guildId: guild.id, guildName: guild.name, members: guild.memberCount },
      '🏰 Neuer Server beigetreten',
    );

    // 1. Server in globaler DB registrieren
    await serverRegistry.upsertServer({
      guildId:     guild.id,
      name:        guild.name,
      icon:        guild.iconURL(),
      ownerId:     guild.ownerId,
      memberCount: guild.memberCount,
      locale:      guild.preferredLocale,
    }).catch(err => botLogger.error({ err }, 'Server-Registrierung fehlgeschlagen'));

    // 2. Global log
    await globalLogger.serverJoin(guild);

    // 3. Members für vollständigen Scan laden (mit Fehlerbehandlung)
    await guild.members.fetch().catch(() => {});

    // 3b. Nexus Team Rolle sicherstellen & synchronisieren
    await roleSyncService.ensureTeamRole(guild).catch(err =>
      botLogger.warn({ err }, 'Team-Rolle konnte nicht erstellt werden'),
    );

    // 4. Auto-Setup ausführen
    let setupResult;
    try {
      setupResult = await runAutoSetup(guild, true);
    } catch (err) {
      botLogger.error({ err, guildId: guild.id }, 'Auto-Setup fehlgeschlagen');
    }

    // 5. Willkommens-Embed senden
    const welcomeEmbed = new EmbedBuilder()
      .setColor(NexusColors.primary)
      .setTitle('🌐  Willkommen bei Nexus AI Omega!')
      .setDescription(
        '> Danke, dass du **Nexus AI Omega v5** zu deinem Server hinzugefügt hast!\n\n' +
        '> **⚡ Erste Schritte:**\n' +
        '> › `/help` — Alle 52+ Befehle ansehen\n' +
        '> › `/setup` — Automatische Server-Konfiguration\n' +
        '> › `/ticket-setup` — KI-Ticket-System einrichten\n' +
        '> › `/serverbuild` — Server mit KI aufbauen\n' +
        '> › `/support-setup` — Voice-Warteraum einrichten\n\n' +
        '> **🛡️ Zero-Trust Security** ist bereits aktiv.\n' +
        '> **🤖 KI-System** ist bereit — `/ai` zum Starten.',
      )
      .addFields(
        { name: '📊 Konfiguriert', value: setupResult ? `${setupResult.created.length} Einstellungen` : 'Manuell via /setup', inline: true  },
        { name: '🤖 KI-Module',    value: '`20 aktiv`',                                                                        inline: true  },
        { name: '🔮 KI-Provider',  value: '`14 verfügbar`',                                                                    inline: true  },
        { name: '🛡️ Security',     value: '`Zero-Trust aktiv`',                                                               inline: true  },
        { name: '📞 Support',      value: '[Support-Server](https://discord.gg/kzaMp69dD)',                                    inline: true  },
      )
      .setThumbnail(guild.client.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: 'Nexus AI Omega v5 • Premium KI Discord Bot' })
      .setTimestamp();

    // 6. Setup-Ergebnis-Embed (falls verfügbar)
    const embeds = [welcomeEmbed];
    if (setupResult) embeds.push(buildSetupResultEmbed(setupResult));

    // 7. Besten Kanal zum Senden finden
    const targetCh =
      findChannel(guild, 'general') ??
      guild.systemChannel ??
      (guild.channels.cache.find(c => c.isTextBased() && c.type === 0) as import('discord.js').TextChannel | null);

    if (targetCh && 'send' in targetCh) {
      await (targetCh as import('discord.js').TextChannel).send({ embeds }).catch(() => {});
    }

    // 8. Owner per DM informieren
    try {
      const owner = await guild.fetchOwner();
      await owner.send({ embeds }).catch(() => {});
    } catch { /* Owner DMs geschlossen — kein Problem */ }

    botLogger.info(
      { guildId: guild.id, durationMs: setupResult?.durationMs ?? 0 },
      '✅ GuildCreate Onboarding abgeschlossen',
    );
  },
};
