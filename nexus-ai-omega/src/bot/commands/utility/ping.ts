/**
 * Nexus AI Omega — /ping Command v5.2
 * Zeigt: WS-Latenz, API-Latenz, KI-Provider, RAM, Uptime, Server-Anzahl
 */
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { aiEngine }   from '../../../ai-center/aiEngine.js';
import { pingEmbed }  from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('📡 Nexus Latenz, API-Status & System-Info anzeigen'),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sent = await interaction.reply({ content: '📡 Messe Latenz…', fetchReply: true });

    const apiLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency  = interaction.client.ws.ping;

    const providers      = aiEngine.listProviders();
    const activeProvider = providers.find(p => p.configured && p.id !== 'nexus-mock')?.name ?? '⚠️ Kein Provider';

    await interaction.editReply({
      content: null,
      embeds: [pingEmbed(
        wsLatency,
        apiLatency,
        activeProvider,
        interaction.client.guilds.cache.size,
        process.uptime(),
      )],
    });
  },
};

export default command;
