/**
 * /commands — private help embed for the bot's registered slash commands.
 */
import { EmbedBuilder } from 'discord.js';

const GOLD = 0xeac914;

export const commandsCommand = {
  name: 'commands',
  description: 'List the available bot commands.',
};

/**
 * Build the help embed from the same definitions sent to Discord during deploy.
 * Keeping this data-driven prevents the help text from drifting as commands are
 * added or their descriptions change.
 *
 * @param {Array<{ name?: string, description?: string }>} commandDefinitions
 */
export function commandsEmbed(commandDefinitions) {
  const fields = (Array.isArray(commandDefinitions) ? commandDefinitions : [])
    .map((command) => {
      const name = String(command?.name || '').trim();
      const description = String(command?.description || '').trim();
      if (!name || !description) return null;
      return { name: `/${name}`, value: description, inline: false };
    })
    .filter(Boolean);

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('Available commands')
    .setDescription('Use one of these slash commands in this server.')
    .addFields(fields);
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {Array<{ name?: string, description?: string }>} commandDefinitions
 */
export function handleCommands(interaction, commandDefinitions) {
  return interaction.reply({
    embeds: [commandsEmbed(commandDefinitions)],
    ephemeral: true,
  });
}
