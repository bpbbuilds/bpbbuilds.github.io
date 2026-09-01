/**
 * Game ItemBook.detectMentionedStacks: whole-word `$` + stackIdentifiers in DESCR.
 * Maps to frontend stack filter names (Block, Cold, …).
 */

/** Game.stackIdentifiers keyword → filter / EventType display name */
export const STACK_IDENTIFIERS = {
  spikes: 'Spikes',
  vampirism: 'Vampirism',
  poison: 'Poison',
  regen: 'Regeneration',
  bl: 'Block',
  lucky: 'Lucky',
  blind: 'Blind',
  mana: 'Mana',
  heat: 'Heat',
  cold: 'Cold',
  empower: 'Empower',
};

/**
 * Util.findWholeWord — match only if the char after needle is not [a-z0-9].
 * @param {string} text
 * @param {string} searchTerm
 */
export function findWholeWord(text, searchTerm) {
  const t = String(text || '');
  const needle = String(searchTerm || '');
  if (!needle) return -1;
  let from = 0;
  while (true) {
    const i = t.toLowerCase().indexOf(needle.toLowerCase(), from);
    if (i === -1) return -1;
    const after = t[i + needle.length];
    if (after && /[a-z0-9]/i.test(after)) {
      from = i + 1;
      continue;
    }
    return i;
  }
}

/**
 * @param {string} template raw game DESCR (with $cold / $bl / …)
 * @returns {string[]} e.g. ['Cold', 'Block']
 */
export function mentionedStacksFromTemplate(template) {
  const src = String(template || '');
  if (!src) return [];
  /** @type {string[]} */
  const out = [];
  for (const [key, name] of Object.entries(STACK_IDENTIFIERS)) {
    if (findWholeWord(src, `$${key}`) !== -1) out.push(name);
  }
  return out;
}
