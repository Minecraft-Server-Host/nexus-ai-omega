/**
 * Nexus AI Omega — /defcon Command v5.0
 */
import {
  SlashCommandBuilder, PermissionFlagsBits,
  type ChatInputCommandInteraction, EmbedBuilder,
} from 'discord.js';
import { securityManager, DEFCON_META } from '../../../security-center/securityManager.js';
import { NexusColors } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';
import type { DefconLevel } from '../../../types/index.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('defcon')
    .setDescription('🛡️ DEFCON-Level anzeigen oder setzen')
    .addIntegerOption(o =>
      o.setName('level')
        .setDescription('1 (Notfall) bis 5 (Normal)')
        .setMinValue(1).setMaxValue(5),
    )
    .addStringOption(o =>
      o.setName('grund').setDescription('Begründung').setMaxLength(300),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const newLevel = interaction.options.getInteger('level') as DefconLevel | null;
    const grund    = interaction.options.getString('grund') ?? 'Manuell gesetzt';
    const guild    = interaction.guild!;

    if (newLevel) {
      await securityManager.setDefcon(guild.id, newLevel, grund);
    }

    const current = await securityManager.getDefcon(guild.id);
    const meta    = DEFCON_META[current];
    const barColors = [0xdc2626, 0xf43f5e, 0xf97316, 0xfbbf24, 0x06ffa5];
    const defconBar = ['🔴', '🟠', '🟡', '🟢', '🟢'];

    const embed = new EmbedBuilder()
      .setColor(barColors[current - 1] as import('discord.js').ColorResolvable)
      .setTitle(`🛡️ DEFCON ${current} — ${meta.name}`)
      .setDescription(`> ${meta.description}`)
      .addFields(
        {
          name: '📊 DEFCON-Übersicht',
          value:
            `${current === 5 ? '▶️' : '⬛'} \`DEFCON 5\` 🟢 — NORMAL   — Standardbetrieb\n` +
            `${current === 4 ? '▶️' : '⬛'} \`DEFCON 4\` 🟡 — ELEVATED — Erhöhte Überwachung\n` +
            `${current === 3 ? '▶️' : '⬛'} \`DEFCON 3\` 🟠 — HIGH     — AutoMod maximiert\n` +
            `${current === 2 ? '▶️' : '⬛'} \`DEFCON 2\` 🔴 — CRITICAL — Anti-Raid aktiv\n` +
            `${current === 1 ? '▶️' : '⬛'} \`DEFCON 1\` ⚫ — PANIC    — Notfall-Lockdown`,
          inline: false,
        },
        { name: '🏰 Server',  value: guild.name,                        inline: true },
        { name: '🛡️ Status', value: `${defconBar[current - 1]} DEFCON ${current}`, inline: true },
        ...(newLevel ? [{ name: '📝 Grund', value: grund, inline: false }] : []),
      )
      .setFooter({ text: `Nexus AI Omega v5 • DEFCON-System • Nutze /defcon level:1-5` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: !newLevel });
  },
};

export default command;
