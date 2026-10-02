/**
 * /test — confirms the bot is online and answering slash commands.
 */

export const testCommand = {
  name: 'test',
  description: 'Check that the bot is answering.',
};

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export function handleTest(interaction) {
  return interaction.reply('Test received. The bot is online.');
}
