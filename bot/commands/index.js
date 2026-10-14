/**
 * Guild slash commands and their handlers.
 */
import { blobCommand, handleBlob } from './blob.js';
import { handleInv, handleInvButton, invCommand } from './inv.js';
import { handleProfile, profileCommand } from './profile.js';
import { handleTest, testCommand } from './test.js';
import { handleItem, handleItemAutocomplete, itemCommand, warmItemAutocomplete } from './item.js';

/** @type {{ name: string, description: string, options?: object[] }[]} */
export const commands = [testCommand, invCommand, blobCommand, profileCommand, itemCommand];

const handlers = {
  test: handleTest,
  inv: handleInv,
  blob: handleBlob,
  profile: handleProfile,
  item: handleItem,
};

export { handleInvButton, handleItemAutocomplete, warmItemAutocomplete };

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
