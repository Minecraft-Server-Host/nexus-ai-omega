/**
 * Nexus AI Omega — /setrules Command v5.2
 * Verbesserte KI-Regeln mit professionellerem Prompt und besserer Qualität.
 */
import {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
  type ChatInputCommandInteraction, EmbedBuilder,
} from 'discord.js';
import { Embeds, NexusColors } from '../../../utils/embeds.js';
import { findChannel }         from '../../systems/autoSetup.js';
import { aiEngine }            from '../../../ai-center/aiEngine.js';
import type { NexusCommand }   from '../../events/interactionCreate.js';

const command: NexusCommand = {
  data: new SlashCommandBuilder()
    .setName('setrules')
    .setDescription('📋 KI-generierte Serverregeln erstellen und in Kanal senden')
    .addChannelOption(o =>
      o.setName('kanal').setDescription('Regeln-Kanal (leer = automatisch erkennen)')
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption(o =>
      o.setName('stil').setDescription('Stil der generierten Regeln').addChoices(
        { name: '🎮 Gaming Community',           value: 'gaming' },
        { name: '💼 Professionell / Business',   value: 'professional' },
        { name: '🌸 Anime / Casual / Locker',    value: 'casual' },
        { name: '🔧 Technisch / Dev-Community',  value: 'technical' },
        { name: '📚 Bildung / Lern-Community',   value: 'education' },
        { name: '🎨 Kreativ / Kunst',            value: 'creative' },
        { name: '🌐 Allgemein (Standard)',        value: 'general' },
      ),
    )
    .addBooleanOption(o => o.setName('anpinnen').setDescription('Regeln anpinnen? (Standard: Ja)'))
    .addStringOption(o =>
      o.setName('zusatz').setDescription('Zusätzliche spezifische Regeln (optional)').setMaxLength(500),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild       = interaction.guild!;
    const manualCh    = interaction.options.getChannel('kanal') as import('discord.js').TextChannel | null;
    const stil        = interaction.options.getString('stil') ?? 'general';
    const shouldPin   = interaction.options.getBoolean('anpinnen') ?? true;
    const zusatz      = interaction.options.getString('zusatz') ?? '';

    const targetChannel = manualCh ?? findChannel(guild, 'rules');

    if (!targetChannel) {
      await interaction.editReply({
        embeds: [Embeds.error(
          'Kein Regeln-Kanal gefunden',
          '> Erstelle einen Kanal namens `rules`, `regeln`, `server-rules` oder ähnliches.\n' +
          '> Oder gib einen Kanal mit `/setrules kanal:#rules` an.',
        )],
      });
      return;
    }

    await interaction.editReply({ embeds: [Embeds.loading('KI generiert professionelle Regeln…', `Stil: ${stil}`)] });

    // Stil-spezifische Beschreibungen für bessere KI-Prompts
    const stilContext: Record<string, { desc: string; tone: string; examples: string }> = {
      gaming:       { desc: 'Gaming-Community mit Fokus auf Fairplay und teamwork', tone: 'energetisch, freundlich, gaming-bezogen', examples: 'Kein Cheating, No Toxicity, GG-Kultur' },
      professional: { desc: 'professionellen Business/Netzwerk-Community', tone: 'formell, respektvoll, sachlich', examples: 'Professionelle Kommunikation, keine Werbung ohne Genehmigung' },
      casual:       { desc: 'entspannten, freundlichen Freizeit-Community', tone: 'locker, herzlich, einladend', examples: 'Sei du selbst, hab Spaß, keine Flame-Wars' },
      technical:    { desc: 'technischen Developer/IT-Community', tone: 'präzise, sachlich, auf Qualität fokussiert', examples: 'Nur On-Topic-Fragen, Code-Etiquette, keine Off-Topic-Spam' },
      education:    { desc: 'Bildungs- und Lern-Community', tone: 'ermutigend, respektvoll, lernförderlich', examples: 'Respektvolle Fragen, teile Wissen, keine schnellen Antworten fordern' },
      creative:     { desc: 'kreativen Kunst- und Design-Community', tone: 'inspirierend, offen, unterstützend', examples: 'Konstruktives Feedback, respektiere Urheberrechte, teile dein Werk' },
      general:      { desc: 'allgemeinen Discord-Community', tone: 'freundlich, klar, respektvoll', examples: 'Allgemeine Community-Standards' },
    };

    const ctx = stilContext[stil] ?? stilContext.general;

    const rulesPrompt = `Du bist ein professioneller Discord-Community-Manager mit 10 Jahren Erfahrung.
Erstelle präzise, professionelle Serverregeln für folgende Community:

SERVER: "${guild.name}" (${guild.memberCount} Mitglieder)
COMMUNITY-TYP: ${ctx.desc}
TON: ${ctx.tone}
STIL: ${stil}
${zusatz ? `SPEZIELLE ANFORDERUNGEN: ${zusatz}` : ''}

ANFORDERUNGEN:
- Genau 8 Regeln (§1-§8)
- Jede Regel: Klare Überschrift + 2-3 konkrete Punkte
- Praxis-relevant für diesen Community-Typ
- Konsequenzen klar formuliert
- Deutsch, professionell, ${ctx.tone}
- Beispiele passend: ${ctx.examples}
- KEIN Generic-Template — echte, spezifische Regeln für diese Community

AUSGABE-FORMAT (exakt so):
📋 **Serverregeln — ${guild.name}**

**§1 — [Titel]**
• [Regel]
• [Regel]
• [Konsequenz bei Verstoß]

[weiter §2-§8...]

**━━━━━━━━━━━━━━━━━━━━━━━━**
*Mit dem Verbleib auf ${guild.name} stimmst du diesen Regeln zu.*
*Stand: ${new Date().toLocaleDateString('de-DE')} • Bei Fragen: öffne ein Ticket*

Generiere professionelle, spezifische Regeln — kein Copy-Paste Template.`;

    let rulesContent = '';

    try {
      const result = await aiEngine.infer({
        module:      'AI_COMMUNITY_MANAGER',
        prompt:      rulesPrompt,
        guildId:     guild.id,
        maxTokens:   1500,
        temperature: 0.35, // Niedrige Temp für konsistente, professionelle Regeln
      });

      const text = String(result.text).trim();
      if (text.length > 100) {
        rulesContent = text.slice(0, 3900);
      }
    } catch (err) {
      /* Fallback wenn KI nicht verfügbar */
    }

    // Hochqualitäts-Fallback wenn KI fehlschlägt
    if (!rulesContent) {
      rulesContent = `📋 **Serverregeln — ${guild.name}**

**§1 — Respekt & Umgang**
• Behandle alle Mitglieder mit Respekt und Würde — unabhängig von Meinung, Herkunft oder Spielstil
• Beleidigungen, Diskriminierung, Hassrede und persönliche Angriffe sind absolut verboten
• *Verstoß: Verwarnung → Timeout → permanenter Ban*

**§2 — Inhalte & Medien**
• Keine NSFW-, schockierenden oder illegalen Inhalte in nicht-markierten Kanälen
• Bitte poste Inhalte nur in den dafür vorgesehenen Kanälen
• *Verstoß: Sofortige Löschung + Verwarnung*

**§3 — Spam & Werbung**
• Kein Spam, Flood, übermäßiges Erwähnen (Pings) oder repetitive Nachrichten
• Keine unerwünschte Werbung, Affiliate-Links oder Server-Invites ohne Genehmigung
• *Verstoß: Stummschaltung + Verwarnung*

**§4 — Sprache & Kommunikation**
• Nutze die für den Kanal festgelegte Sprache (Kanal-Beschreibung beachten)
• Keine übermäßige Verwendung von Großbuchstaben, Sonderzeichen oder unleserlichem Text
• *Verstoß: Verwarnung*

**§5 — Sicherheit & Datenschutz**
• Teile niemals persönliche Daten anderer ohne deren ausdrückliche Zustimmung
• Phishing-Links, Malware, Scam-Inhalte und schädliche Dateien sind verboten
• *Verstoß: Sofortiger Ban ohne Vorwarnung*

**§6 — Voice-Kanäle**
• Verhalte dich in Voice-Kanälen respektvoll — kein absichtliches Stören, kein permanentes Muten anderer
• Musik-Bots und Soundboards nur in dafür vorgesehenen Kanälen
• *Verstoß: Disconnect + Verwarnung*

**§7 — Discord-Nutzungsbedingungen**
• Alle Discord-Nutzungsbedingungen und Community-Richtlinien gelten hier: discord.com/terms
• Nutzer müssen mindestens 13 Jahre alt sein (Discord-Anforderung)
• *Verstoß: Sofortiger permanenter Ban*

**§8 — Team & Moderation**
• Respektiere Entscheidungen des Moderationsteams — nutze Tickets für Beschwerden
• Das Team behält sich vor, Verstöße je nach Schwere individuell zu ahnden
• Unterstütze das Team indem du verdächtiges Verhalten meldest

**━━━━━━━━━━━━━━━━━━━━━━━━**
*Mit dem Verbleib auf ${guild.name} stimmst du diesen Regeln zu.*
*Stand: ${new Date().toLocaleDateString('de-DE')} • Bei Fragen: öffne ein Ticket*`;
    }

    // Regeln-Embed erstellen
    const rulesEmbed = new EmbedBuilder()
      .setColor(NexusColors.info)
      .setDescription(rulesContent)
      .setFooter({
        text: `${guild.name} • Erstellt mit Nexus AI Omega v5 • ${new Date().toLocaleDateString('de-DE')}`,
      })
      .setTimestamp();

    try {
      const sent = await (targetChannel as import('discord.js').TextChannel).send({ embeds: [rulesEmbed] });
      if (shouldPin) await sent.pin('Nexus Auto-Setup: Regeln angepinnt').catch(() => {});

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(NexusColors.success)
            .setTitle('✅  Regeln erfolgreich erstellt!')
            .addFields(
              { name: '📋 Kanal',         value: `${targetChannel}`,              inline: true },
              { name: '🎨 Stil',          value: `\`${stil}\``,                   inline: true },
              { name: '📌 Angepinnt',     value: shouldPin ? '✅ Ja' : '❌ Nein', inline: true },
              { name: '🤖 KI-generiert',  value: rulesContent.includes('§1') ? '✅ Ja' : '⚡ Fallback', inline: true },
            )
            .setFooter({ text: 'Nexus AI Omega v5 • Rules System' })
            .setTimestamp(),
        ],
      });
    } catch (err) {
      await interaction.editReply({
        embeds: [Embeds.error('Fehler', `Regeln konnten nicht gesendet werden: ${(err as Error).message}`)],
      });
    }
  },
};

export default command;
