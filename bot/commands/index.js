/**
 * Guild slash commands and their handlers.
 */
import { handleInv, handleInvButton, invCommand } from './inv.js';
import { handleTest, testCommand } from './test.js';

/** @type {{ name: string, description: string, options?: object[] }[]} */
export const commands = [testCommand, invCommand];

const handlers = {
  test: handleTest,
  inv: handleInv,
};

export { handleInvButton };

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export function handleCommand(interaction) {
  const run = handlers[interaction.commandName];
  if (!run) {
    return interaction.reply({ content: 'That command is not set up yet.', ephemeral: true });
  }
  return run(interaction);
}
