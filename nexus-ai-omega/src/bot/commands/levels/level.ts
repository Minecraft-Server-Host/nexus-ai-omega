/**
 * Nexus AI Omega — /level Command v5.0
 */
import {
  SlashCommandBuilder, type ChatInputCommandInteraction,
} from 'discord.js';
import { cacheGet } from '../../../services/redisCache.js';
import { levelEmbed } from '../../../utils/embeds.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

function calcLevel(xp: number): number {
  return Math.floor(0.1 * Math.sqrt(xp));
}
function calcXpForLevel(level: number): number {
  return Math.pow(level / 0.1, 2);
}

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('📈 Dein Level & XP auf diesem Server anzeigen')
    .addUserOption(o =>
      o.setName('user').setDescription('Anderen User anzeigen (optional)'),
    )
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target  = interaction.options.getUser('user') ?? interaction.user;
    const guild   = interaction.guild!;
    const xpKey   = `nexus:v5:xp:${guild.id}:${target.id}`;
    const xp      = (await cacheGet<number>(xpKey)) ?? 0;
    const level   = calcLevel(xp);
    const nextXp  = Math.ceil(calcXpForLevel(level + 1));
    const current = xp - Math.floor(calcXpForLevel(level));
    const needed  = nextXp - Math.floor(calcXpForLevel(level));

    // Simple rank: compare XP with others (approximation since we have in-memory only)
    const rank = 1; // Placeholder — full leaderboard needs DB

    const embed = levelEmbed(
      target.username,
      target.displayAvatarURL({ size: 256 }),
      level,
      current,
      needed,
      rank,
      guild.name,
    );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
