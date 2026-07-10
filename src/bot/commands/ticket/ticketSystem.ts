/**
 * Nexus AI Omega — Ticket-System v1.0
 * Auto-detects a "ticket" channel in every guild, posts a dashboard embed
 * with Bewerbung/Support buttons, collects info via select-menu + modals,
 * creates private ticket channels, and attaches an AI analysis.
 */
import {
  Client,
  Events,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type TextChannel,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type CategoryChannel
} from 'discord.js';
import { logger } from '../../../services/logger.js';
import { aiEngine } from '../../../ai-center/aiEngine.js';

const TICKET_CATEGORY_NAME = '🎫 Tickets';
const OWNER_TOPIC_PREFIX = 'nexus-ticket-owner:';
const STAFF_ROLE_ID = process.env.DISCORD_TICKET_STAFF_ROLE_ID;

const CUSTOM_IDS = {
  OPEN_BEWERBUNG: 'nexus_ticket_open_bewerbung',
  OPEN_SUPPORT: 'nexus_ticket_open_support',
  POSITION_SELECT: 'nexus_ticket_position_select',
  MODAL_BEWERBUNG: 'nexus_ticket_modal_bewerbung',
  MODAL_SUPPORT: 'nexus_ticket_modal_support',
  CLOSE: 'nexus_ticket_close'
} as const;

const POSITIONS: Record<string, string> = {
  moderator: '🛡️ Moderator',
  support: '🎧 Support-Team',
  event: '🎉 Event-Team',
  content: '🎬 Content Creator',
  dev: '💻 Entwickler',
  sonstiges: '✨ Sonstiges'
};

/** Registers the ticket-dashboard system on an existing discord.js Client. */
export function registerTicketSystem(client: Client): void {
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      await ensureTicketDashboard(guild).catch(e =>
        logger.warn({ err: e.message, guildId: guild.id }, 'ticket-system: dashboard bootstrap failed')
      );
    }
  });

  client.on(Events.GuildCreate, async guild => {
    await ensureTicketDashboard(guild).catch(e =>
      logger.warn({ err: e.message, guildId: guild.id }, 'ticket-system: dashboard setup on join failed')
    );
  });

  client.on(Events.ChannelCreate, async channel => {
    if (channel.type !== ChannelType.GuildText) return;
    if (!isTicketChannelName(channel.name)) return;
    await postDashboard(channel as TextChannel).catch(e =>
      logger.warn({ err: e.message, channelId: channel.id }, 'ticket-system: dashboard post on new channel failed')
    );
  });

  client.on(Events.InteractionCreate, async interaction => {
    try {
      if (interaction.isButton()) {
        if (interaction.customId === CUSTOM_IDS.OPEN_BEWERBUNG) return handleOpenBewerbung(interaction);
        if (interaction.customId === CUSTOM_IDS.OPEN_SUPPORT) return handleOpenSupport(interaction);
        if (interaction.customId === CUSTOM_IDS.CLOSE) return handleCloseTicket(interaction);
      } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === CUSTOM_IDS.POSITION_SELECT) return handlePositionSelected(interaction);
      } else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith(CUSTOM_IDS.MODAL_BEWERBUNG)) return handleBewerbungModal(interaction);
        if (interaction.customId === CUSTOM_IDS.MODAL_SUPPORT) return handleSupportModal(interaction);
      }
    } catch (e: any) {
      logger.error({ err: e.message, customId: (interaction as any).customId }, 'ticket-system: interaction failed');
      if ((interaction.isRepliable()) && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Da ist etwas schiefgelaufen. Bitte versuche es erneut.', ephemeral: true }).catch(() => {});
      }
    }
  });
}

/** Scans every guild the bot is in and (re)creates dashboards where needed — used for manual re-sync. */
export async function scanAllGuildsForTicketChannels(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    await ensureTicketDashboard(guild).catch(e =>
      logger.warn({ err: e.message, guildId: guild.id }, 'ticket-system: manual scan failed')
    );
  }
}

function isTicketChannelName(name: string): boolean {
  return /ticket/i.test(name);
}

async function ensureTicketDashboard(guild: Guild): Promise<void> {
  await guild.channels.fetch();
  const ticketChannel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && isTicketChannelName(c.name)
  ) as TextChannel | undefined;
  if (!ticketChannel) return;
  await postDashboard(ticketChannel);
}

async function postDashboard(channel: TextChannel): Promise<void> {
  const pinned = await channel.messages.fetchPinned().catch(() => null);
  const alreadyPosted = pinned?.some(
    m => m.author.id === channel.client.user?.id && m.components.length > 0 &&
      (m.components as any[]).some(row => row.components?.some((c: any) => c.customId === CUSTOM_IDS.OPEN_BEWERBUNG))
  );
  if (alreadyPosted) return;

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('🎫 Nexus Support & Bewerbungs-Center')
    .setDescription(
      'Willkommen im Ticket-Bereich! Wähle unten aus, worum es geht — wir melden uns so schnell wie möglich.\n\n' +
      '**📋 Bewerbung** — du willst dem Team beitreten? Wähle deine Wunschposition und stell dich vor.\n' +
      '**🎧 Support** — technisches Problem, Frage oder Anliegen? Beschreib uns kurz worum es geht.'
    )
    .setFooter({ text: 'Nexus AI Omega • Ticket-System' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_IDS.OPEN_BEWERBUNG).setLabel('Bewerbung').setEmoji('📋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_IDS.OPEN_SUPPORT).setLabel('Support').setEmoji('🎧').setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  await msg.pin().catch(e => logger.warn({ err: e.message, channelId: channel.id }, 'ticket-system: pin dashboard failed'));
}

async function handleOpenBewerbung(interaction: ButtonInteraction): Promise<void> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.POSITION_SELECT)
    .setPlaceholder('Wähle deine Wunschposition')
    .addOptions(Object.entries(POSITIONS).map(([value, label]) => ({ label, value })));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  await interaction.reply({
    content: 'Für welche Position möchtest du dich bewerben?',
    components: [row],
    ephemeral: true
  });
}

async function handlePositionSelected(interaction: StringSelectMenuInteraction): Promise<void> {
  const position = interaction.values[0];
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.MODAL_BEWERBUNG}:${position}`)
    .setTitle(`Bewerbung — ${POSITIONS[position] ?? position}`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('Name / Ingame-Name').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('alter').setLabel('Alter').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('grund').setLabel('Warum möchtest du dich bewerben?').setStyle(TextInputStyle.Paragraph).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('erfahrung').setLabel('Relevante Erfahrung').setStyle(TextInputStyle.Paragraph).setRequired(false)
    )
  );

  await interaction.showModal(modal);
}

async function handleOpenSupport(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId(CUSTOM_IDS.MODAL_SUPPORT).setTitle('Support-Ticket eröffnen');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('Name / Ingame-Name').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('grund').setLabel('Worum geht es?').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('beschreibung').setLabel('Beschreibung deines Anliegens').setStyle(TextInputStyle.Paragraph).setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

async function handleBewerbungModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const position = interaction.customId.split(':')[1] ?? 'sonstiges';
  const name = interaction.fields.getTextInputValue('name');
  const alter = interaction.fields.getTextInputValue('alter');
  const grund = interaction.fields.getTextInputValue('grund');
  const erfahrung = interaction.fields.getTextInputValue('erfahrung') || '—';

  const infoEmbed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(`📋 Bewerbung — ${POSITIONS[position] ?? position}`)
    .addFields(
      { name: 'Name', value: name, inline: true },
      { name: 'Alter', value: alter, inline: true },
      { name: 'Position', value: POSITIONS[position] ?? position, inline: true },
      { name: 'Warum bewirbst du dich?', value: grund },
      { name: 'Erfahrung', value: erfahrung }
    )
    .setFooter({ text: `Bewerber: ${interaction.user.tag}` })
    .setTimestamp();

  const prompt =
    `Analysiere folgende Team-Bewerbung für die Position "${POSITIONS[position] ?? position}" und antworte NUR in diesem Format:\n` +
    `Zusammenfassung: <1-2 Sätze>\nPriorität: <Niedrig|Mittel|Hoch>\nVorschlag: <kurze Handlungsempfehlung>\n\n` +
    `Name: ${name}\nAlter: ${alter}\nGrund: ${grund}\nErfahrung: ${erfahrung}`;

  await createTicketChannel(interaction, `bewerbung-${sanitize(name)}`, infoEmbed, prompt);
}

async function handleSupportModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.fields.getTextInputValue('name');
  const grund = interaction.fields.getTextInputValue('grund');
  const beschreibung = interaction.fields.getTextInputValue('beschreibung');

  const infoEmbed = new EmbedBuilder()
    .setColor(0x06ffa5)
    .setTitle('🎧 Support-Anfrage')
    .addFields(
      { name: 'Name', value: name, inline: true },
      { name: 'Thema', value: grund, inline: true },
      { name: 'Beschreibung', value: beschreibung }
    )
    .setFooter({ text: `Angefragt von: ${interaction.user.tag}` })
    .setTimestamp();

  const prompt =
    `Analysiere folgende Support-Anfrage und antworte NUR in diesem Format:\n` +
    `Zusammenfassung: <1-2 Sätze>\nPriorität: <Niedrig|Mittel|Hoch>\nVorschlag: <kurze Handlungsempfehlung fürs Team>\n\n` +
    `Name: ${name}\nThema: ${grund}\nBeschreibung: ${beschreibung}`;

  await createTicketChannel(interaction, `support-${sanitize(name)}`, infoEmbed, prompt);
}

async function createTicketChannel(
  interaction: ModalSubmitInteraction,
  baseName: string,
  infoEmbed: EmbedBuilder,
  aiPrompt: string
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: '❌ Dieses Ticket kann nur in einem Server erstellt werden.' });
    return;
  }

  const category = await ensureTicketCategory(guild);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: guild.members.me!.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
    }
  ];
  if (STAFF_ROLE_ID) {
    overwrites.push({
      id: STAFF_ROLE_ID,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  const channel = await guild.channels.create({
    name: `${sanitize(baseName)}-${sanitize(interaction.user.username)}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: category?.id,
    topic: `${OWNER_TOPIC_PREFIX}${interaction.user.id}`,
    permissionOverwrites: overwrites as any
  });

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_IDS.CLOSE).setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${interaction.user} — danke für dein Ticket! Unser Team meldet sich in Kürze.`,
    embeds: [infoEmbed],
    components: [closeRow]
  });

  await postAiAnalysis(channel, aiPrompt, guild.id, interaction.user.id);

  await interaction.editReply({ content: `✅ Dein Ticket wurde erstellt: ${channel}` });
}

async function postAiAnalysis(channel: TextChannel, prompt: string, guildId: string, userId: string): Promise<void> {
  try {
    const res = await aiEngine.infer({ module: 'AI_TICKET_ANALYST', guildId, userId, prompt });
    const text: string = res.output?.text ?? '';

    const summary = clamp(extractField(text, 'Zusammenfassung') ?? (text.slice(0, 500) || 'Keine Analyse verfügbar.'));
    const priority = clamp(extractField(text, 'Priorität') ?? 'Mittel', 100);
    const suggestion = clamp(extractField(text, 'Vorschlag') ?? '—');

    const aiEmbed = new EmbedBuilder()
      .setColor(priority.toLowerCase().includes('hoch') ? 0xef4444 : priority.toLowerCase().includes('niedrig') ? 0x22c55e : 0xf59e0b)
      .setTitle('🤖 KI-Analyse')
      .addFields(
        { name: 'Zusammenfassung', value: summary },
        { name: 'Priorität', value: priority, inline: true },
        { name: 'Vorschlag', value: suggestion }
      );

    await channel.send({ embeds: [aiEmbed] });
  } catch (e: any) {
    logger.warn({ err: e.message, channelId: channel.id }, 'ticket-system: AI analysis failed');
  }
}

const KNOWN_FIELDS = ['Zusammenfassung', 'Priorität', 'Vorschlag'];

function extractField(text: string, field: string): string | null {
  // Tolerates markdown emphasis around the label (e.g. **Priorität:**) and
  // captures multi-line values up to the next known field label or end of text.
  const otherFields = KNOWN_FIELDS.filter(f => f !== field).join('|');
  const pattern = new RegExp(
    `[*_]{0,2}${field}[*_]{0,2}:\\s*([\\s\\S]*?)(?=\\n[*_]{0,2}(?:${otherFields})[*_]{0,2}:|$)`,
    'i'
  );
  const match = text.match(pattern);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function clamp(value: string, max = 1000): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

async function ensureTicketCategory(guild: Guild): Promise<CategoryChannel | undefined> {
  await guild.channels.fetch();
  const existing = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === TICKET_CATEGORY_NAME
  ) as CategoryChannel | undefined;
  if (existing) return existing;

  return guild.channels.create({
    name: TICKET_CATEGORY_NAME,
    type: ChannelType.GuildCategory
  });
}

async function handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel | null;
  if (!channel || !interaction.guild) {
    await interaction.reply({ content: '❌ Kanal nicht gefunden.', ephemeral: true });
    return;
  }

  const isTicketChannel = channel.topic?.startsWith(OWNER_TOPIC_PREFIX) ?? false;
  if (!isTicketChannel) {
    await interaction.reply({ content: '❌ Dieser Kanal ist kein Ticket-Kanal.', ephemeral: true });
    return;
  }

  const ownerId = channel.topic!.slice(OWNER_TOPIC_PREFIX.length);
  const member = interaction.member;
  const isOwner = ownerId === interaction.user.id;
  const isAdmin = typeof member?.permissions !== 'string' && member?.permissions?.has(PermissionFlagsBits.Administrator);
  const isStaff = STAFF_ROLE_ID
    ? Array.isArray((member as any)?.roles)
      ? false
      : (member as any)?.roles?.cache?.has(STAFF_ROLE_ID) ?? false
    : false;

  if (!isOwner && !isAdmin && !isStaff) {
    await interaction.reply({ content: '❌ Nur der Ersteller oder das Team können dieses Ticket schließen.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: '🔒 Ticket wird in 5 Sekunden geschlossen…' });
  setTimeout(() => {
    channel.delete().catch(e => logger.warn({ err: e.message, channelId: channel.id }, 'ticket-system: close failed'));
  }, 5000);
}

function sanitize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 20);
  return input.length ? input : 'user';
}
