/**
 * Nexus AI Omega — /team Global Team Management Commands v2
 * Only Nexus Owner / Co-Owner may use mutating commands
 */
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { globalTeamService } from '../../../global/team/globalTeamService.js';
import { permissionService } from '../../../global/team/permissionService.js';
import { roleSyncService } from '../../../global/team/roleSyncService.js';
import { RANK_META, NEXUS_RANKS, rankFromString, getEffectivePermissions, NexusRank } from '../../../global/team/types.js';
import { globalLogger } from '../../../global/globalLogger.js';

async function requireTeamAuth(interaction:any, minRank: NexusRank = 'MANAGER'){
  const member = await globalTeamService.getMember(interaction.user.id);
  if(!member || member.status !== 'ACTIVE'){
    await interaction.reply({ ephemeral:true, content:'❌ **Nexus Team Only**\nYou are not in the Global Nexus Team Database.' });
    return null;
  }
  const rank = (member.rank || member.role) as NexusRank;
  const { RANK_META } = await import('../../../global/team/types.js');
  if((RANK_META[rank]?.level ?? 0) < (RANK_META[minRank]?.level ?? 999)){
    await interaction.reply({ ephemeral:true, content:`❌ Requires **${minRank}** or higher.\nYour rank: **${rank}**`});
    return null;
  }
  return { member, rank };
}

export const teamCommand = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('🌐 Nexus Global Team Management')
    .addSubcommand(sc=> sc.setName('add').setDescription('Add user to Nexus Team')
      .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
      .addStringOption(o=>o.setName('rank').setDescription('Rank').setRequired(true).addChoices(
        ...NEXUS_RANKS.map(r=>({name:`${RANK_META[r].emoji} ${RANK_META[r].label}`, value:r}))
      ))
      .addStringOption(o=>o.setName('notes').setDescription('Notes')))
    .addSubcommand(sc=> sc.setName('remove').setDescription('Remove from team')
      .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
      .addStringOption(o=>o.setName('reason').setDescription('Reason')))
    .addSubcommand(sc=> sc.setName('promote').setDescription('Promote member')
      .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
      .addStringOption(o=>o.setName('rank').setDescription('New rank').setRequired(true).addChoices(...NEXUS_RANKS.map(r=>({name:`${RANK_META[r].emoji} ${RANK_META[r].label}`, value:r})) ))
      .addStringOption(o=>o.setName('reason').setDescription('Reason')))
    .addSubcommand(sc=> sc.setName('demote').setDescription('Demote member')
      .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
      .addStringOption(o=>o.setName('rank').setDescription('New lower rank').setRequired(true).addChoices(...NEXUS_RANKS.map(r=>({name:`${RANK_META[r].emoji} ${RANK_META[r].label}`, value:r})) ))
      .addStringOption(o=>o.setName('reason').setDescription('Reason')))
    .addSubcommand(sc=> sc.setName('suspend').setDescription('Suspend team member')
      .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
      .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)))
    .addSubcommand(sc=> sc.setName('activate').setDescription('Reactivate suspended member')
      .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)))
    .addSubcommand(sc=> sc.setName('info').setDescription('Show team member info')
      .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(false)))
    .addSubcommand(sc=> sc.setName('list').setDescription('List all Nexus Team members')
      .addStringOption(o=>o.setName('rank').setDescription('Filter by rank').setRequired(false).addChoices(...NEXUS_RANKS.map(r=>({name:RANK_META[r].label, value:r})))))
    .addSubcommand(sc=> sc.setName('sync').setDescription('Force role sync — current server')
      .addBooleanOption(o=>o.setName('global').setDescription('Sync ALL servers (Owner only)')))
    .addSubcommand(sc=> sc.setName('reload').setDescription('Reload team cache'))
    .addSubcommand(sc=> sc.setName('history').setDescription('Show audit history')
      .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)))
    .addSubcommand(sc=> sc.setName('permissions').setDescription('Show your global permissions')),
  async execute(interaction:any){
    const sub = interaction.options.getSubcommand();

    // info / permissions / list — allow any team member
    if(['info','list','permissions','history'].includes(sub)){
      const auth = await requireTeamAuth(interaction, 'TEAM');
      if(!auth) return;
    } else {
      // mutating — require MANAGER+ / OWNER for add/remove/promote
      const minRank = ['add','remove','promote','demote'].includes(sub) ? 'CO_OWNER' as NexusRank : 'MANAGER' as NexusRank;
      const auth = await requireTeamAuth(interaction, minRank);
      if(!auth) return;
    }

    try{
      if(sub === 'add'){
        const target = interaction.options.getUser('user', true);
        const rank = rankFromString(interaction.options.getString('rank', true))!;
        const notes = interaction.options.getString('notes') || undefined;
        await interaction.deferReply({ ephemeral:true });
        // permission check: can actor manage target rank?
        const can = await permissionService.canManage(interaction.user.id, target.id).catch(()=>({allowed:true}));
        // actually check rank hierarchy
        const actor = await globalTeamService.getMember(interaction.user.id);
        const actorRank = (actor?.rank || actor?.role || 'TEAM') as NexusRank;
        const { canAct } = await import('../../../global/team/types.js');
        if(!canAct(actorRank, rank) && !['OWNER','CO_OWNER'].includes(actorRank)){
          return interaction.editReply(`❌ You (${actorRank}) cannot add members at rank **${rank}** (>= your rank).`);
        }
        await globalTeamService.addMember({
          userId: target.id,
          username: target.tag,
          discriminator: target.discriminator ?? '0',
          avatar: target.avatar,
          globalName: (target as any).globalName ?? null,
          rank,
          status:'ACTIVE',
          addedBy: interaction.user.id,
          addedByTag: interaction.user.tag,
          notes,
          permissions: getEffectivePermissions(rank),
          verified: true
        });
        // auto sync role in current guild
        if(interaction.guild){
          const mem = await interaction.guild.members.fetch(target.id).catch(()=>null);
          if(mem){ const { roleSyncService } = await import('../../../global/team/roleSyncService.js'); await roleSyncService.syncMember(mem); }
        }
        const meta = RANK_META[rank];
        await interaction.editReply(`✅ **${target.tag}** added to **Nexus Team**\n\n${meta.emoji} **${meta.label}**\nLevel ${meta.level}\nPermissions: \`${getEffectivePermissions(rank).slice(0,6).join(', ')}${getEffectivePermissions(rank).length>6?' …':''}\`\n\nRole **✨ Nexus Team** will auto-sync across **all ${interaction.client.guilds.cache.size} servers** within 10 minutes.`);
        return;
      }

      if(sub === 'remove'){
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'Removed from Nexus Team';
        await interaction.deferReply({ ephemeral:true });
        await globalTeamService.removeMember(target.id, interaction.user.id, interaction.user.tag, reason);
        // strip role globally — trigger sync
        const { roleSyncService } = await import('../../../global/team/roleSyncService.js');
        // quick local guild strip
        if(interaction.guild){
          const mem = await interaction.guild.members.fetch(target.id).catch(()=>null);
          if(mem) await roleSyncService.syncMember(mem);
        }
        await interaction.editReply(`🗑️ **${target.tag}** removed from Nexus Team.\n\n**Reason:** ${reason}\n\n> ✨ Nexus Team role is being **automatically stripped globally** across all servers.`);
        return;
      }

      if(sub === 'promote' || sub === 'demote'){
        const target = interaction.options.getUser('user', true);
        const newRank = rankFromString(interaction.options.getString('rank', true))!;
        const reason = interaction.options.getString('reason') || `${sub}d via /team`;
        await interaction.deferReply({ ephemeral:true });
        // check canManage
        const check = await permissionService.canManage(interaction.user.id, target.id);
        if(!check.allowed){
          return interaction.editReply(`❌ ${check.reason}`);
        }
        const res = await globalTeamService.setRank(target.id, newRank, interaction.user.id, interaction.user.tag, reason);
        const meta = RANK_META[newRank];
        await interaction.editReply(`📈 **${target.tag}**\n\n${res.oldRank || '?'} → **${meta.emoji} ${meta.label}**\n\n${reason}\n\nPermissions updated globally. Role sync queued.`);
        return;
      }

      if(sub === 'suspend'){
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason', true);
        await interaction.deferReply({ ephemeral:true });
        await globalTeamService.setStatus(target.id, 'SUSPENDED', interaction.user.id, interaction.user.tag, reason);
        await interaction.editReply(`⏸️ **${target.tag}** suspended.\n\n**Reason:** ${reason}\n\n> ✨ Nexus Team role will be **removed globally** within 60 seconds.`);
        return;
      }

      if(sub === 'activate'){
        const target = interaction.options.getUser('user', true);
        await interaction.deferReply({ ephemeral:true });
        await globalTeamService.setStatus(target.id, 'ACTIVE', interaction.user.id, interaction.user.tag, 'reactivated');
        await interaction.editReply(`✅ **${target.tag}** reactivated.\n\nRole will auto-restore globally.`);
        return;
      }

      if(sub === 'info'){
        const target = interaction.options.getUser('user') ?? interaction.user;
        const info = await globalTeamService.getMember(target.id);
        if(!info){
          return interaction.reply({ ephemeral:true, content:`ℹ️ **${target.tag}** is **not** in the Global Nexus Team Database.` });
        }
        const rank = (info.rank || info.role || 'TEAM') as NexusRank;
        const meta = RANK_META[rank] || RANK_META.TEAM;
        const status = info.status || (info.active ? 'ACTIVE' : 'SUSPENDED');
        const embed = {
          color: meta.color,
          title: `${meta.emoji} ${meta.label} — ${target.tag}`,
          thumbnail: { url: target.displayAvatarURL() },
          fields: [
            { name:'🆔 User ID', value:`\`${target.id}\``, inline:true },
            { name:'📊 Rank', value:`${meta.emoji} **${meta.label}**\nLevel ${meta.level}`, inline:true },
            { name:'📡 Status', value: status === 'ACTIVE' ? '🟢 ACTIVE' : `🟡 ${status}`, inline:true },
            { name:'📅 Joined', value: info.joinDate ? `<t:${Math.floor(new Date(info.joinDate).getTime()/1000)}:D>` : (info.createdAt ? `<t:${Math.floor(new Date(info.createdAt).getTime()/1000)}:D>` : '—'), inline:true },
            { name:'👤 Added By', value: info.addedByTag || info.addedBy || 'System', inline:true },
            { name:'⏱ Last Seen', value: info.lastSeen ? `<t:${Math.floor(new Date(info.lastSeen).getTime()/1000)}:R>` : '—', inline:true },
            { name:'🔐 Permissions', value: '```'+ (info.permissions?.join(', ') || getEffectivePermissions(rank).join(', ')).slice(0,900) +'```', inline:false },
            { name:'📝 Notes', value: (info.notes || '*none*').slice(0,1024), inline:false }
          ],
          footer: { text:'Nexus AI Omega • Global Team v2' },
          timestamp: new Date().toISOString()
        };
        await interaction.reply({ ephemeral:true, embeds:[embed] });
        return;
      }

      if(sub === 'list'){
        const filterRank = interaction.options.getString('rank') as NexusRank | null;
        await interaction.deferReply({ ephemeral:true });
        const all = await globalTeamService.listAll();
        const filtered = filterRank ? all.filter((m:any)=> (m.rank||m.role)===filterRank) : all;
        // group by rank
        const grouped: Record<string, any[]> = {};
        for(const r of NEXUS_RANKS){ grouped[r]=[]; }
        filtered.forEach((m:any)=>{ const rk=(m.rank||m.role||'TEAM'); if(grouped[rk]) grouped[rk].push(m); });
        let desc = '';
        for(const rank of NEXUS_RANKS){
          const list = grouped[rank];
          if(!list?.length) continue;
          const meta = RANK_META[rank];
          desc += `\n**${meta.emoji} ${meta.label} — ${list.length}**\n`;
          desc += list.slice(0,25).map((m:any)=> `• <@${m.userId}> \`${m.username}\` — ${m.status|| (m.active?'ACTIVE':'—')} — <t:${Math.floor(new Date(m.joinDate||m.createdAt).getTime()/1000)}:D>`).join('\n') + '\n';
        }
        if(!desc) desc='*No team members found*';
        const embed = {
          color:0x06b6d4,
          title:'👥 Nexus Global Team — Roster',
          description: desc.slice(0,4000),
          footer:{ text:`Total: ${filtered.length} • Nexus AI Omega v3.2` },
          timestamp: new Date().toISOString()
        };
        await interaction.editReply({ embeds:[embed] });
        return;
      }

      if(sub === 'sync'){
        const global = interaction.options.getBoolean('global') ?? false;
        await interaction.deferReply({ ephemeral:true });
        const { roleSyncService } = await import('../../../global/team/roleSyncService.js');
        if(global){
          // check owner
          const me = await globalTeamService.getMember(interaction.user.id);
          const rank = me?.rank || me?.role;
          if(!['OWNER','CO_OWNER'].includes(rank)){
            return interaction.editReply('❌ Global sync requires **Owner / Co-Owner**.');
          }
          await interaction.editReply('🌍 Starting **global sync** across all guilds… this may take a few minutes. Check `#server-logs` in Control Center.');
          // fire and forget
          roleSyncService.syncAllGuilds(interaction.client).then(res=>{
            interaction.followUp({ ephemeral:true, content:`✅ Global sync finished:\n• Guilds: ${res.guilds}\n• Checked: ${res.totalChecked}\n• Added: ${res.totalAdded}\n• Removed: ${res.totalRemoved}`}).catch(()=>{});
          });
          return;
        } else {
          if(!interaction.guild) return interaction.editReply('❌ Guild only');
          const res = await roleSyncService.syncGuild(interaction.guild);
          await interaction.editReply(`✅ **${interaction.guild.name}** synced\n\n• Checked: **${res.checked}**\n• Added: **${res.added}**\n• Removed: **${res.removed}**\n• Skipped: **${res.skipped}**\n• Time: **${res.tookMs}ms**`);
          return;
        }
      }

      if(sub === 'reload'){
        // clear cache
        const svc = await import('../../../global/team/globalTeamService.js');
        // @ts-ignore
        svc.globalTeamService['cache']?.clear?.();
        await interaction.reply({ ephemeral:true, content:'🔄 Team cache reloaded.' });
        return;
      }

      if(sub === 'history'){
        const target = interaction.options.getUser('user', true);
        await interaction.deferReply({ ephemeral:true });
        const hist = await globalTeamService.getHistory(target.id, 20);
        if(!hist.length) return interaction.editReply(`📭 No history for ${target.tag}`);
        const lines = hist.map((h:any)=> `\`${new Date(h.createdAt).toISOString().slice(0,16).replace('T',' ')}\` **${h.action}** ${h.oldRank?`${h.oldRank}→`:''}${h.newRank||''} — ${h.moderatorTag} — ${h.reason||'—'}`);
        await interaction.editReply({ content: `📜 **Team History — ${target.tag}**\n\n${lines.join('\n')}`.slice(0,1900) });
        return;
      }

      if(sub === 'permissions'){
        const me = await globalTeamService.getMember(interaction.user.id);
        if(!me) return interaction.reply({ ephemeral:true, content:'❌ Not in Nexus Team DB' });
        const rank = (me.rank || me.role) as NexusRank;
        const perms = me.permissions?.length ? me.permissions : getEffectivePermissions(rank);
        await interaction.reply({ ephemeral:true, content: `🔐 **Your Global Permissions**\n\n**${RANK_META[rank]?.emoji} ${RANK_META[rank]?.label}** (Level ${RANK_META[rank]?.level})\n\n\`\`\`\n${perms.join('\n')}\n\`\`\``.slice(0,1900) });
        return;
      }

      await interaction.reply({ ephemeral:true, content:'Unknown subcommand' });
    }catch(e:any){
      const { logger } = await import('../../../services/logger.js');
      logger.error(e);
      if(interaction.deferred || interaction.replied) interaction.editReply('❌ Team command error: '+e.message).catch(()=>{});
      else interaction.reply({ ephemeral:true, content:'❌ Error' }).catch(()=>{});
    }
  }
};
