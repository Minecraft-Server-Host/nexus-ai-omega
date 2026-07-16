/**
 * Nexus AI Omega — Button Interaction Dispatcher v5.0
 * Routes all button interactions by customId prefix.
 */
import type { ButtonInteraction } from 'discord.js';
import { botLogger } from '../../services/logger.js';
import { Embeds } from '../../utils/embeds.js';

export async function dispatchButton(interaction: ButtonInteraction): Promise<void> {
  const [namespace, action] = interaction.customId.split(':');

  try {
    switch (namespace) {
      case 'ticket': {
        const { handleTicketButton, handleTicketClose, handleTicketClaim } = await import('../handlers/ticketHandler.js');
        if (action === 'open') await handleTicketButton(interaction);
        else if (action === 'close') await handleTicketClose(interaction);
        else if (action === 'claim') await handleTicketClaim(interaction);
        break;
      }

      // ── Bewerbungs-Buttons (Annehmen / Ablehnen / Warteliste) ────────────
      // ── Support Voice Buttons ─────────────────────────────────────────────
      case 'support': {
        const { handleSupportClaim, handleSupportIgnore, handleSupportClose, handleSupportTranscript } =
          await import('../commands/support/supportSetup.js');

        const parts = interaction.customId.split(':');
        // support:claim:sessionId:userId
        // support:ignore:sessionId
        // support:close:voiceChId:textChId
        // support:transcript:guildId:sessionId

        if (action === 'claim') {
          await handleSupportClaim(interaction, parts[2], parts[3]);
        } else if (action === 'ignore') {
          await handleSupportIgnore(interaction, parts[2]);
        } else if (action === 'close') {
          await handleSupportClose(interaction, parts[2], parts[3]);
        } else if (action === 'transcript') {
          await handleSupportTranscript(interaction, parts[2], parts[3]);
        }
        break;
      }

      case 'apply': {
        const { handleApplicationDecision } = await import('../commands/applications/bewerbungSetup.js');
        const parts = interaction.customId.split(':'); // apply:accept:123
        const decision = parts[1] as 'accepted' | 'denied' | 'consider';
        const appId = parts[2];
        if (decision && appId) await handleApplicationDecision(interaction, decision, appId);
        break;
      }

      // ── Server Builder v2.0 ──────────────────────────────────────────────
      case 'serverbuilder': {
        const {
          handleOpenModal,
          handleBuildConfirm,
          handleEditPrompt,
          handleRegenerate,
          handleCancel,
        } = await import('../handlers/serverBuilderV2.js');

        if (action === 'open_modal')     await handleOpenModal(interaction);
        else if (action === 'build_confirm') await handleBuildConfirm(interaction);
        else if (action === 'build_delete')  { const { handleBuildExecute } = await import('../handlers/serverBuilderV2.js'); await handleBuildExecute(interaction, true); }
        else if (action === 'build_add')     { const { handleBuildExecute } = await import('../handlers/serverBuilderV2.js'); await handleBuildExecute(interaction, false); }
        else if (action === 'edit_prompt')   await handleEditPrompt(interaction);
        else if (action === 'regenerate')    await handleRegenerate(interaction);
        else if (action === 'cancel')        await handleCancel(interaction);
        break;
      }

      case 'serverbuild': {
        // Alle serverbuild: Buttons — confirm, edit, regenerate, cancel,
        // delete_all, keep_add
        const { handleServerBuildButton } = await import('../handlers/serverBuildHandler.js');
        await handleServerBuildButton(interaction);
        break;
      }

      // ── Musik Control Buttons ────────────────────────────────────────────
      case 'music': {
        const { handleMusicButton } = await import('../commands/music/musicCommands.js');
        await handleMusicButton(interaction);
        break;
      }

      // ── Welcome Buttons ─────────────────────────────────────────────────
      case 'welcome': {
        if (action === 'rules') {
          // Scroll to rules channel or show it
          const { findChannel } = await import('../systems/autoSetup.js');
          const rulesCh = findChannel(interaction.guild!, 'rules');
          await interaction.reply({
            content: rulesCh
              ? `📋 Unsere Regeln findest du hier: ${rulesCh}`
              : '📋 Schaue bitte in den **#rules** Kanal für unsere Serverregeln.',
            ephemeral: true,
          });
        } else if (action === 'test') {
          // Test welcome message (setwelcome command)
          await interaction.reply({
            content: `✅ **Test erfolgreich!** Die Willkommensnachricht wird neuen Mitgliedern so angezeigt.`,
            ephemeral: true,
          });
        } else {
          await interaction.deferUpdate();
        }
        break;
      }

      // ── Verify Button ────────────────────────────────────────────────────
      case 'verify': {
        if (action === 'click') {
          const { cacheGet } = await import('../../services/redisCache.js');
          const config = await cacheGet<{ memberRoleId?: string }>(
            `nexus:v5:guild:${interaction.guildId}:config`,
          );
          const memberRole = config?.memberRoleId
            ? interaction.guild?.roles.cache.get(config.memberRoleId)
            : interaction.guild?.roles.cache.find(r =>
                ['member', 'mitglied', 'verified', 'user'].some(n =>
                  r.name.toLowerCase().includes(n),
                ),
              );

          const member = interaction.member as import('discord.js').GuildMember;
          if (memberRole && !member.roles.cache.has(memberRole.id)) {
            await member.roles.add(memberRole, 'Nexus Auto-Verify').catch(() => {});
            await interaction.reply({
              content: `✅ **Verifizierung erfolgreich!** Du hast die Rolle ${memberRole} erhalten und Zugang zu allen Kanälen.`,
              ephemeral: true,
            });
          } else if (memberRole && member.roles.cache.has(memberRole.id)) {
            await interaction.reply({
              content: '✅ Du bist bereits verifiziert!',
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content:
                '✅ **Verifizierung registriert!**\nKontaktiere bitte ein Teammitglied wenn du noch keinen Zugriff hast.',
              ephemeral: true,
            });
          }
        }
        break;
      }

      // ── Autosetup Buttons (aus scan-Aktion) ──────────────────────────────
      case 'autosetup': {
        await interaction.deferUpdate();
        const { runAutoSetup, buildSetupResultEmbed, scanAllChannels } =
          await import('../systems/autoSetup.js');
        if (action === 'full') {
          const result = await runAutoSetup(interaction.guild!, true);
          await interaction.editReply({ embeds: [buildSetupResultEmbed(result)], components: [] });
        } else if (action === 'missing') {
          const channels = scanAllChannels(interaction.guild!);
          // Erstelle fehlende Kanäle
          const { ChannelType, PermissionFlagsBits } = await import('discord.js');
          const created: string[] = [];
          const missing = [
            { key: 'rules',         name: '📋-rules',         type: ChannelType.GuildText, perms: true },
            { key: 'welcome',       name: '👋-welcome',       type: ChannelType.GuildText, perms: false },
            { key: 'logs',          name: '📋-nexus-logs',    type: ChannelType.GuildText, perms: true },
            { key: 'announcements', name: '📢-announcements', type: ChannelType.GuildText, perms: true },
          ] as const;
          for (const def of missing) {
            if (!channels[def.key as keyof typeof channels]) {
              try {
                await interaction.guild!.channels.create({
                  name: def.name,
                  type: def.type,
                  permissionOverwrites: def.perms
                    ? [{ id: interaction.guild!.roles.everyone, deny: [PermissionFlagsBits.SendMessages] }]
                    : undefined,
                  reason: 'Nexus Auto-Setup — Fehlende Kanäle',
                });
                created.push(`✅ \`${def.name}\``);
                await new Promise(r => setTimeout(r, 400));
              } catch (err) {
                created.push(`❌ \`${def.name}\` — ${(err as Error).message}`);
              }
            }
          }
          const { EmbedBuilder } = await import('discord.js');
          const { NexusColors } = await import('../../utils/embeds.js');
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(NexusColors.success)
                .setTitle('🛠️ Fehlende Kanäle erstellt')
                .setDescription(created.length > 0 ? created.join('\n') : '✅ Keine fehlenden Kanäle!')
                .setTimestamp(),
            ],
            components: [],
          });
        }
        break;
      }

      // ── Suggest Buttons (Abstimmung) ────────────────────────────────────
      case 'suggest': {
        // Upvote/Downvote — einfache Zähler in Embed aktualisieren
        await interaction.deferUpdate();
        const embed = interaction.message.embeds[0];
        if (!embed) break;

        const fields = [...(embed.fields ?? [])];
        const upIdx   = fields.findIndex(f => f.name.includes('Dafür'));
        const downIdx = fields.findIndex(f => f.name.includes('Dagegen'));

        if (action === 'upvote' && upIdx >= 0) {
          const cur = parseInt(fields[upIdx].value.replace(/`/g, '')) || 0;
          fields[upIdx] = { ...fields[upIdx], value: `\`${cur + 1}\`` };
        } else if (action === 'downvote' && downIdx >= 0) {
          const cur = parseInt(fields[downIdx].value.replace(/`/g, '')) || 0;
          fields[downIdx] = { ...fields[downIdx], value: `\`${cur + 1}\`` };
        }

        const { EmbedBuilder } = await import('discord.js');
        const updated = EmbedBuilder.from(embed).setFields(fields);
        await interaction.editReply({ embeds: [updated] });
        break;
      }

      case 'clear':
        // clear:confirm und clear:cancel werden via awaitMessageComponent
        // direkt im /clear-Command-Handler verarbeitet — hier nichts tun.
        break;

      case 'confirm': {
        await interaction.deferUpdate();
        break;
      }

      default:
        botLogger.debug({ customId: interaction.customId }, 'Unhandled button interaction');
        await interaction.reply({ embeds: [Embeds.error('Unbekannte Aktion', 'Diese Schaltfläche ist nicht mehr aktiv.')], ephemeral: true });
    }
  } catch (err) {
    botLogger.error({ err, customId: interaction.customId }, 'Button handler error');
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ embeds: [Embeds.error('Fehler', 'Ein Fehler ist aufgetreten.')], ephemeral: true }).catch(() => {});
    }
  }
}
