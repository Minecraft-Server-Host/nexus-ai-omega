/**
 * Nexus AI Omega — /ai Command v5.2
 * Universal KI-System — 14 Provider · 20 Module · Kontext-Memory
 */
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { aiEngine }     from '../../../ai-center/aiEngine.js';
import { Embeds }       from '../../../utils/embeds.js';
import { statsAggregator } from '../../../global/statisticsAggregator.js';
import type { NexusCommand } from '../../events/interactionCreate.js';
import { AI_MODULES }   from '../../../types/index.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('🤖 Nexus KI — Universal AI System mit 14 Providern und 20 Modulen')
    .addStringOption(o =>
      o.setName('prompt')
        .setDescription('Deine Frage oder Aufgabe für die KI')
        .setRequired(true)
        .setMaxLength(4000),
    )
    .addStringOption(o =>
      o.setName('module')
        .setDescription('Spezialisiertes KI-Modul auswählen')
        .addChoices(
          { name: '🔍 Hybrid AutoMod',        value: 'HYBRID_AUTOMOD'          },
          { name: '🏗️ Server Builder',         value: 'AI_SERVER_BUILDER'       },
          { name: '🎫 Ticket-Assistent',       value: 'AI_TICKET_SYSTEM'        },
          { name: '🛡️ Security Advisor',       value: 'AI_SECURITY_ADVISOR'     },
          { name: '👥 Community Manager',      value: 'AI_COMMUNITY_MANAGER'    },
          { name: '📊 Analytics',              value: 'AI_ANALYTICS'            },
          { name: '💻 Code Assistant',         value: 'AI_CODE_ASSISTANT'       },
          { name: '✨ Embed Builder',          value: 'AI_EMBED_BUILDER'        },
          { name: '🐞 Bug Detector',           value: 'AI_BUG_DETECTOR'         },
          { name: '🎭 Role Designer',          value: 'AI_ROLE_DESIGNER'        },
        ),
    )
    .addStringOption(o =>
      o.setName('provider')
        .setDescription('KI-Provider auswählen (Standard: Auto)')
        .addChoices(
          { name: '🔮 Auto — Bester verfügbarer',   value: 'auto'       },
          { name: 'OpenAI GPT-4o',                  value: 'openai'     },
          { name: 'Claude 3.5 Sonnet',              value: 'anthropic'  },
          { name: 'Google Gemini 1.5 Pro',          value: 'google'     },
          { name: '⚡ Groq Llama 3.3 (schnellster)', value: 'groq'       },
          { name: 'Mistral Large',                  value: 'mistral'    },
          { name: 'DeepSeek Chat',                  value: 'deepseek'   },
          { name: 'xAI Grok Beta',                  value: 'xai'        },
          { name: 'Cohere Command-R+',              value: 'cohere'     },
          { name: 'OpenRouter (universal)',          value: 'openrouter' },
          { name: '🆓 Ollama (lokal)',               value: 'ollama'     },
        ),
    )
    .addStringOption(o =>
      o.setName('model')
        .setDescription('Spezifisches Modell (optional, Autocomplete)')
        .setAutocomplete(true),
    )
    .addBooleanOption(o =>
      o.setName('ephemeral')
        .setDescription('Antwort nur für dich sichtbar? (Standard: Nein)'),
    ),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const prompt    = interaction.options.getString('prompt', true);
    const module    = (interaction.options.getString('module') ?? 'AI_CODE_ASSISTANT') as typeof AI_MODULES[number];
    const provider  = (interaction.options.getString('provider') ?? 'auto') as Parameters<typeof aiEngine.infer>[0]['provider'];
    const model     = interaction.options.getString('model') ?? undefined;
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;

    await interaction.deferReply({ ephemeral });

    try {
      const result = await aiEngine.infer({
        module,
        prompt,
        guildId:  interaction.guildId ?? undefined,
        userId:   interaction.user.id,
        provider,
        model,
        conversationId: `${interaction.user.id}:${interaction.guildId ?? 'dm'}`,
      });

      statsAggregator.inc('aiRequestsToday');

      // Kein Provider konfiguriert → hilfreiche Anleitung
      if (result.provider === 'nexus-mock' || !result.success) {
        await interaction.editReply({ embeds: [Embeds.noProvider()] });
        return;
      }

      const embed = Embeds.ai(
        module.replace(/_/g, ' '),
        String(result.text),
        {
          provider: result.provider,
          model:    result.model,
          latencyMs: Math.round(result.latencyMs),
          tokensOut: result.tokensOut,
          cached:   result.cached,
        },
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({
        embeds: [Embeds.error(
          'KI-Fehler',
          `Die KI konnte deine Anfrage nicht verarbeiten.\n` +
          `\`${(err as Error).message}\`\n\n` +
          `Versuche einen anderen Provider mit \`/ai provider:groq\``,
        )],
      });
    }
  },
};

export default command;
