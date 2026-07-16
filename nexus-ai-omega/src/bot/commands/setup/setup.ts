/**
 * Nexus AI Omega — /setup Command v5.0
 * Führt das vollständige Auto-Setup manuell aus.
 */
import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import { runAutoSetup, buildSetupResultEmbed } from '../../systems/autoSetup.js';
import { Embeds } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('🔧 Nexus AI Auto-Setup — Konfiguriert den Server automatisch')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    const waitEmbed = Embeds.loading(
      'Auto-Setup läuft…',
      'Nexus AI scannt deinen Server, erkennt Kanäle und konfiguriert alles automatisch.'
    );
    await interaction.editReply({ embeds: [waitEmbed] });

    const result = await runAutoSetup(interaction.guild!, true);
    const embed = buildSetupResultEmbed(result);
    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
