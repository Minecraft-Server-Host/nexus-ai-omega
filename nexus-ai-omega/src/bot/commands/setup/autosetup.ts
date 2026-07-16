/**
 * Nexus AI Omega — /autosetup Command v5.0 (KOMPLETT)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Alle Aktionen:
 *  full     → Vollständiges Auto-Setup (alles auf einmal)
 *  scan     → Alle Kanäle scannen & anzeigen
 *  rules    → Nur Regeln setzen
 *  welcome  → Nur Welcome konfigurieren
 *  logs     → Nur Log-Kanal setzen
 *  verify   → Nur Verifizierung einrichten
 *  roles    → Nur Rollen erstellen (Member, Muted, Mod)
 *  announce → Ankündigungs-Kanal konfigurieren
 *  suggest  → Vorschlags-Kanal einrichten
 *  status   → Aktuellen Setup-Status anzeigen
 *  reset    → Nexus-Konfiguration zurücksetzen
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
} from 'discord.js';
import { Embeds, NexusColors } from '../../../utils/embeds.js';
import {
  runAutoSetup,
  buildSetupResultEmbed,
  findChannel,
  scanAllChannels,
} from '../../systems/autoSetup.js';
import { cacheGet, cacheSet, cacheDel } from '../../../services/redisCache.js';
import { aiEngine } from '../../../ai-center/aiEngine.js';
import { botLogger } from '../../../services/logger.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('autosetup')
    .setDescription('⚙️ Nexus Auto-Setup — Automatische Server-Konfiguration')
    .addStringOption(o =>
      o
        .setName('aktion')
        .setDescription('Was soll konfiguriert werden?')
        .setRequired(true)
        .addChoices(
          { name: '🔧 Vollständiges Auto-Setup',          value: 'full' },
          { name: '🔍 Kanäle scannen & anzeigen',         value: 'scan' },
          { name: '📋 Nur Regeln setzen',                 value: 'rules' },
          { name: '👋 Nur Welcome konfigurieren',         value: 'welcome' },
          { name: '📊 Nur Log-Kanal setzen',              value: 'logs' },
          { name: '✅ Nur Verifizierung einrichten',      value: 'verify' },
          { name: '🎭 Nur Rollen erstellen',              value: 'roles' },
          { name: '📢 Ankündigungs-Kanal konfigurieren',  value: 'announce' },
          { name: '💡 Vorschlags-System einrichten',      value: 'suggest' },
          { name: '📊 Setup-Status anzeigen',             value: 'status' },
          { name: '🔄 Konfiguration zurücksetzen',        value: 'reset' },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const aktion = interaction.options.getString('aktion', true);
    const guild  = interaction.guild!;
    const cfgKey = `nexus:v5:guild:${guild.id}:config`;

    // ══════════════════════════════════════════════════════════════
    switch (aktion) {

      // ── FULL ──────────────────────────────────────────────────────
      case 'full': {
        await interaction.editReply({
          embeds: [Embeds.loading(
            '🔧 Vollständiges Auto-Setup läuft…',
            'Scannt alle Kanäle, erkennt Muster und konfiguriert alles automatisch.',
          )],
        });

        const result = await runAutoSetup(guild, true);
        await interaction.editReply({
          embeds: [buildSetupResultEmbed(result)],
          components: [],
        });
        break;
      }

      // ── SCAN ──────────────────────────────────────────────────────
      case 'scan': {
        const channels = scanAllChannels(guild);
        const found    = Object.keys(channels).length;

        const embed = new EmbedBuilder()
          .setColor(NexusColors.info)
          .setTitle('🔍 Kanal-Scan Ergebnis')
          .setDescription(
            `> **Server:** ${guild.name}\n` +
            `> **${found}** von **9** Kanal-Typen erkannt\n` +
            `> **${guild.channels.cache.size}** Kanäle gesamt\n`,
          );

        const allPurposes: [string, string, string][] = [
          ['rules',         '📋', 'Regeln-Kanal'],
          ['welcome',       '👋', 'Welcome-Kanal'],
          ['logs',          '📊', 'Log-Kanal'],
          ['modlog',        '🛡️', 'Mod-Log-Kanal'],
          ['general',       '💬', 'General-Kanal'],
          ['announcements', '📢', 'Ankündigungen'],
          ['verify',        '✅', 'Verifizierung'],
          ['suggestions',   '💡', 'Vorschläge'],
          ['staff',         '👥', 'Staff-Kanal'],
        ];

        for (const [purpose, emoji, label] of allPurposes) {
          const ch = channels[purpose as keyof typeof channels];
          embed.addFields({
            name:   `${emoji} ${label}`,
            value:  ch ? `✅ ${ch}` : '❌ Nicht gefunden',
            inline: true,
          });
        }

        // Schnell-Aktions-Buttons
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('autosetup:full')
            .setLabel('🔧 Vollständig einrichten')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('autosetup:missing')
            .setLabel('🛠️ Fehlende erstellen')
            .setStyle(ButtonStyle.Secondary),
        );

        embed
          .addFields({
            name:  '💡 Nächste Schritte',
            value:
              '› `/autosetup aktion:Vollständiges Auto-Setup` — Alles auf einmal einrichten\n' +
              '› `/setrules` — Regeln manuell konfigurieren\n' +
              '› `/setwelcome` — Welcome manuell konfigurieren\n' +
              '› `/setlogs` — Log-Kanal manuell setzen',
            inline: false,
          })
          .setFooter({ text: 'Nexus AI Omega v5 • Auto-Scan' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [row] });

        // Button-Antwort abfangen
        try {
          const btn = await interaction.channel!.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: b =>
              ['autosetup:full', 'autosetup:missing'].includes(b.customId) &&
              b.user.id === interaction.user.id,
            time: 30_000,
          });

          if (btn.customId === 'autosetup:full') {
            await btn.update({ embeds: [Embeds.loading('Vollständiges Auto-Setup läuft…')], components: [] });
            const result = await runAutoSetup(guild, true);
            await interaction.editReply({ embeds: [buildSetupResultEmbed(result)], components: [] });
          } else if (btn.customId === 'autosetup:missing') {
            await btn.update({ embeds: [Embeds.loading('Erstelle fehlende Kanäle…')], components: [] });
            await createMissingChannels(guild, channels, interaction);
          }
        } catch { /* Timeout = ignorieren */ }

        break;
      }

      // ── RULES ─────────────────────────────────────────────────────
      case 'rules': {
        const ch = findChannel(guild, 'rules');
        if (!ch) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(NexusColors.warning)
                .setTitle('⚠️ Kein Regeln-Kanal gefunden')
                .setDescription(
                  '> Kein passender Kanal gefunden.\n\n' +
                  '> **Erstelle einen Kanal mit einem dieser Namen:**\n' +
                  '> `rules` · `regeln` · `server-rules` · `server-regeln`\n' +
                  '> `📋rules` · `📜regeln` · `guidelines` · `verhaltensregeln`\n\n' +
                  '> Oder nutze `/setrules kanal:#dein-kanal` um einen manuell anzugeben.',
                )
                .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup' }),
            ],
          });
          return;
        }

        await interaction.editReply({
          embeds: [Embeds.loading(`📋 KI generiert Regeln für #${ch.name}…`)],
        });

        // Inline-Regeln generieren ohne Umweg über anderen Command
        const result = await generateAndSendRules(guild, ch);
        await interaction.editReply({ embeds: [result], components: [] });
        break;
      }

      // ── WELCOME ───────────────────────────────────────────────────
      case 'welcome': {
        const ch = findChannel(guild, 'welcome') ?? findChannel(guild, 'general');
        if (!ch) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(NexusColors.warning)
                .setTitle('⚠️ Kein Welcome-Kanal gefunden')
                .setDescription(
                  '> **Erstelle einen Kanal mit einem dieser Namen:**\n' +
                  '> `welcome` · `willkommen` · `bienvenido`\n' +
                  '> `👋welcome` · `🎉welcome` · `new-members`\n\n' +
                  '> Oder nutze `/setwelcome kanal:#dein-kanal`',
                )
                .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup' }),
            ],
          });
          return;
        }

        await interaction.editReply({
          embeds: [Embeds.loading(`👋 Welcome-System für #${ch.name} wird konfiguriert…`)],
        });

        const result = await setupWelcome(guild, ch);
        await interaction.editReply({ embeds: [result], components: [] });
        break;
      }

      // ── LOGS ──────────────────────────────────────────────────────
      case 'logs': {
        let ch = findChannel(guild, 'logs') ?? findChannel(guild, 'modlog');

        // Kein Log-Kanal → automatisch erstellen
        if (!ch) {
          await interaction.editReply({
            embeds: [Embeds.loading('📊 Kein Log-Kanal gefunden — erstelle automatisch…')],
          });

          try {
            ch = await guild.channels.create({
              name: '📋-nexus-logs',
              type: ChannelType.GuildText,
              topic: 'Nexus AI Omega v5 — Automatischer Log-Kanal',
              permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionFlagsBits.SendMessages] },
              ],
              reason: 'Nexus Auto-Setup — Log-Kanal erstellt',
            }) as import('discord.js').TextChannel;
          } catch (err) {
            await interaction.editReply({
              embeds: [Embeds.error('Fehler', `Log-Kanal konnte nicht erstellt werden: ${(err as Error).message}`)],
            });
            return;
          }
        }

        const config = await cacheGet<Record<string, unknown>>(cfgKey) ?? {};
        config.logChannelId = ch.id;
        config.logEvents    = 'all';
        await cacheSet(cfgKey, config, 86_400 * 7);

        await ch.send({
          embeds: [
            new EmbedBuilder()
              .setColor(NexusColors.ai)
              .setTitle('📊 Nexus Log-System aktiviert')
              .setDescription(
                '> Dieser Kanal wurde als **Log-Kanal** konfiguriert.\n' +
                '> Folgende Events werden hier protokolliert:\n\n' +
                '> 👥 Mitglieder-Events (Join, Leave)\n' +
                '> 🛡️ Moderationsaktionen (Ban, Kick, Timeout, Warn)\n' +
                '> 💬 Nachrichten (Bearbeitet, Gelöscht)\n' +
                '> 🎭 Rollen- & Kanal-Änderungen\n' +
                '> 🚨 Sicherheits-Alerts (Zero-Trust)\n' +
                '> 🤖 KI-Aktionen',
              )
              .setFooter({ text: 'Nexus AI Omega v5 • Log System' })
              .setTimestamp(),
          ],
        }).catch(() => {});

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NexusColors.success)
              .setTitle('✅ Log-System konfiguriert!')
              .setDescription(
                `> **Kanal:** ${ch}\n` +
                `> **Events:** Alle Events werden geloggt\n` +
                `> **Status:** 🟢 Aktiv`,
              )
              .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup' })
              .setTimestamp(),
          ],
        });
        break;
      }

      // ── VERIFY ────────────────────────────────────────────────────
      case 'verify': {
        let ch = findChannel(guild, 'verify');

        // Verifizierungs-Kanal nicht gefunden → erstellen
        if (!ch) {
          await interaction.editReply({
            embeds: [Embeds.loading('✅ Erstelle Verifizierungs-Kanal…')],
          });

          try {
            ch = await guild.channels.create({
              name: '✅-verification',
              type: ChannelType.GuildText,
              topic: 'Klicke den Button zum Verifizieren',
              permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionFlagsBits.SendMessages] },
              ],
              reason: 'Nexus Auto-Setup — Verifizierung',
            }) as import('discord.js').TextChannel;
          } catch (err) {
            await interaction.editReply({
              embeds: [Embeds.error('Fehler', `Verifizierungs-Kanal konnte nicht erstellt werden: ${(err as Error).message}`)],
            });
            return;
          }
        } else {
          await interaction.editReply({
            embeds: [Embeds.loading(`✅ Verifizierungs-System für #${ch.name} einrichten…`)],
          });
        }

        // Member-Rolle für Verifizierung finden
        const memberRole = guild.roles.cache.find(r =>
          ['member', 'mitglied', 'verified', 'verifiziert', 'user'].some(n =>
            r.name.toLowerCase().includes(n),
          ),
        );

        const verifyEmbed = new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('✅ Verifizierung — ' + guild.name)
          .setDescription(
            '> Klicke den Button unten, um dich zu verifizieren.\n' +
            '> Du erhältst danach Zugang zu allen Kanälen des Servers.\n\n' +
            '> 🛡️ **Warum verifizieren?**\n' +
            '> Um Bots und Spam zu verhindern und die Community zu schützen.',
          )
          .addFields(
            {
              name: '📋 Schritte',
              value:
                '1️⃣ Klicke auf "Ich bin kein Bot"\n' +
                '2️⃣ Du erhältst automatisch die Member-Rolle\n' +
                '3️⃣ Alle Kanäle sind für dich zugänglich',
              inline: true,
            },
            {
              name: '🎭 Rolle',
              value: memberRole ? `${memberRole}` : '`Keine Member-Rolle gefunden`\n*Nutze `/autosetup aktion:Rollen erstellen`*',
              inline: true,
            },
          )
          .setFooter({ text: `${guild.name} • Nexus AI Omega v5 • Verifizierung` })
          .setTimestamp();

        const verifyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('verify:click')
            .setLabel('✅ Ich bin kein Bot — Verifizieren')
            .setStyle(ButtonStyle.Success),
        );

        try {
          const msg = await ch.send({ embeds: [verifyEmbed], components: [verifyRow] });
          await msg.pin().catch(() => {});
        } catch { /* kein Zugriff */ }

        const config = await cacheGet<Record<string, unknown>>(cfgKey) ?? {};
        config.verifyChannelId = ch.id;
        if (memberRole) config.memberRoleId = memberRole.id;
        await cacheSet(cfgKey, config, 86_400 * 7);

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NexusColors.success)
              .setTitle('✅ Verifizierungs-System eingerichtet!')
              .addFields(
                { name: '📍 Kanal',      value: `${ch}`,                                        inline: true },
                { name: '🎭 Gibt Rolle', value: memberRole ? `${memberRole}` : '*Keine gefunden*', inline: true },
                { name: '📌 Angepinnt', value: '✅ Ja',                                         inline: true },
              )
              .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup' })
              .setTimestamp(),
          ],
        });
        break;
      }

      // ── ROLES ─────────────────────────────────────────────────────
      case 'roles': {
        await interaction.editReply({
          embeds: [Embeds.loading('🎭 Erstelle Standard-Rollen…')],
        });

        const result = await createStandardRoles(guild);
        await interaction.editReply({ embeds: [result], components: [] });
        break;
      }

      // ── ANNOUNCE ──────────────────────────────────────────────────
      case 'announce': {
        let ch = findChannel(guild, 'announcements');

        if (!ch) {
          await interaction.editReply({
            embeds: [Embeds.loading('📢 Erstelle Ankündigungs-Kanal…')],
          });

          try {
            ch = await guild.channels.create({
              name: '📢-announcements',
              type: ChannelType.GuildAnnouncement, // Discord Announcement-Kanal
              topic: 'Offizielle Ankündigungen — nur Team kann schreiben',
              permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionFlagsBits.SendMessages] },
              ],
              reason: 'Nexus Auto-Setup — Ankündigungen',
            }) as import('discord.js').TextChannel;
          } catch {
            // Fallback: normaler Text-Kanal
            try {
              ch = await guild.channels.create({
                name: '📢-announcements',
                type: ChannelType.GuildText,
                topic: 'Offizielle Ankündigungen',
                permissionOverwrites: [
                  { id: guild.roles.everyone, deny: [PermissionFlagsBits.SendMessages] },
                ],
                reason: 'Nexus Auto-Setup — Ankündigungen',
              }) as import('discord.js').TextChannel;
            } catch (err2) {
              await interaction.editReply({
                embeds: [Embeds.error('Fehler', `Kanal konnte nicht erstellt werden: ${(err2 as Error).message}`)],
              });
              return;
            }
          }
        } else {
          await interaction.editReply({
            embeds: [Embeds.loading(`📢 Ankündigungs-System für #${ch.name} konfigurieren…`)],
          });
        }

        const config = await cacheGet<Record<string, unknown>>(cfgKey) ?? {};
        config.announcementChannelId = ch.id;
        await cacheSet(cfgKey, config, 86_400 * 7);

        await ch.send({
          embeds: [
            new EmbedBuilder()
              .setColor(NexusColors.gold)
              .setTitle('📢 Ankündigungs-Kanal eingerichtet')
              .setDescription(
                '> Dieser Kanal ist für **offizielle Ankündigungen** des Teams.\n' +
                '> Nur Team-Mitglieder können hier schreiben.\n\n' +
                '> 🔔 Aktiviere Benachrichtigungen um keine wichtigen\n' +
                '> Neuigkeiten zu verpassen!',
              )
              .setFooter({ text: `${guild.name} • Nexus AI Omega v5` })
              .setTimestamp(),
          ],
        }).catch(() => {});

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NexusColors.success)
              .setTitle('✅ Ankündigungs-Kanal konfiguriert!')
              .addFields(
                { name: '📢 Kanal',        value: `${ch}`,     inline: true },
                { name: '🔒 Schreiben',    value: 'Nur Team', inline: true },
                { name: '🔔 Benachricht.', value: '✅ Aktiv',  inline: true },
              )
              .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup' })
              .setTimestamp(),
          ],
        });
        break;
      }

      // ── SUGGEST ───────────────────────────────────────────────────
      case 'suggest': {
        let ch = findChannel(guild, 'suggestions');

        if (!ch) {
          await interaction.editReply({
            embeds: [Embeds.loading('💡 Erstelle Vorschlags-Kanal…')],
          });

          try {
            ch = await guild.channels.create({
              name: '💡-suggestions',
              type: ChannelType.GuildText,
              topic: 'Teile deine Ideen! Nutze /suggest',
              reason: 'Nexus Auto-Setup — Vorschläge',
            }) as import('discord.js').TextChannel;
          } catch (err) {
            await interaction.editReply({
              embeds: [Embeds.error('Fehler', `Kanal konnte nicht erstellt werden: ${(err as Error).message}`)],
            });
            return;
          }
        } else {
          await interaction.editReply({
            embeds: [Embeds.loading(`💡 Vorschlags-System für #${ch.name} konfigurieren…`)],
          });
        }

        const config = await cacheGet<Record<string, unknown>>(cfgKey) ?? {};
        config.suggestionChannelId = ch.id;
        await cacheSet(cfgKey, config, 86_400 * 7);

        const suggestEmbed = new EmbedBuilder()
          .setColor(NexusColors.info)
          .setTitle('💡 Vorschlags-System — ' + guild.name)
          .setDescription(
            '> Hast du eine Idee, wie wir den Server verbessern können?\n\n' +
            '> **So funktioniert es:**\n' +
            '> 1️⃣ Nutze `/suggest idee:"Deine Idee"` um einen Vorschlag einzureichen\n' +
            '> 2️⃣ Die Community kann mit 👍 oder 👎 abstimmen\n' +
            '> 3️⃣ Das Team bewertet und setzt die besten Ideen um\n\n' +
            '> 📊 Vorschläge mit den meisten Stimmen werden priorisiert!',
          )
          .addFields(
            { name: '⌨️ Befehl',     value: '`/suggest idee:`',         inline: true },
            { name: '🗳️ Abstimmung', value: '👍 Dafür | 👎 Dagegen',     inline: true },
            { name: '⏱️ Prüfung',    value: 'Innerhalb von 48h',        inline: true },
          )
          .setFooter({ text: `${guild.name} • Nexus AI Omega v5 • Vorschläge` })
          .setTimestamp();

        const pinMsg = await ch.send({ embeds: [suggestEmbed] }).catch(() => null);
        if (pinMsg) await pinMsg.pin().catch(() => {});

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NexusColors.success)
              .setTitle('✅ Vorschlags-System eingerichtet!')
              .addFields(
                { name: '💡 Kanal',    value: `${ch}`,            inline: true },
                { name: '⌨️ Befehl',  value: '`/suggest idee:`', inline: true },
                { name: '📌 Info',    value: '✅ Angepinnt',       inline: true },
              )
              .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup' })
              .setTimestamp(),
          ],
        });
        break;
      }

      // ── STATUS ────────────────────────────────────────────────────
      case 'status': {
        const [channels, config] = await Promise.all([
          Promise.resolve(scanAllChannels(guild)),
          cacheGet<Record<string, unknown>>(cfgKey),
        ]);

        const textCount  = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceCount = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        const catCount   = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
        const roleCount  = guild.roles.cache.filter(r => !r.managed && r.id !== guild.roles.everyone.id).size;

        // Prüfe welche Module konfiguriert sind
        const modules = [
          { name: '📋 Regeln',      key: 'rulesChannelId',        found: !!channels.rules },
          { name: '👋 Welcome',     key: 'welcomeChannelId',      found: !!channels.welcome },
          { name: '📊 Logs',        key: 'logChannelId',          found: !!channels.logs || !!channels.modlog },
          { name: '✅ Verifizierung', key: 'verifyChannelId',     found: !!channels.verify },
          { name: '📢 Ankündigungen', key: 'announcementChannelId', found: !!channels.announcements },
          { name: '💡 Vorschläge',  key: 'suggestionChannelId',   found: !!channels.suggestions },
          { name: '🛡️ Mod-Log',    key: 'modLogChannelId',       found: !!channels.modlog },
          { name: '👥 Staff',       key: 'staffChannelId',        found: !!channels.staff },
        ];

        const configured = modules.filter(m => config?.[m.key] || m.found).length;
        const total      = modules.length;

        const embed = new EmbedBuilder()
          .setColor(configured === total ? NexusColors.success : configured > total / 2 ? NexusColors.warning : NexusColors.error)
          .setTitle('📊 Nexus Auto-Setup Status')
          .setDescription(
            `> **Server:** ${guild.name}\n` +
            `> **Mitglieder:** ${guild.memberCount.toLocaleString('de-DE')}\n` +
            `> **Setup:** ${configured}/${total} Module konfiguriert\n\n` +
            `> ${'🟢'.repeat(configured)}${'⬜'.repeat(total - configured)} ${Math.round((configured / total) * 100)}%`,
          )
          .addFields(
            { name: '📂 Kategorien',   value: `\`${catCount}\``,   inline: true },
            { name: '💬 Textkanäle',   value: `\`${textCount}\``,  inline: true },
            { name: '🎙️ Voicekanäle', value: `\`${voiceCount}\``, inline: true },
            { name: '🎭 Rollen',       value: `\`${roleCount}\``,  inline: true },
            { name: '🔍 Erkannte Kanäle', value: `\`${Object.keys(channels).length}\``, inline: true },
            { name: '💾 Konfig-Cache', value: config ? '✅ Vorhanden' : '❌ Nicht gefunden', inline: true },
          );

        // Module-Status
        for (const mod of modules) {
          const isSet = !!(config?.[mod.key] || mod.found);
          embed.addFields({
            name:   mod.name,
            value:  isSet ? '✅ Konfiguriert' : '❌ Nicht gesetzt',
            inline: true,
          });
        }

        // Fehlende Module Hinweis
        const missing = modules.filter(m => !(config?.[m.key] || m.found));
        if (missing.length > 0) {
          embed.addFields({
            name:  '⚙️ Fehlende Konfiguration',
            value:
              missing.map(m => `› ${m.name}`).join('\n') +
              '\n\n› Nutze `/autosetup` um fehlende Module einzurichten',
            inline: false,
          });
        }

        embed.setFooter({ text: 'Nexus AI Omega v5 • Setup Status' }).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      // ── RESET ─────────────────────────────────────────────────────
      case 'reset': {
        // Bestätigung erforderlich
        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('autosetup:reset:confirm')
            .setLabel('🔄 Ja, Konfiguration zurücksetzen')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('autosetup:reset:cancel')
            .setLabel('❌ Abbrechen')
            .setStyle(ButtonStyle.Secondary),
        );

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NexusColors.warning)
              .setTitle('⚠️ Konfiguration zurücksetzen?')
              .setDescription(
                '> Die **gespeicherte Nexus-Konfiguration** für diesen Server wird\n' +
                '> aus dem Cache gelöscht.\n\n' +
                '> **Was wird zurückgesetzt:**\n' +
                '> › Kanal-Konfiguration (Welcome, Rules, Logs…)\n' +
                '> › Rollen-IDs (Member, Muted, Mod)\n' +
                '> › KI-Provider-Einstellungen\n\n' +
                '> **Was NICHT zurückgesetzt wird:**\n' +
                '> › Bestehende Kanäle auf deinem Server\n' +
                '> › Bestehende Rollen\n' +
                '> › Discord-Einstellungen\n\n' +
                '> Danach kannst du `/autosetup aktion:Vollständig` erneut ausführen.',
              )
              .setFooter({ text: 'Nexus AI Omega v5 • Reset' }),
          ],
          components: [confirmRow],
        });

        try {
          const btn = await interaction.channel!.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: b =>
              ['autosetup:reset:confirm', 'autosetup:reset:cancel'].includes(b.customId) &&
              b.user.id === interaction.user.id,
            time: 20_000,
          });

          if (btn.customId === 'autosetup:reset:confirm') {
            await cacheDel(`nexus:v5:guild:${guild.id}:config`);
            await btn.update({
              embeds: [
                new EmbedBuilder()
                  .setColor(NexusColors.success)
                  .setTitle('✅ Konfiguration zurückgesetzt')
                  .setDescription(
                    '> Die Nexus-Konfiguration wurde gelöscht.\n\n' +
                    '> **Nächste Schritte:**\n' +
                    '> › `/autosetup aktion:Vollständiges Auto-Setup` — Alles neu einrichten\n' +
                    '> › `/setup` — Schnelles Setup',
                  )
                  .setFooter({ text: 'Nexus AI Omega v5 • Reset' })
                  .setTimestamp(),
              ],
              components: [],
            });
          } else {
            await btn.update({
              embeds: [Embeds.info('❌ Abgebrochen', '> Konfiguration wurde **nicht** zurückgesetzt.')],
              components: [],
            });
          }
        } catch {
          await interaction.editReply({
            embeds: [Embeds.info('⏱️ Timeout', '> Zeit abgelaufen. Konfiguration wurde nicht geändert.')],
            components: [],
          });
        }
        break;
      }

      default:
        await interaction.editReply({ embeds: [Embeds.error('Unbekannte Aktion')] });
    }
  },
};

// ══════════════════════════════════════════════════════════════════
// HELPER-FUNKTIONEN
// ══════════════════════════════════════════════════════════════════

/** Regeln generieren und in Kanal senden */
async function generateAndSendRules(
  guild: import('discord.js').Guild,
  channel: import('discord.js').TextChannel,
): Promise<EmbedBuilder> {
  let rulesText = '';

  try {
    const result = await aiEngine.infer({
      module: 'AI_COMMUNITY_MANAGER',
      prompt:
        `Erstelle professionelle Discord-Serverregeln für "${guild.name}" (${guild.memberCount} Mitglieder).\n` +
        `Format mit §1–§7, Deutsch, max 1800 Zeichen. Freundlich aber klar.`,
      guildId: guild.id,
      maxTokens: 900,
      temperature: 0.3,
    });
    rulesText = String(result.text).slice(0, 1900);
  } catch {
    rulesText =
      `📋 **Serverregeln — ${guild.name}**\n\n` +
      `**§1 — Respekt**\n• Behandle alle mit Respekt. Keine Beleidigungen.\n\n` +
      `**§2 — Inhalte**\n• Keine NSFW-Inhalte in falschen Kanälen.\n\n` +
      `**§3 — Spam**\n• Kein Spam oder unerwünschte Werbung.\n\n` +
      `**§4 — Discord ToS**\n• Es gelten discord.com/terms\n\n` +
      `**§5 — Konsequenzen**\n• Verstöße → Verwarnung → Timeout → Ban\n\n` +
      `*Stand: ${new Date().toLocaleDateString('de-DE')}*`;
  }

  const rulesEmbed = new EmbedBuilder()
    .setColor(NexusColors.info)
    .setTitle(`📋 Serverregeln — ${guild.name}`)
    .setDescription(rulesText)
    .setFooter({ text: `${guild.name} • Erstellt von Nexus AI v5 • ${new Date().toLocaleDateString('de-DE')}` })
    .setTimestamp();

  try {
    const msg = await channel.send({ embeds: [rulesEmbed] });
    await msg.pin().catch(() => {});
  } catch { /* kein Zugriff */ }

  return new EmbedBuilder()
    .setColor(NexusColors.success)
    .setTitle('✅ Regeln gesetzt & angepinnt!')
    .addFields(
      { name: '📋 Kanal',       value: `${channel}`,         inline: true },
      { name: '🤖 KI-generiert', value: '✅ Ja',               inline: true },
      { name: '📌 Angepinnt',   value: '✅ Ja',               inline: true },
    )
    .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup' })
    .setTimestamp();
}

/** Welcome-System in Kanal einrichten */
async function setupWelcome(
  guild: import('discord.js').Guild,
  channel: import('discord.js').TextChannel,
): Promise<EmbedBuilder> {
  const welcomeEmbed = new EmbedBuilder()
    .setColor(NexusColors.primary)
    .setTitle(`👋 Willkommen auf ${guild.name}!`)
    .setDescription(
      `> Hey **{user}**! Schön, dass du hier bist! 🎉\n` +
      `> Du bist Mitglied **#${guild.memberCount.toLocaleString('de-DE')}** auf diesem Server.\n\n` +
      `> 📋 Lies zuerst unsere **Regeln** durch.\n` +
      `> 🎫 Bei Fragen öffne ein **Ticket**.\n` +
      `> 🤖 **Nexus AI** hilft dir mit \`/ai\`.`,
    )
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: '📋 Erste Schritte', value: '› Regeln lesen\n› Vorstellen\n› Viel Spaß!',      inline: true },
      { name: '🛡️ Hilfe',         value: '› Ticket öffnen\n› /help nutzen\n› Team fragen', inline: true },
    )
    .setFooter({ text: `${guild.name} • Nexus AI Omega v5` })
    .setTimestamp();

  const welcomeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('welcome:rules').setLabel('📋 Regeln').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket:open:sonstiges').setLabel('🎫 Support').setStyle(ButtonStyle.Secondary),
  );

  try {
    await channel.send({ embeds: [welcomeEmbed], components: [welcomeRow] });
  } catch { /* kein Zugriff */ }

  const config = await cacheGet<Record<string, unknown>>(`nexus:v5:guild:${guild.id}:config`) ?? {};
  config.welcomeChannelId = channel.id;
  await cacheSet(`nexus:v5:guild:${guild.id}:config`, config, 86_400 * 7);

  return new EmbedBuilder()
    .setColor(NexusColors.success)
    .setTitle('✅ Welcome-System konfiguriert!')
    .addFields(
      { name: '👋 Kanal',  value: `${channel}`,   inline: true },
      { name: '🤖 KI',    value: '✅ Aktiv',       inline: true },
      { name: '🎭 Buttons', value: '✅ Vorhanden', inline: true },
    )
    .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup' })
    .setTimestamp();
}

/** Standard-Rollen erstellen */
async function createStandardRoles(guild: import('discord.js').Guild): Promise<EmbedBuilder> {
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[]  = [];

  const roleDefs = [
    {
      names: ['owner', 'besitzer', 'inhaber'],
      create: { name: '👑 Owner', color: 0xf59e0b, hoist: true, mentionable: false,
        permissions: PermissionFlagsBits.Administrator },
    },
    {
      names: ['admin', 'administrator', 'verwaltung'],
      create: { name: '⚙️ Admin', color: 0xf43f5e, hoist: true, mentionable: true,
        permissions: PermissionFlagsBits.Administrator },
    },
    {
      names: ['moderator', 'mod', 'moderatoren'],
      create: { name: '🛡️ Moderator', color: 0x06ffa5, hoist: true, mentionable: true,
        permissions:
          PermissionFlagsBits.KickMembers |
          PermissionFlagsBits.BanMembers |
          PermissionFlagsBits.ManageMessages |
          PermissionFlagsBits.ModerateMembers |
          PermissionFlagsBits.ViewAuditLog },
    },
    {
      names: ['support', 'helper', 'helfer'],
      create: { name: '🎫 Support', color: 0x0ea5e9, hoist: true, mentionable: true,
        permissions:
          PermissionFlagsBits.KickMembers |
          PermissionFlagsBits.ManageMessages |
          PermissionFlagsBits.ModerateMembers },
    },
    {
      names: ['vip', 'premium', 'booster', 'supporter'],
      create: { name: '💎 VIP', color: 0xa855f7, hoist: false, mentionable: false,
        permissions: 0n },
    },
    {
      names: ['member', 'mitglied', 'verified', 'verifiziert', 'user'],
      create: { name: '👥 Member', color: 0x6b7280, hoist: false, mentionable: false,
        permissions:
          PermissionFlagsBits.SendMessages |
          PermissionFlagsBits.ReadMessageHistory |
          PermissionFlagsBits.ViewChannel |
          PermissionFlagsBits.AddReactions |
          PermissionFlagsBits.UseApplicationCommands },
    },
    {
      names: ['muted', 'mute', 'stumm', 'stummgeschaltet'],
      create: { name: '🔇 Muted', color: 0x374151, hoist: false, mentionable: false,
        permissions: 0n },
    },
  ] as const;

  for (const def of roleDefs) {
    const exists = guild.roles.cache.find(r =>
      (def.names as readonly string[]).some(n => r.name.toLowerCase().includes(n)),
    );

    if (exists) {
      skipped.push(`\`${exists.name}\` (bereits vorhanden)`);
      continue;
    }

    try {
      const role = await guild.roles.create({
        name: def.create.name,
        color: def.create.color,
        hoist: def.create.hoist,
        mentionable: def.create.mentionable,
        permissions: BigInt(def.create.permissions),
        reason: 'Nexus Auto-Setup — Standard-Rollen',
      });
      created.push(`\`${role.name}\``);
      await new Promise(r => setTimeout(r, 300)); // Rate-Limit
    } catch (err) {
      errors.push(`${def.create.name}: ${(err as Error).message}`);
    }
  }

  return new EmbedBuilder()
    .setColor(errors.length > 0 ? NexusColors.warning : NexusColors.success)
    .setTitle(errors.length > 0 ? '⚠️ Rollen erstellt (mit Problemen)' : '✅ Standard-Rollen erstellt!')
    .addFields(
      {
        name: `✅ Erstellt (${created.length})`,
        value: created.length > 0 ? created.join('\n') : '`Keine neuen Rollen`',
        inline: true,
      },
      {
        name: `⏭️ Übersprungen (${skipped.length})`,
        value: skipped.length > 0 ? skipped.join('\n') : '`Keine`',
        inline: true,
      },
      ...(errors.length > 0
        ? [{ name: `❌ Fehler (${errors.length})`, value: errors.join('\n').slice(0, 512), inline: false }]
        : []),
    )
    .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup • Rollen' })
    .setTimestamp();
}

/** Fehlende Kanäle automatisch erstellen */
async function createMissingChannels(
  guild: import('discord.js').Guild,
  existing: ReturnType<typeof scanAllChannels>,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const created: string[] = [];

  const toCreate: Array<{ purpose: string; name: string; type: ChannelType; perms?: boolean }> = [];

  if (!existing.rules)         toCreate.push({ purpose: 'Regeln',      name: '📋-rules',         type: ChannelType.GuildText, perms: true });
  if (!existing.welcome)       toCreate.push({ purpose: 'Welcome',     name: '👋-welcome',       type: ChannelType.GuildText });
  if (!existing.logs)          toCreate.push({ purpose: 'Logs',        name: '📋-nexus-logs',    type: ChannelType.GuildText, perms: true });
  if (!existing.announcements) toCreate.push({ purpose: 'Ankündigu.', name: '📢-announcements', type: ChannelType.GuildAnnouncement, perms: true });
  if (!existing.verify)        toCreate.push({ purpose: 'Verify',      name: '✅-verification',  type: ChannelType.GuildText, perms: true });
  if (!existing.suggestions)   toCreate.push({ purpose: 'Vorschläge', name: '💡-suggestions',   type: ChannelType.GuildText });

  if (toCreate.length === 0) {
    await interaction.editReply({
      embeds: [Embeds.success('✅ Alles vorhanden!', '> Alle Standard-Kanäle wurden bereits erkannt.')],
    });
    return;
  }

  for (const def of toCreate) {
    try {
      const chType = def.type === ChannelType.GuildAnnouncement
        ? ChannelType.GuildText  // Fallback falls Announcement nicht verfügbar
        : def.type;

      await guild.channels.create({
        name: def.name,
        type: chType,
        permissionOverwrites: def.perms
          ? [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.SendMessages] }]
          : undefined,
        reason: 'Nexus Auto-Setup — Fehlende Kanäle erstellt',
      });
      created.push(`✅ \`${def.name}\` (${def.purpose})`);
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      created.push(`❌ \`${def.name}\` — ${(err as Error).message}`);
    }
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(NexusColors.success)
        .setTitle(`🛠️ ${created.length} Kanäle erstellt`)
        .setDescription(created.join('\n'))
        .addFields({
          name: '💡 Nächster Schritt',
          value: '› `/autosetup aktion:Vollständiges Auto-Setup` — Alles konfigurieren',
          inline: false,
        })
        .setFooter({ text: 'Nexus AI Omega v5 • Auto-Setup' })
        .setTimestamp(),
    ],
  });
}

export default command;
