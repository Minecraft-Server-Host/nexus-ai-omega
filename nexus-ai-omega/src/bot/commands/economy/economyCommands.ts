/**
 * Nexus AI Omega — Economy System v5.2
 * Verbessert: Error-Handling, Fehlermeldungen, Balance-Display, Work-Jobs
 */
import {
  SlashCommandBuilder, EmbedBuilder,
  PermissionFlagsBits, type ChatInputCommandInteraction,
} from 'discord.js';
import { dbGet, dbRun, dbAll }  from '../../services/database.js';
import { Embeds, NexusColors }  from '../../../utils/embeds.js';
import type { NexusCommand }    from '../../events/interactionCreate.js';

// ── Helper ────────────────────────────────────────────────────────────────────
async function getOrCreateEconomy(guildId: string, userId: string) {
  let data = await dbGet('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?', guildId, userId);
  if (!data) {
    await dbRun('INSERT INTO economy (guild_id, user_id, balance, bank, last_daily, last_work) VALUES (?, ?, 500, 0, 0, 0)', guildId, userId);
    data = await dbGet('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?', guildId, userId);
  }
  return data!;
}

function formatCoins(n: number): string {
  return `**${n.toLocaleString('de-DE')}** 🪙`;
}

function timeLeft(lastMs: number, cooldownMs: number): string {
  const remaining = cooldownMs - (Date.now() - Number(lastMs));
  if (remaining <= 0) return '';
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const JOBS = [
  { job: 'als Programmierer gearbeitet 💻',       min: 150, max: 350 },
  { job: 'Pakete ausgeliefert 📦',               min: 100, max: 250 },
  { job: 'als Streamer Geld verdient 🎮',        min: 100, max: 400 },
  { job: 'Pizzas gebacken & ausgeliefert 🍕',    min: 80,  max: 200 },
  { job: 'als DJ aufgelegt 🎧',                  min: 120, max: 300 },
  { job: 'Autos gewaschen & poliert 🚗',         min: 70,  max: 180 },
  { job: 'als YouTuber Videos erstellt 📹',       min: 100, max: 500 },
  { job: 'als Grafikdesigner gearbeitet 🎨',     min: 130, max: 320 },
  { job: 'Daten analysiert 📊',                  min: 140, max: 360 },
  { job: 'als Koch gearbeitet 👨‍🍳',              min: 90,  max: 220 },
  { job: 'Social Media Beiträge erstellt 📱',     min: 80,  max: 200 },
  { job: 'als Übersetzer gearbeitet 🌐',         min: 110, max: 280 },
];

// ── /balance ──────────────────────────────────────────────────────────────────
export const balanceCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('💰 Guthaben & Kontostand anzeigen')
    .addUserOption(o => o.setName('benutzer').setDescription('Anderen User anzeigen')),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const target = i.options.getUser('benutzer') ?? i.user;
    const data   = await getOrCreateEconomy(i.guildId!, target.id);
    const bal    = Number(data['balance']);
    const bank   = Number(data['bank']);
    const total  = bal + bank;

    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.gold)
          .setTitle(`💰  Guthaben — ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: '👛 Portemonnaie', value: formatCoins(bal),   inline: true },
            { name: '🏦 Bank',         value: formatCoins(bank),  inline: true },
            { name: '💎 Gesamt',       value: formatCoins(total), inline: true },
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Economy System' })
          .setTimestamp(),
      ],
    });
  },
};

// ── /daily ────────────────────────────────────────────────────────────────────
export const dailyCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('daily').setDescription('🎁 Tägliche Belohnung abholen (alle 24h)'),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const data = await getOrCreateEconomy(i.guildId!, i.user.id);
    const now  = Date.now();
    const last = Number(data['last_daily']);
    const cd   = 86_400_000; // 24h

    if (now - last < cd) {
      const left = timeLeft(last, cd);
      await i.reply({
        embeds: [Embeds.warning('Cooldown', `> Du hast heute schon deine Belohnung abgeholt!\n> Komm in **${left}** wieder.`)],
        ephemeral: true,
      });
      return;
    }

    // Streak-System (aufeinander folgende Tage)
    const streak     = now - last < 86_400_000 * 2 ? (Number(data['streak'] ?? 0) + 1) : 1;
    const baseAmount = Math.floor(Math.random() * 500) + 500;
    const bonus      = Math.min(streak - 1, 6) * 100; // Max +600 bonus
    const amount     = baseAmount + bonus;

    await dbRun('UPDATE economy SET balance = balance + ?, last_daily = ? WHERE guild_id = ? AND user_id = ?',
      amount, now, i.guildId, i.user.id);

    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.gold)
          .setTitle('🎁  Tägliche Belohnung!')
          .setDescription(
            `> Du hast ${formatCoins(amount)} erhalten!\n` +
            (streak > 1 ? `> 🔥 **${streak} Tage Streak** — Bonus: +${formatCoins(bonus)}\n` : '') +
            `> Komm morgen wieder für mehr!`,
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Economy' }),
      ],
    });
  },
};

// ── /work ─────────────────────────────────────────────────────────────────────
export const workCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('work').setDescription('💼 Arbeite und verdiene Coins (alle 1h)'),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const data = await getOrCreateEconomy(i.guildId!, i.user.id);
    const now  = Date.now();
    const last = Number(data['last_work']);
    const cd   = 3_600_000; // 1h

    if (now - last < cd) {
      const left = timeLeft(last, cd);
      await i.reply({
        embeds: [Embeds.warning('Noch nicht Zeit', `> Du bist noch erschöpft!\n> Du kannst in **${left}** wieder arbeiten.`)],
        ephemeral: true,
      });
      return;
    }

    const jobData = JOBS[Math.floor(Math.random() * JOBS.length)];
    const amount  = Math.floor(Math.random() * (jobData.max - jobData.min)) + jobData.min;

    await dbRun('UPDATE economy SET balance = balance + ?, last_work = ? WHERE guild_id = ? AND user_id = ?',
      amount, now, i.guildId, i.user.id);

    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.mint)
          .setTitle('💼  Arbeit erledigt!')
          .setDescription(
            `> Du hast ${jobData.job}\n` +
            `> und dabei ${formatCoins(amount)} verdient! 💪`,
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Economy • Nächster Job in 1h' }),
      ],
    });
  },
};

// ── /pay ──────────────────────────────────────────────────────────────────────
export const payCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('💸 Coins an einen anderen User überweisen')
    .addUserOption(o => o.setName('benutzer').setDescription('Empfänger').setRequired(true))
    .addIntegerOption(o => o.setName('betrag').setDescription('Betrag in Coins').setRequired(true).setMinValue(1)),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const target = i.options.getUser('benutzer', true);
    const amount = i.options.getInteger('betrag', true);

    if (target.id === i.user.id)
      return i.reply({ embeds: [Embeds.error('Fehler', 'Du kannst dir nicht selbst Coins senden.')], ephemeral: true });
    if (target.bot)
      return i.reply({ embeds: [Embeds.error('Fehler', 'Du kannst keine Coins an Bots senden.')], ephemeral: true });

    const sender = await getOrCreateEconomy(i.guildId!, i.user.id);
    const senderBal = Number(sender['balance']);

    if (senderBal < amount) {
      return i.reply({
        embeds: [Embeds.error(
          'Nicht genug Coins',
          `> Du hast nur ${formatCoins(senderBal)} im Portemonnaie.\n` +
          `> Du bräuchtest ${formatCoins(amount)} für diese Überweisung.`,
        )],
        ephemeral: true,
      });
    }

    await getOrCreateEconomy(i.guildId!, target.id);
    await dbRun('UPDATE economy SET balance = balance - ? WHERE guild_id = ? AND user_id = ?', amount, i.guildId, i.user.id);
    await dbRun('UPDATE economy SET balance = balance + ? WHERE guild_id = ? AND user_id = ?', amount, i.guildId, target.id);

    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('💸  Überweisung erfolgreich!')
          .addFields(
            { name: '📤 Von',    value: i.user.tag,  inline: true },
            { name: '📥 An',     value: target.tag,  inline: true },
            { name: '💰 Betrag', value: formatCoins(amount), inline: true },
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Economy' }),
      ],
    });
  },
};

// ── /shop ─────────────────────────────────────────────────────────────────────
export const shopCmd: NexusCommand = {
  data: new SlashCommandBuilder().setName('shop').setDescription('🛒 Server-Shop anzeigen'),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const items = await dbAll('SELECT * FROM shop_items WHERE guild_id = ?', i.guildId);
    if (!items.length) {
      return i.reply({
        embeds: [Embeds.info('🛒 Shop ist leer', '> Noch keine Artikel im Shop.\n> Admins können mit `/additem` Artikel hinzufügen.')],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF8800)
      .setTitle('🛒  Server-Shop')
      .setDescription(
        items.map((it, idx) =>
          `**${idx + 1}. ${it['name']}** — ${formatCoins(Number(it['price']))}\n` +
          `> ${it['description'] || 'Keine Beschreibung'}` +
          (it['role_id'] ? `\n> 🎭 Gibt Rolle: <@&${it['role_id']}>` : ''),
        ).join('\n\n').slice(0, 4000),
      )
      .setFooter({ text: `${items.length} Artikel • /buy <artikel> zum Kaufen • Nexus Economy` });

    await i.reply({ embeds: [embed] });
  },
};

// ── /buy ──────────────────────────────────────────────────────────────────────
export const buyCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('🛍️ Artikel aus dem Shop kaufen')
    .addStringOption(o => o.setName('artikel').setDescription('Artikelname').setRequired(true)),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const itemName = i.options.getString('artikel', true).toLowerCase();
    const item     = await dbGet('SELECT * FROM shop_items WHERE guild_id = ? AND LOWER(name) = ?', i.guildId, itemName);

    if (!item) {
      return i.reply({
        embeds: [Embeds.error('Nicht gefunden', `> Artikel \`${itemName}\` existiert nicht im Shop.\n> Nutze \`/shop\` um alle Artikel zu sehen.`)],
        ephemeral: true,
      });
    }

    const price = Number(item['price']);
    const data  = await getOrCreateEconomy(i.guildId!, i.user.id);
    const bal   = Number(data['balance']);

    if (bal < price) {
      return i.reply({
        embeds: [Embeds.error(
          'Nicht genug Coins',
          `> Du hast ${formatCoins(bal)}, brauchst aber ${formatCoins(price)}.\n` +
          `> Dir fehlen noch ${formatCoins(price - bal)}.`,
        )],
        ephemeral: true,
      });
    }

    await dbRun('UPDATE economy SET balance = balance - ? WHERE guild_id = ? AND user_id = ?', price, i.guildId, i.user.id);

    const existing = await dbGet('SELECT * FROM inventory WHERE guild_id = ? AND user_id = ? AND item_name = ?', i.guildId, i.user.id, item['name']);
    if (existing) await dbRun('UPDATE inventory SET quantity = quantity + 1 WHERE id = ?', existing['id']);
    else          await dbRun('INSERT INTO inventory (guild_id, user_id, item_name) VALUES (?, ?, ?)', i.guildId, i.user.id, item['name']);

    if (item['role_id']) {
      const member = await i.guild!.members.fetch(i.user.id).catch(() => null);
      if (member) await member.roles.add(String(item['role_id']), 'Economy Shop Purchase').catch(() => {});
    }

    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('✅  Kauf erfolgreich!')
          .setDescription(
            `> Du hast **${item['name']}** für ${formatCoins(price)} gekauft!\n` +
            (item['role_id'] ? `> 🎭 Rolle **<@&${item['role_id']}>** wurde dir vergeben.` : ''),
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Economy' }),
      ],
    });
  },
};

// ── /sell ─────────────────────────────────────────────────────────────────────
export const sellCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('sell')
    .setDescription('💵 Artikel aus deinem Inventar verkaufen')
    .addStringOption(o => o.setName('artikel').setDescription('Artikelname').setRequired(true)),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const itemName = i.options.getString('artikel', true).toLowerCase();
    const inv = await dbGet('SELECT * FROM inventory WHERE guild_id = ? AND user_id = ? AND LOWER(item_name) = ?', i.guildId, i.user.id, itemName);

    if (!inv) {
      return i.reply({
        embeds: [Embeds.error('Nicht im Inventar', `> Du hast \`${itemName}\` nicht.\n> Nutze \`/inventory\` um dein Inventar zu sehen.`)],
        ephemeral: true,
      });
    }

    const shop  = await dbGet('SELECT price FROM shop_items WHERE guild_id = ? AND LOWER(name) = ?', i.guildId, itemName);
    const price = shop ? Math.floor(Number(shop['price']) * 0.5) : 50;

    if (Number(inv['quantity']) <= 1) await dbRun('DELETE FROM inventory WHERE id = ?', inv['id']);
    else                              await dbRun('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?', inv['id']);

    await dbRun('UPDATE economy SET balance = balance + ? WHERE guild_id = ? AND user_id = ?', price, i.guildId, i.user.id);

    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.warning)
          .setTitle('💰  Verkauft!')
          .setDescription(
            `> **${inv['item_name']}** wurde für ${formatCoins(price)} verkauft.\n` +
            `> *Verkaufspreis = 50% des Shop-Preises*`,
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Economy' }),
      ],
    });
  },
};

// ── /inventory ────────────────────────────────────────────────────────────────
export const inventoryCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('🎒 Dein Inventar anzeigen')
    .addUserOption(o => o.setName('benutzer').setDescription('Anderen User anzeigen')),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const target = i.options.getUser('benutzer') ?? i.user;
    const items  = await dbAll('SELECT * FROM inventory WHERE guild_id = ? AND user_id = ?', i.guildId, target.id);

    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x8B4513)
          .setTitle(`🎒  Inventar — ${target.username}`)
          .setDescription(
            items.length
              ? items.map(it => `• **${it['item_name']}** ×${it['quantity']}`).join('\n')
              : '> *Inventar ist leer*\n> Kaufe Artikel im `/shop`!',
          )
          .setFooter({ text: `${items.length} Artikel • Nexus AI Omega v5 • Economy` }),
      ],
    });
  },
};

// ── /additem ──────────────────────────────────────────────────────────────────
export const additemCmd: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('additem')
    .setDescription('➕ Artikel zum Shop hinzufügen (Admin)')
    .addStringOption(o => o.setName('name').setDescription('Artikelname').setRequired(true).setMaxLength(50))
    .addIntegerOption(o => o.setName('preis').setDescription('Preis in Coins').setRequired(true).setMinValue(1).setMaxValue(10_000_000))
    .addStringOption(o => o.setName('beschreibung').setDescription('Beschreibung').setMaxLength(200))
    .addRoleOption(o => o.setName('rolle').setDescription('Rolle die beim Kauf vergeben wird'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 5,
  async execute(i: ChatInputCommandInteraction) {
    const name  = i.options.getString('name', true);
    const price = i.options.getInteger('preis', true);
    const desc  = i.options.getString('beschreibung') ?? '';
    const role  = i.options.getRole('rolle');

    // Duplikat prüfen
    const existing = await dbGet('SELECT id FROM shop_items WHERE guild_id = ? AND LOWER(name) = ?', i.guildId, name.toLowerCase());
    if (existing) {
      return i.reply({ embeds: [Embeds.error('Bereits vorhanden', `Artikel \`${name}\` existiert bereits im Shop.`)], ephemeral: true });
    }

    await dbRun('INSERT INTO shop_items (guild_id, name, description, price, role_id) VALUES (?, ?, ?, ?, ?)',
      i.guildId, name, desc, price, role?.id ?? null);

    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(NexusColors.success)
          .setTitle('✅  Artikel hinzugefügt!')
          .addFields(
            { name: '🛒 Name',        value: name,                           inline: true },
            { name: '💰 Preis',       value: formatCoins(price),             inline: true },
            { name: '🎭 Rolle',       value: role ? `${role}` : '—',         inline: true },
            { name: '📝 Beschreibung', value: desc || '—',                   inline: false },
          )
          .setFooter({ text: 'Nexus AI Omega v5 • Economy' }),
      ],
      ephemeral: true,
    });
  },
};

export const economyCommands: NexusCommand[] = [
  balanceCmd, dailyCmd, workCmd, payCmd,
  shopCmd, buyCmd, sellCmd, inventoryCmd, additemCmd,
];
