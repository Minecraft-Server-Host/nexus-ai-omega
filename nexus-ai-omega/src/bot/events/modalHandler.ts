/**
 * Nexus AI Omega — Modal Submit Dispatcher v5.0
 */
import type { ModalSubmitInteraction } from 'discord.js';
import { botLogger } from '../../services/logger.js';
import { Embeds } from '../../utils/embeds.js';

export async function dispatchModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [namespace] = interaction.customId.split(':');

  try {
    switch (namespace) {
      // ── Server Builder v2.0 Modal ─────────────────────────────────────────
      case 'serverbuilder': {
        const { handleModalSubmit } = await import('../handlers/serverBuilderV2.js');
        await handleModalSubmit(interaction);
        break;
      }

      case 'ticket': {
        const { handleTicketModal } = await import('../handlers/ticketHandler.js');
        await handleTicketModal(interaction);
        break;
      }

      // ── Bewerbungs-Modal (von discord-bot-source übernommen) ──────────────
      case 'apply': {
        const { handleApplicationSubmit } = await import('../commands/applications/bewerbungSetup.js');
        await handleApplicationSubmit(interaction);
        break;
      }

      default:
        botLogger.debug({ customId: interaction.customId }, 'Unhandled modal submit');
        await interaction.reply({ embeds: [Embeds.error('Unbekanntes Formular')], ephemeral: true });
    }
  } catch (err) {
    botLogger.error({ err, customId: interaction.customId }, 'Modal handler error');
    if (!interaction.replied) {
      await interaction.reply({ embeds: [Embeds.error('Fehler', 'Das Formular konnte nicht verarbeitet werden.')], ephemeral: true }).catch(() => {});
    }
  }
}
