/**
 * Nexus AI Omega — Select Menu Dispatcher v5.0
 */
import type { StringSelectMenuInteraction } from 'discord.js';
import { botLogger } from '../../services/logger.js';

export async function dispatchSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const [namespace] = interaction.customId.split(':');
  try {
    switch (namespace) {
      case 'help': {
        const { handleHelpSelect } = await import('../commands/utility/help.js');
        await handleHelpSelect(interaction);
        break;
      }

      // ── Bewerbungs-Position auswählen ─────────────────────────────────────
      case 'apply': {
        const { handlePositionSelect } = await import('../commands/applications/bewerbungSetup.js');
        await handlePositionSelect(interaction);
        break;
      }

      default:
        botLogger.debug({ customId: interaction.customId }, 'Unhandled select menu');
    }
  } catch (err) {
    botLogger.error({ err, customId: interaction.customId }, 'Select handler error');
  }
}
