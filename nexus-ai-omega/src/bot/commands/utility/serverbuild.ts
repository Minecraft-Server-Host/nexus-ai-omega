/**
 * Nexus AI Omega — /serverbuild Command v5.1
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Flow:
 *  1. /serverbuild theme:"..." style:"..." → KI-Plan generieren
 *  2. Preview-Embed mit [✅ Erstellen] [✏️ Bearbeiten] [🔄 Neu] [❌ Abbrechen]
 *  3. Bei [✅ Erstellen]: Zeigt vorhandene Kanäle/Kategorien/Voice
 *     und fragt: [🗑️ Alles löschen & neu bauen] [➕ Behalten & hinzufügen] [❌ Abbrechen]
 *  4. Baut den Server mit Live-Fortschritt
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { handleServerBuildCommand } from '../../handlers/serverBuildHandler.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('serverbuild')
    .setDescription('🏗️ KI Server Builder — Generiert einen kompletten Discord-Server aus deiner Idee')
    .addStringOption(o =>
      o
        .setName('theme')
        .setDescription('Deine Server-Idee (z.B. "Valorant Esports 5000 Spieler" oder "Anime Community deutsch")')
        .setRequired(true)
        .setMaxLength(300),
    )
    .addStringOption(o =>
      o
        .setName('style')
        .setDescription('Design-Stil des Servers')
        .addChoices(
          { name: '🔮 Auto — KI entscheidet',    value: 'auto' },
          { name: '🎮 Gaming',                    value: 'gaming' },
          { name: '⚡ Esports',                   value: 'esports' },
          { name: '🌸 Anime',                     value: 'anime' },
          { name: '🌆 Modern',                    value: 'modern' },
          { name: '⚫ Dark & Minimal',             value: 'dark' },
          { name: '🌐 Cyber / Neon',              value: 'cyber' },
          { name: '💎 Luxury',                    value: 'luxury' },
          { name: '💼 Business / Professionell',  value: 'business' },
          { name: '🚀 Futuristisch',              value: 'futuristic' },
          { name: '⛏️ Minecraft',                  value: 'minecraft' },
          { name: '🎵 Musik / Kunst',             value: 'music' },
        ),
    )
    .addStringOption(o =>
      o
        .setName('provider')
        .setDescription('KI-Provider für die Plan-Generierung')
        .addChoices(
          { name: '🔮 Auto (bester verfügbarer)', value: 'auto' },
          { name: 'OpenAI GPT-4o',               value: 'openai' },
          { name: 'Claude 3.5 Sonnet',           value: 'anthropic' },
          { name: 'Google Gemini 1.5 Pro',       value: 'google' },
          { name: 'Groq (schnell)',               value: 'groq' },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleServerBuildCommand(interaction);
  },
};

export default command;
