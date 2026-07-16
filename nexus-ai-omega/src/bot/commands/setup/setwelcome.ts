/**
 * Nexus AI Omega — /setwelcome Command v5.0
 * Willkommens-Kanal manuell setzen oder automatisch erkennen.
 */
import {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
  type ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { Embeds, NexusColors } from '../../../utils/embeds.js';
import { findChannel } from '../../systems/autoSetup.js';
import { cacheGet, cacheSet } from '../../../services/redisCache.js';
import { aiEngine } from '../../../ai-center/aiEngine.js';
import type { NexusCommand } from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('👋 Welcome-Kanal & -Nachricht einrichten')
    .addChannelOption(o =>
      o.setName('kanal')
        .setDescription('Willkommens-Kanal (leer = automatisch erkennen)')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(o =>
      o.setName('nachricht')
        .setDescription('Eigene Willkommensnachricht ({user} = Mention, {server} = Servername, {count} = Mitglieder)')
        .setMaxLength(1000)
    )
    .addBooleanOption(o =>
      o.setName('ki_generieren')
        .setDescription('Soll die KI eine individuelle Nachricht generieren? (Standard: Ja)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const manualChannel = interaction.options.getChannel('kanal') as import('discord.js').TextChannel | null;
    const customMessage = interaction.options.getString('nachricht');
    const useAI = interaction.options.getBoolean('ki_generieren') ?? true;

    // Kanal bestimmen: manuell → auto-scan → error
    let targetChannel = manualChannel ??
      findChannel(guild, 'welcome') ??
      findChannel(guild, 'general');

    if (!targetChannel) {
      await interaction.editReply({
        embeds: [Embeds.error(
          'Kein Kanal gefunden',
          '> Kein Willkommens-Kanal gefunden.\n> Erstelle einen Kanal namens `welcome`, `willkommen` o.ä.\n> Oder gib einen Kanal mit `/setwelcome kanal:#kanal` an.'
        )],
      });
      return;
    }

    // Konfiguration speichern
    const config = await cacheGet<Record<string, unknown>>(`nexus:v5:guild:${guild.id}:config`) ?? {};
    config.welcomeChannelId = targetChannel.id;
    if (customMessage) config.welcomeMessage = customMessage;
    await cacheSet(`nexus:v5:guild:${guild.id}:config`, config, 86_400 * 7);

    // Nachricht generieren
    let messageText = customMessage ??
      `👋 Willkommen {user}! Du bist Mitglied **#{count}** auf **{server}**! Viel Spaß! 🎉`;

    if (useAI && !customMessage) {
      try {
        const aiResult = await aiEngine.infer({
          module: 'AI_COMMUNITY_MANAGER',
          prompt: `Erstelle eine kurze, herzliche Discord-Willkommensnachricht für den Server "${guild.name}" (${guild.memberCount} Mitglieder).
Verwende diese Platzhalter: {user} für den User-Mention, {server} für Servername, {count} für Mitgliederzahl.
Maximal 200 Zeichen. Freundlich, mit passenden Emojis. Deutsch.`,
          guildId: guild.id,
          maxTokens: 100,
          temperature: 0.7,
        });
        if (aiResult.text && aiResult.text.length > 10) {
          messageText = aiResult.text;
        }
      } catch { /* use default */ }
    }

    config.welcomeMessageTemplate = messageText;
    await cacheSet(`nexus:v5:guild:${guild.id}:config`, config, 86_400 * 7);

    // Vorschau senden
    const preview = messageText
      .replace(/\{user\}/g, `@${interaction.user.username}`)
      .replace(/\{server\}/g, guild.name)
      .replace(/\{count\}/g, guild.memberCount.toLocaleString('de-DE'));

    const embed = new EmbedBuilder()
      .setColor(NexusColors.success)
      .setTitle('👋 Welcome-System konfiguriert!')
      .setDescription(
        `> **Kanal:** ${targetChannel}\n` +
        `> **KI-generiert:** ${useAI && !customMessage ? '✅ Ja' : '❌ Nein (manuell)'}\n\n` +
        `> **Vorschau der Nachricht:**\n> ${preview}`
      )
      .addFields({
        name: '📋 Template',
        value: `\`\`\`${messageText.slice(0, 500)}\`\`\``,
        inline: false,
      })
      .setFooter({ text: 'Nexus AI Omega v5 • Welcome System' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('welcome:test')
        .setLabel('🧪 Test-Nachricht senden')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });

    // Bestätigung im Welcome-Kanal
    await (targetChannel as import('discord.js').TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.mint)
          .setTitle('✅ Welcome-System aktiviert')
          .setDescription('> Nexus AI begrüßt neue Mitglieder ab sofort automatisch in diesem Kanal.')
          .setFooter({ text: 'Nexus AI Omega v5 • Welcome System' })
          .setTimestamp(),
      ],
    }).catch(() => {});
  },
};

export default command;
