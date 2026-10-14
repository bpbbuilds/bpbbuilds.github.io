/**
 * Guild slash commands and their handlers.
 */
import { blobCommand, handleBlob } from './blob.js';
import { handleInv, handleInvButton, invCommand } from './inv.js';
import { handleProfile, profileCommand } from './profile.js';
import { handleTest, testCommand } from './test.js';
import { handleItem, handleItemAutocomplete, itemCommand, warmItemAutocomplete } from './item.js';
import { commandsCommand, handleCommands } from './commands.js';

/** @type {{ name: string, description: string, options?: object[] }[]} */
export const commands = [testCommand, invCommand, blobCommand, profileCommand, itemCommand, commandsCommand];

const handlers = {
  test: handleTest,
  inv: handleInv,
  blob: handleBlob,
  profile: handleProfile,
  item: handleItem,
  commands: (interaction) => handleCommands(interaction, commands),
};

/** @param {string} commandName */
export function getCommandHandler(commandName) {
  return handlers[String(commandName || '').trim()];
}

export { handleInvButton, handleItemAutocomplete, warmItemAutocomplete };

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export function handleCommand(interaction) {
  const run = getCommandHandler(interaction.commandName);
  if (!run) {
    return interaction.reply({ content: 'That command is not set up yet.', ephemeral: true });
  }
  return run(interaction);
}
