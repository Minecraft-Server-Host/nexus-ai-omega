/**
 * Nexus AI Omega — /serverbuilder AI Command v2.0 (Complete Redesign)
 * ═══════════════════════════════════════════════════════════════════
 *
 * FLOW:
 *  1. /serverbuilder ai → Zeigt Intro-Embed + [📝 Create AI Server] Button
 *  2. Button-Click      → Öffnet Modal (Server-Beschreibung + Stil)
 *  3. Modal-Submit      → KI analysiert & generiert einzigartigen Plan
 *  4. Preview-Embed     → Vollständige Vorschau aller Kategorien/Kanäle/Rollen
 *  5. Bestätigung       → [✅ Build] [✏️ Edit] [🔄 Regenerate] [❌ Cancel]
 *  6. Build-Process     → Schritt-für-Schritt Erstellung mit Live-Progress
 *  7. Abschluss         → Vollständiger Bericht
 *
 * ═══════════════════════════════════════════════════════════════════
 */
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { NexusColors } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('serverbuilder')
    .setDescription('🏗️ KI Server Builder 2.0 — Beschreibe deine Idee, KI baut alles automatisch')
    .addSubcommand(sub =>
      sub
        .setName('ai')
        .setDescription('🤖 KI-gestützter Server-Builder — vollständig personalisiert'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ai') {
      // Intro-Embed mit Button → Modal → KI → Preview → Build
      const introEmbed = new EmbedBuilder()
        .setColor(NexusColors.primary)
        .setTitle('🏗️  Nexus AI Server Builder 2.0')
        .setDescription(
          '> **Beschreibe einfach deine Server-Idee — die KI baut alles automatisch.**\n\n' +
          '> Die KI analysiert deinen Prompt und generiert:\n' +
          '> ├── 📂 Kategorien & Kanäle (Text, Voice, Forum)\n' +
          '> ├── 🎭 Rollen mit Farben & Berechtigungen\n' +
          '> ├── 🔒 Vollständige Permission-Struktur\n' +
          '> ├── 🎨 Individuelles Design & Farbschema\n' +
          '> └── ✨ Alles einzigartig — kein Template!\n\n' +
          '> **Klicke unten um zu starten:**',
        )
        .addFields(
          { name: '⚡ Schnell',    value: '< 60 Sekunden',        inline: true },
          { name: '🤖 KI-Power',  value: 'Groq · Gemini · GPT-4', inline: true },
          { name: '🎯 Einzigartig', value: 'Kein Template',        inline: true },
        )
        .setFooter({ text: 'Nexus AI Omega v5 • Server Builder 2.0 • Powered by AI' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('serverbuilder:open_modal')
          .setLabel('📝  Create AI Server')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setLabel('📖 Anleitung')
          .setURL('https://discord.gg/kzaMp69dD')
          .setStyle(ButtonStyle.Link),
      );

      await interaction.reply({ embeds: [introEmbed], components: [row] });
    }
  },
};

export default command;
