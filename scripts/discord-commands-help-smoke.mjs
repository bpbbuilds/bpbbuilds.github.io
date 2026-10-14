#!/usr/bin/env node

/** Regression for the Discord /commands help embed and registry coverage. */

import assert from 'node:assert/strict';
import { commandsCommand, commandsEmbed } from '../bot/commands/commands.js';
import { commands } from '../bot/commands/index.js';

assert.equal(commandsCommand.name, 'commands', 'help command is registered as /commands');
assert.match(commandsCommand.description, /command/i, 'help command has a useful description');

const embed = commandsEmbed(commands).toJSON();
assert.equal(embed.title, 'Available commands', 'help embed has a stable title');
assert.ok(Array.isArray(embed.fields), 'help embed lists commands as fields');
assert.equal(embed.fields.length, commands.length, 'every registered command has one help field');

const names = new Set(embed.fields.map((field) => field.name));
for (const command of commands) {
  assert.ok(names.has(`/${command.name}`), `help embed includes /${command.name}`);
  const field = embed.fields.find((entry) => entry.name === `/${command.name}`);
  assert.equal(field.value, command.description, `/${command.name} uses its registry description`);
}

console.log('Discord commands help smoke passed.');
