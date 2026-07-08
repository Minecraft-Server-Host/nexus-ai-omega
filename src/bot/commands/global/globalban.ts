/**
 * /globalbanuser • /globalunbanuser • /globaluserinfo • /globalblacklist
 * Nexus Team ONLY — Guild ID 1523481048149921883
 */
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { restrictionManager } from '../../../global/restrictionManager.js';
import { NEXUS_GUILD_ID } from '../../../global/index.js';

function isNexusTeam(interaction:any){
  // Must be in control guild
  if(interaction.guildId !== NEXUS_GUILD_ID) return false;
  // must have Administrator or ManageGuild — in production check NexusTeamMember DB / role IDs
  const member = interaction.member;
  return member?.permissions?.has(PermissionFlagsBits.Administrator) || member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

export const globalbanuserCommand = {
  data: new SlashCommandBuilder()
    .setName('globalbanuser')
    .setDescription('🌐 [NEXUS TEAM] Globally ban a user from all Nexus AI Omega servers')
    .addUserOption(o=>o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Ban reason').setRequired(true).setMaxLength(500))
    .addIntegerOption(o=>o.setName('severity').setDescription('1-5').setMinValue(1).setMaxValue(5))
    .addStringOption(o=>o.setName('evidence').setDescription('Evidence URL / notes'))
    .addBooleanOption(o=>o.setName('appealable').setDescription('Allow appeal?'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction:any){
    if(!isNexusTeam(interaction)){
      return interaction.reply({ ephemeral:true, content:'❌ **Nexus Team Only**\nThis command is restricted to the Nexus Global Control Server (`1523481048149921883`) and Nexus Team roles.' });
    }
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const severity = interaction.options.getInteger('severity') ?? 5;
    const evidence = interaction.options.getString('evidence') ?? undefined;
    const appealable = interaction.options.getBoolean('appealable') ?? true;

    await interaction.deferReply({ ephemeral:true });

    // prevent self / bot
    if(target.id === interaction.user.id) return interaction.editReply('❌ You cannot global-ban yourself.');
    if(target.id === interaction.client.user.id) return interaction.editReply('❌ Nice try.');
    if(target.bot) return interaction.editReply('⚠️ Target is a bot — usually not needed, but continuing…').then(()=>{});

    const record = await restrictionManager.ban({
      userId: target.id,
      username: target.tag,
      reason,
      bannedBy: interaction.user.id,
      moderatorTag: interaction.user.tag,
      severity,
      evidence
    });

    const embed = new EmbedBuilder()
      .setColor(0xf43f5e)
      .setTitle('🌐 Global Ban Executed — Nexus AI Omega')
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name:'👤 User', value:`${target.tag}\n\`${target.id}\``, inline:true },
        { name:'🛡️ Moderator', value:`${interaction.user.tag}\n\`${interaction.user.id}\``, inline:true },
        { name:'⚠️ Severity', value:`${'🔴'.repeat(severity)} ${severity}/5`, inline:true },
        { name:'📝 Reason', value: reason, inline:false },
        { name:'📎 Evidence', value: evidence || '*none provided*', inline:false },
        { name:'🔄 Appealable', value: appealable ? '✅ Yes' : '❌ No', inline:true },
        { name:'🌍 Scope', value:'**ALL Nexus servers (global)**', inline:true },
        { name:'🆔 Case', value:`\`GB-${record.userId.slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}\``, inline:true }
      )
      .setFooter({ text:'Nexus AI Omega • Global Security Center v3.2' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`gb_appeal_${target.id}`).setLabel('Appeal Review').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
      new ButtonBuilder().setCustomId(`gb_evidence_${target.id}`).setLabel('Add Evidence').setStyle(ButtonStyle.Primary).setEmoji('📎'),
      new ButtonBuilder().setCustomId(`gb_unban_${target.id}`).setLabel('Unban').setStyle(ButtonStyle.Danger).setEmoji('🔓')
    );

    await interaction.editReply({ embeds:[embed], components:[row] });

    // public confirmation in control channel (non-ephemeral followup)
    if(interaction.channel?.send){
      await interaction.channel.send({ content:`🚨 **GLOBAL BAN** • <@${target.id}> • by ${interaction.user.tag}`, embeds:[embed] }).catch(()=>{});
    }
  }
};

export const globalunbanuserCommand = {
  data: new SlashCommandBuilder()
    .setName('globalunbanuser')
    .setDescription('🌐 [NEXUS TEAM] Remove global restriction')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Unban reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction:any){
    if(!isNexusTeam(interaction)) return interaction.reply({ ephemeral:true, content:'❌ Nexus Team Only — Control Server required.' });
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'appeal accepted';
    await interaction.deferReply({ ephemeral:true });
    const res = await restrictionManager.unban(target.id, interaction.user.id, interaction.user.tag, reason);
    const embed = new EmbedBuilder()
      .setColor(0x06ffa5)
      .setTitle('✅ Global Unban — Restriction Lifted')
      .setDescription(`**${target.tag}** (\`${target.id}\`)\n\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n\nUser can now use Nexus AI Omega globally again.`)
      .setTimestamp()
      .setFooter({ text:'Nexus AI Omega • Global Control' });
    await interaction.editReply({ embeds:[embed] });
  }
};

export const globaluserinfoCommand = {
  data: new SlashCommandBuilder()
    .setName('globaluserinfo')
    .setDescription('🌐 [NEXUS TEAM] View global restriction status')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction:any){
    if(!isNexusTeam(interaction)) return interaction.reply({ ephemeral:true, content:'❌ Nexus Team Only' });
    const target = interaction.options.getUser('user', true);
    await interaction.deferReply({ ephemeral:true });
    const info = await restrictionManager.getInfo(target.id);
    const r = info.record;
    const embed = new EmbedBuilder()
      .setColor(info.restricted ? 0xf43f5e : 0x06ffa5)
      .setTitle(`🌐 Global User Info — ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name:'🆔 User ID', value:`\`${target.id}\``, inline:true },
        { name:'👤 Username', value: target.tag, inline:true },
        { name:'🚫 Restriction Status', value: info.restricted ? '🔴 **GLOBALLY BANNED**' : '🟢 **Clean**', inline:false },
        { name:'📝 Reason', value: r?.reason || '*n/a*', inline:false },
        { name:'🛡️ Moderator', value: r ? `${r.moderatorTag}\n\`${r.bannedBy}\`` : '*n/a*', inline:true },
        { name:'📅 Date', value: r?.createdAt ? `<t:${Math.floor(new Date(r.createdAt).getTime()/1000)}:F>` : '*n/a*', inline:true },
        { name:'⚠️ Severity', value: r ? `${r.severity||5}/5` : '*n/a*', inline:true },
        { name:'🔁 Ban Count', value: String(r?.banCount ?? 0), inline:true },
        { name:'📜 History Entries', value: String(info.history?.length ?? 0), inline:true },
        { name:'⏳ Expires', value: r?.expiresAt ? `<t:${Math.floor(new Date(r.expiresAt).getTime()/1000)}:R>` : 'Permanent', inline:true }
      )
      .setFooter({ text:'Nexus AI Omega • Global User Intelligence v3.2' })
      .setTimestamp();
    if(info.history?.length){
      const hist = info.history.slice(0,5).map((h:any)=>`\`${new Date(h.createdAt).toISOString().slice(0,16)}\` **${h.action}** — ${h.moderatorTag} — ${h.reason||'—'}`).join('\n');
      embed.addFields({ name:'📚 Recent History', value: hist.slice(0,1024) });
    }
    await interaction.editReply({ embeds:[embed] });
  }
};

export const globalblacklistCommand = {
  data: new SlashCommandBuilder()
    .setName('globalblacklist')
    .setDescription('🌐 [NEXUS TEAM] View all globally banned users')
    .addStringOption(o=>o.setName('search').setDescription('Search user ID / name'))
    .addIntegerOption(o=>o.setName('page').setDescription('Page').setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction:any){
    if(!isNexusTeam(interaction)) return interaction.reply({ ephemeral:true, content:'❌ Nexus Team Only' });
    const search = interaction.options.getString('search') ?? undefined;
    const page = interaction.options.getInteger('page') ?? 1;
    await interaction.deferReply({ ephemeral:true });
    const list = await restrictionManager.listBlacklist(page, 15, search);
    const desc = list.items.length
      ? list.items.map((b:any, i:number)=>`**${(page-1)*15 + i+1}.** \`${b.username||'Unknown'}\` • \`${b.userId}\`\n> ${b.reason?.slice(0,120)||'no reason'} • <t:${Math.floor(new Date(b.createdAt).getTime()/1000)}:R> • by ${b.moderatorTag||b.bannedBy}`).join('\n\n')
      : '*No results*';
    const embed = new EmbedBuilder()
      .setColor(0xf43f5e)
      .setTitle(`🚫 Global Blacklist — Page ${list.page}/${list.pages||1}`)
      .setDescription(desc.slice(0,4000))
      .setFooter({ text:`Total: ${list.total} globally banned • Nexus AI Omega v3.2 • ${search?`filter: "${search}" • `:''}Use /globaluserinfo for details` })
      .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`gbl_prev_${page-1}`).setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page<=1),
      new ButtonBuilder().setCustomId(`gbl_next_${page+1}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= list.pages)
    );
    await interaction.editReply({ embeds:[embed], components: list.pages>1 ? [row] : [] });
  }
};
