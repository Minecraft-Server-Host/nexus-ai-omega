/**
 * Nexus AI Omega — InteractionCreate Event Handler v5.0
 * Central dispatcher for all Discord interactions.
 * Routes: slash commands, buttons, modals, select menus, autocomplete.
 */
import { Events, type Interaction, type ChatInputCommandInteraction } from 'discord.js';
import { botLogger, requestContext } from '../../services/logger.js';
import { securityManager } from '../../security-center/securityManager.js';
import { restrictionManager } from '../../global/restrictionManager.js';
import { globalLogger } from '../../global/globalLogger.js';
import { statsAggregator } from '../../global/statisticsAggregator.js';
import { Embeds } from '../../utils/embeds.js';
import { randomUUID } from 'node:crypto';

// ── Command registry type ──────────────────────────────────────────────────────
export interface NexusCommand {
  data: { name: string; toJSON?: () => unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(interaction: ChatInputCommandInteraction | any): Promise<void> | void;
  cooldown?: number;
}

// ── Command registry ───────────────────────────────────────────────────────────
const commandRegistry = new Map<string, NexusCommand>();
// Cooldown tracking: commandName:userId → last used timestamp
const cooldowns = new Map<string, number>();

export function registerCommand(cmd: NexusCommand): void {
  commandRegistry.set(cmd.data.name, cmd);
  botLogger.debug({ command: cmd.data.name }, 'Command registered');
}

export function getAllCommands(): NexusCommand[] {
  return [...commandRegistry.values()];
}

// ── Interaction create handler ─────────────────────────────────────────────────
export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  const requestId = randomUUID();
  const userId = interaction.user.id;
  const guildId = interaction.guildId ?? 'DM';

  await requestContext.run({ requestId, userId, guildId }, async () => {
    try {
      // ── 1. Global restriction check (before anything else) ────────────────
      const restriction = await restrictionManager.validateInteraction(interaction);
      if (!restriction.allowed) {
        if ('reply' in interaction && typeof interaction.reply === 'function') {
          await interaction.reply({ content: restriction.message, ephemeral: true }).catch(() => {});
        }
        return;
      }

      // ── 2. Quarantine check ────────────────────────────────────────────────
      if (guildId !== 'DM') {
        const isQuarantined = await securityManager.isQuarantined(guildId, userId);
        if (isQuarantined) {
          if ('reply' in interaction && typeof interaction.reply === 'function') {
            await interaction.reply({
              embeds: [Embeds.error('Zugriff verweigert', '⛔ Du bist auf diesem Server temporär eingeschränkt. Wende dich an ein Teammitglied.')],
              ephemeral: true,
            }).catch(() => {});
          }
          return;
        }
      }

      // ── 3. Slash command ───────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction, requestId);
        return;
      }

      // ── 4. Button ──────────────────────────────────────────────────────────
      if (interaction.isButton()) {
        const { dispatchButton } = await import('./buttonHandler.js');
        await dispatchButton(interaction);
        return;
      }

      // ── 5. Modal submit ────────────────────────────────────────────────────
      if (interaction.isModalSubmit()) {
        const { dispatchModal } = await import('./modalHandler.js');
        await dispatchModal(interaction);
        return;
      }

      // ── 6. String select menu ──────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        const { dispatchSelect } = await import('./selectHandler.js');
        await dispatchSelect(interaction);
        return;
      }

      // ── 7. Autocomplete ────────────────────────────────────────────────────
      if (interaction.isAutocomplete()) {
        const { dispatchAutocomplete } = await import('./autocompleteHandler.js');
        await dispatchAutocomplete(interaction);
        return;
      }

    } catch (err) {
      botLogger.error({ err, requestId }, 'Unhandled interaction error');
      try {
        if ('reply' in interaction && typeof interaction.reply === 'function') {
          const errEmbed = Embeds.error('Interner Fehler', 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.');
          if ('replied' in interaction && interaction.replied) {
            await (interaction as ChatInputCommandInteraction).followUp({ embeds: [errEmbed], ephemeral: true });
          } else {
            await (interaction as ChatInputCommandInteraction).reply({ embeds: [errEmbed], ephemeral: true });
          }
        }
      } catch { /* prevent crash loop */ }
    }
  });
}

// ── Slash command dispatcher ──────────────────────────────────────────────────
async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  requestId: string,
): Promise<void> {
  const command = commandRegistry.get(interaction.commandName);
  if (!command) {
    await interaction.reply({ embeds: [Embeds.error('Unbekannter Befehl', `\`/${interaction.commandName}\` ist nicht registriert.`)], ephemeral: true });
    return;
  }

  // ── Cooldown check ─────────────────────────────────────────────────────────
  const cooldownMs = (command.cooldown ?? 3) * 1000;
  const cooldownKey = `${interaction.commandName}:${interaction.user.id}`;
  const lastUsed = cooldowns.get(cooldownKey) ?? 0;
  const remaining = cooldownMs - (Date.now() - lastUsed);

  if (remaining > 0) {
    const resetAt = Math.floor((Date.now() + remaining) / 1000);
    await interaction.reply({
      embeds: [Embeds.warning('Cooldown', `Du kannst \`/${interaction.commandName}\` erst <t:${resetAt}:R> wieder benutzen.`)],
      ephemeral: true,
    });
    return;
  }

  cooldowns.set(cooldownKey, Date.now());
  setTimeout(() => cooldowns.delete(cooldownKey), cooldownMs);

  // ── Execute command ────────────────────────────────────────────────────────
  const start = performance.now();
  try {
    await command.execute(interaction);

    const latencyMs = Math.round(performance.now() - start);
    statsAggregator.inc('commandsToday');

    // Log to global logger (non-blocking)
    globalLogger.commandExec(interaction, latencyMs).catch(() => {});

    botLogger.info(
      { command: interaction.commandName, userId: interaction.user.id, guildId: interaction.guildId, latencyMs },
      `/${interaction.commandName}`,
    );
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    botLogger.error({ err, command: interaction.commandName, latencyMs, requestId }, 'Command execution failed');
    throw err; // re-throw to outer handler
  }
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    await handleInteractionCreate(interaction);
  },
};
