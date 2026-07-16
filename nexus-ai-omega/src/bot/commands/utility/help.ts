/**
 * Nexus AI Omega — /help Command v5.2
 * 52+ Commands in 12 Kategorien — vollständig und aktuell.
 * Select-Menü mit allen Kategorien, sofort navigierbar.
 */
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { helpEmbed } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const CATEGORIES = [
  { value: 'home',       label: 'Übersicht',          description: 'Alle Kategorien auf einen Blick',       emoji: '🏠' },
  { value: 'ai',         label: 'KI-System',           description: '14 Provider · 20 Module · Kontext',     emoji: '🤖' },
  { value: 'tickets',    label: 'Ticket-System',       description: '6 Typen · KI-Analyse · Rate-Limit',     emoji: '🎫' },
  { value: 'bewerbung',  label: 'Bewerbungs-System',   description: 'KI-Score · 6 Positionen · DM-Ping',     emoji: '📋' },
  { value: 'support',    label: 'Support-Warteraum',   description: 'Voice · TTS · Musik · Team-Ping',       emoji: '🎤' },
  { value: 'moderation', label: 'Moderation',          description: 'Ban · Kick · Warn · DEFCON · AutoMod',  emoji: '🛡️' },
  { value: 'setup',      label: 'Setup & Config',      description: 'Auto-Setup · Welcome · Rules · Logs',   emoji: '⚙️' },
  { value: 'economy',    label: 'Economy-System',      description: 'Coins · Shop · Inventar · Daily',       emoji: '💰' },
  { value: 'fun',        label: 'Fun & Utility',       description: 'Poll · Giveaway · Rank · Custom Cmds',  emoji: '🎮' },
  { value: 'info',       label: 'Info-Commands',       description: 'Userinfo · Serverinfo · Avatar',        emoji: 'ℹ️' },
  { value: 'admin',      label: 'Admin & Team',        description: 'Clear · Global Ban · Team-System',      emoji: '🔑' },
  { value: 'builder',    label: 'Server Builder',      description: 'KI baut komplette Discord-Server',      emoji: '🏗️' },
  { value: 'musik',     label: 'Musik-System',         description: 'YouTube · Spotify · Queue · Filter',    emoji: '🎵' },
] as const;

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📖 Nexus AI Omega — Alle 52+ Commands & Features')
    .addStringOption(o =>
      o
        .setName('kategorie')
        .setDescription('Direkt zu einer Kategorie springen')
        .addChoices(...CATEGORIES.map(c => ({ name: `${c.emoji} ${c.label}`, value: c.value }))),
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const category = interaction.options.getString('kategorie') ?? 'home';

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help:category')
      .setPlaceholder('📖 Kategorie wählen…')
      .addOptions(
        CATEGORIES.map(c => ({
          value:       c.value,
          label:       c.label,
          description: c.description,
          emoji:       c.emoji,
        })),
      );

    await interaction.reply({
      embeds:     [helpEmbed(category)],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
    });
  },
};

export async function handleHelpSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const category = interaction.values[0] ?? 'home';
  await interaction.update({ embeds: [helpEmbed(category)] });
}

export default command;
