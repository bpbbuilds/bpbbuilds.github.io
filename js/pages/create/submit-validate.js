/**
 * Create-page submit checks — hard errors vs soft completeness cues.
 */

import { youtubeId } from '../../shared/youtube.js';
import { isLegalStartingBag } from '../../shared/starting-bags.js';
import {
  accessVerdict,
  isHardIllegalAccess,
} from '../../shared/item-access.js';
import { HERO_CLASSES } from '../items/filter-logic.js';
import { isBagItem } from './collision.js';

/**
 * @typedef {{ level: 'error' | 'warn', code: string, message: string }} DraftCue
 * @typedef {{
 *   ok: boolean,
 *   errors: DraftCue[],
 *   warnings: DraftCue[],
 * }} DraftValidation
 */

/**
 * Soft completeness cues (always safe to show on the Build tab).
 * @param {import('./draft-io.js').Draft} draft
 * @param {{ itemsById?: Map<string, object> }} [opts]
 * @returns {DraftCue[]}
 */
export function collectSoftCues(draft, opts = {}) {
  /** @type {DraftCue[]} */
  const cues = [];
  const itemsById = opts.itemsById;
  const hasNeeds = (draft.placements || []).some((p) => p.priority === 'needed');
  if (draft.placements?.length && !hasNeeds) {
    cues.push({ level: 'warn', code: 'needs', message: 'Needs tier is empty.' });
  }
  if (!String(draft.notes || '').trim()) {
    cues.push({ level: 'warn', code: 'notes', message: '“Why it works” notes are empty.' });
  }
  if (
    draft.is_op &&
    draft.build_tag !== 'feasible' &&
    draft.build_tag !== 'real'
  ) {
    cues.push({
      level: 'warn',
      code: 'op-feasible',
      message: 'OP builds should also be tagged Feasible or Real.',
    });
  }
  if (draft.is_op && !draft.youtube_url) {
    cues.push({
      level: 'warn',
      code: 'op-video',
      message: 'OP builds welcome a YouTube video (optional).',
    });
  }
  if (itemsById instanceof Map && draft.placements?.length) {
    const hasBag = draft.placements.some((p) => isBagItem(itemsById.get(p.id)));
    if (!hasBag) {
      cues.push({
        level: 'warn',
        code: 'bag-board',
        message: 'No bag on the board (OK if you sold the starter).',
      });
    }
    const hero = String(draft.hero_class || '').trim();
    if (hero) {
      const softNames = [];
      for (const p of draft.placements) {
        const item = itemsById.get(p.id);
        if (accessVerdict(hero, item) === 'soft-cross-class') {
          const name = String(item?.name || p.id).trim();
          if (name && !softNames.includes(name)) softNames.push(name);
        }
      }
      if (softNames.length) {
        const sample = softNames.slice(0, 3).join(', ');
        const more =
          softNames.length > 3 ? ` (+${softNames.length - 3} more)` : '';
        cues.push({
          level: 'warn',
          code: 'cross-class',
          message: `Other-class items on the board (OK via badge / unlock, even if sold): ${sample}${more}.`,
        });
      }
    }
  }
  return cues;
}

/**
 * @param {import('./draft-io.js').Draft} draft
 * @param {Map<string, object>} itemsById
 * @returns {DraftCue[]}
 */
function collectAccessErrors(draft, itemsById) {
  /** @type {DraftCue[]} */
  const errors = [];
  const hero = String(draft.hero_class || '').trim();
  if (!hero || !(itemsById instanceof Map)) return errors;

  /** @type {string[]} */
  const badUniques = [];
  /** @type {string[]} */
  const badSkills = [];

  const check = (itemId, label) => {
    const id = String(itemId || '').trim();
    if (!id) return;
    const item = itemsById.get(id);
    const verdict = accessVerdict(hero, item);
    if (!isHardIllegalAccess(verdict)) return;
    const name = String(item?.name || id).trim() || id;
    const tagged = label ? `${name} (${label})` : name;
    if (verdict === 'illegal-class-unique') {
      if (!badUniques.includes(tagged)) badUniques.push(tagged);
    } else if (!badSkills.includes(tagged)) {
      badSkills.push(tagged);
    }
  };

  for (const p of draft.placements || []) check(p.id, '');
  check(draft.route_r3_item_id, 'R3');
  check(draft.route_r10_item_id, 'R10');

  if (badUniques.length) {
    const sample = badUniques.slice(0, 3).join(', ');
    const more =
      badUniques.length > 3 ? ` (+${badUniques.length - 3} more)` : '';
    errors.push({
      level: 'error',
      code: 'class-unique',
      message: `Class Unique items don’t match this hero: ${sample}${more}.`,
    });
  }
  if (badSkills.length) {
    const sample = badSkills.slice(0, 3).join(', ');
    const more =
      badSkills.length > 3 ? ` (+${badSkills.length - 3} more)` : '';
    errors.push({
      level: 'error',
      code: 'class-skill',
      message: `Skills don’t match this hero: ${sample}${more}.`,
    });
  }
  return errors;
}

/**
 * Hard submit validation. Warnings are soft cues (do not block).
 * @param {import('./draft-io.js').Draft} draft
 * @param {{ itemsById?: Map<string, object> }} [opts]
 * @returns {DraftValidation}
 */
export function validateCreateDraft(draft, opts = {}) {
  /** @type {DraftCue[]} */
  const errors = [];
  const itemsById = opts.itemsById;

  if (!String(draft.title || '').trim()) {
    errors.push({ level: 'error', code: 'title', message: 'Title is required.' });
  }
  const hero = String(draft.hero_class || '').trim();
  if (!hero || !HERO_CLASSES.includes(hero)) {
    errors.push({ level: 'error', code: 'class', message: 'Pick a class.' });
  }
  if (!isLegalStartingBag(hero, draft.starting_bag_id)) {
    errors.push({
      level: 'error',
      code: 'starting-bag',
      message: 'Pick a starting bag for this class.',
    });
  }
  const hasTag =
    draft.is_op ||
    draft.build_tag === 'feasible' ||
    draft.build_tag === 'theory' ||
    draft.build_tag === 'real';
  if (!hasTag) {
    errors.push({
      level: 'error',
      code: 'tag',
      message: 'Pick a tag (Theory, Feasible, Real, or OP).',
    });
  }
  if (draft.build_tag === 'real' && !draft.history?.rounds?.length) {
    errors.push({
      level: 'error',
      code: 'real-history',
      message: 'Real requires an attached History run.',
    });
  }
  if (draft.history?.rounds?.length && draft.build_tag !== 'real') {
    errors.push({
      level: 'error',
      code: 'history-real',
      message: 'Attached history must be tagged Real.',
    });
  }
  if (!draft.rank) {
    errors.push({ level: 'error', code: 'rank', message: 'Pick a league rank.' });
  }
  if (!draft.placements?.length) {
    errors.push({
      level: 'error',
      code: 'board',
      message: 'Place at least one item on the board.',
    });
  }
  if (!draft.route_r3_item_id) {
    errors.push({ level: 'error', code: 'r3', message: 'Round 3 skill is required.' });
  }
  if (!draft.route_r10_item_id) {
    errors.push({ level: 'error', code: 'r10', message: 'Round 10 skill is required.' });
  }
  if (draft.youtube_url && !youtubeId(draft.youtube_url)) {
    errors.push({
      level: 'error',
      code: 'youtube',
      message: 'Fix or clear the YouTube link.',
    });
  }
  if (draft.is_op && draft.build_tag === 'theory') {
    errors.push({
      level: 'error',
      code: 'op-theory',
      message: 'OP can’t be combined with Theory.',
    });
  }

  if (itemsById instanceof Map) {
    errors.push(...collectAccessErrors(draft, itemsById));
  }

  const warnings = collectSoftCues(draft, { itemsById }).filter(
    (c) => !errors.some((e) => e.code === c.code),
  );

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
