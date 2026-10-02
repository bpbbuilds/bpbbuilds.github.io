/**
 * Guild slash commands and their handlers.
 */
import { blobCommand, handleBlob } from './blob.js';
import { handleInv, handleInvButton, invCommand } from './inv.js';
import { handleProfile, profileCommand } from './profile.js';
import { handleTest, testCommand } from './test.js';

/** @type {{ name: string, description: string, options?: object[] }[]} */
export const commands = [testCommand, invCommand, blobCommand, profileCommand];

const handlers = {
  test: handleTest,
  inv: handleInv,
  blob: handleBlob,
  profile: handleProfile,
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
