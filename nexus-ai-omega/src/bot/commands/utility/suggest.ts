/**
 * Nexus AI Omega — /suggest Command v5.0
 */
import {
  SlashCommandBuilder, type ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { Embeds, NexusColors } from '../../../utils/embeds.js';
import { cacheGet } from '../../../services/redisCache.js';
import { findChannel } from '../../systems/autoSetup.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('💡 Einen Vorschlag oder eine Idee einreichen')
    .addStringOption(o =>
      o.setName('idee').setDescription('Deine Idee oder dein Vorschlag').setRequired(true).setMaxLength(1000),
    )
    .addStringOption(o =>
      o.setName('details').setDescription('Weitere Details (optional)').setMaxLength(500),
    )
    .setDMPermission(false),

  cooldown: 60, // 1 Vorschlag pro Minute

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const idee    = interaction.options.getString('idee', true);
    const details = interaction.options.getString('details');
    const guild   = interaction.guild!;

    // Vorschlags-Kanal finden
    const config  = await cacheGet<{ suggestionChannelId?: string }>(
      `nexus:v5:guild:${guild.id}:config`,
    );
    const channel = config?.suggestionChannelId
      ? guild.channels.cache.get(config.suggestionChannelId) as import('discord.js').TextChannel | undefined
      : (findChannel(guild, 'suggestions') ?? undefined);

    if (!channel) {
      await interaction.reply({
        embeds: [Embeds.error(
          'Kein Vorschlags-Kanal',
          '> Kein Vorschlags-Kanal gefunden.\n' +
          '> Bitte richte einen mit `/autosetup aktion:Vorschlags-System einrichten` ein.',
        )],
        ephemeral: true,
      });
      return;
    }

    // Vorschlags-Embed erstellen
    const suggestEmbed = new EmbedBuilder()
      .setColor(NexusColors.info)
      .setTitle('💡 Neuer Vorschlag')
      .setDescription(`> ${idee}`)
      .setAuthor({
        name:    interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    if (details) {
      suggestEmbed.addFields({ name: '📋 Details', value: details, inline: false });
    }

    suggestEmbed.addFields(
      { name: '👍 Dafür',  value: '`0`', inline: true },
      { name: '👎 Dagegen', value: '`0`', inline: true },
      { name: '📊 Status', value: '`Offen`', inline: true },
    );

    suggestEmbed.setFooter({ text: `Nexus AI Omega v5 • Vorschlags-System • ${guild.name}` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('suggest:upvote')
        .setLabel('👍  Dafür')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('suggest:downvote')
        .setLabel('👎  Dagegen')
        .setStyle(ButtonStyle.Danger),
    );

    try {
      const msg = await channel.send({ embeds: [suggestEmbed], components: [row] });
      // Thread erstellen für Diskussion
      if ('threads' in channel) {
        await (channel as import('discord.js').TextChannel)
          .threads
          .create({
            name:    `💬 Diskussion: ${idee.slice(0, 50)}`,
            startMessage: msg.id,
            reason: 'Nexus Suggest — Diskussions-Thread',
          })
          .catch(() => {});
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.success)
            .setTitle('✅ Vorschlag eingereicht!')
            .setDescription(
              `> Dein Vorschlag wurde in ${channel} eingereicht.\n` +
              `> Die Community kann jetzt abstimmen! 🗳️`,
            )
            .setFooter({ text: 'Nexus AI Omega v5 • Vorschläge' })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({
        embeds: [Embeds.error('Fehler', `Vorschlag konnte nicht gesendet werden: ${(err as Error).message}`)],
        ephemeral: true,
      });
    }
  },
};

export default command;
