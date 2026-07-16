/**
 * Nexus AI Omega — Autocomplete Dispatcher v5.0
 */
import type { AutocompleteInteraction } from 'discord.js';
import { botLogger } from '../../services/logger.js';
import { aiEngine } from '../../ai-center/aiEngine.js';

export async function dispatchAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  try {
    const focused = interaction.options.getFocused(true);

    if (interaction.commandName === 'ai' && focused.name === 'model') {
      const provider = interaction.options.getString('provider') ?? 'openai';
      const providers = aiEngine.listProviders();
      const match = providers.find(p => p.id === provider);
      const models = match?.models ?? [];
      const filtered = models
        .filter(m => m.toLowerCase().includes(focused.value.toLowerCase()))
        .slice(0, 25)
        .map(m => ({ name: m, value: m }));
      await interaction.respond(filtered);
      return;
    }

    await interaction.respond([]);
  } catch (err) {
    botLogger.error({ err }, 'Autocomplete error');
    await interaction.respond([]).catch(() => {});
  }
}
