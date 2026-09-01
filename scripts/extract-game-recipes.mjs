/**
 * Parse recipes_raw from game-items.json → scripts/_cache/game-recipes.json
 *
 * Per Utility/Recipe.gd:
 *   row owner = base ingredient
 *   "A+B>Result" → ingredients [owner, A, B…], result = right of ">"
 *
 * Example: Death Scythe row "Whetstone>War Scythe"
 *   → Death Scythe + Whetstone → War Scythe
 *
 * Usage:
 *   node scripts/extract-game-recipes.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ITEMS = path.join(__dirname, '_cache', 'game-items.json');
const OUT = path.join(__dirname, '_cache', 'game-recipes.json');

/**
 * @param {string} ownerName base item (row owner)
 * @param {string} recipeStr single recipe e.g. "Whetstone>War Scythe" or "A+B>Result"
 */
export function parseRecipeString(ownerName, recipeStr) {
  const raw = String(recipeStr || '').trim();
  if (!raw || !raw.includes('>')) {
    return null;
  }
  const [left, right] = raw.split('>').map((s) => s.trim());
  if (!right) return null;

  const extras = left
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => (name.endsWith('*') ? name.slice(0, -1).trim() : name))
    .filter(Boolean);

  const ingredientNames = [ownerName, ...extras];
  return {
    resultName: right,
    ingredientNames,
    raw,
  };
}

/** Item.Type names used as recipe ingredients (e.g. Fire*>Burning Coal). */
const TYPE_INGREDIENTS = new Set([
  'Bag',
  'Consumable',
  'Food',
  'Pet',
  'Weapon',
  'Shield',
  'Armor',
  'Gloves',
  'Shoes',
  'Helmet',
  'Accessory',
  'Potion',
  'Card',
  'Gem',
  'Scroll',
  'Book',
  'Skill',
  'ChessPiece',
  'Spell',
  'Melee',
  'Ranged',
  'Effect',
  'Holy',
  'Magic',
  'Vampiric',
  'Dark',
  'Nature',
  'Fire',
  'Ice',
  'Musical',
]);

/**
 * ItemBook.addCauldronRecipes: Potion + Cauldron → Strong Potion
 * @param {{ name: string, gid: number|null, type?: string, extraTypes?: string[] }[]} items
 * @param {object[]} recipes
 */
function addCauldronRecipes(items, recipes) {
  const byName = new Map(items.map((i) => [i.name, i]));
  if (!byName.has('Cauldron')) return;
  let added = 0;
  for (const item of items) {
    const primary = String(item.type || '')
      .replace(/\s+Weapon$/i, '')
      .trim();
    const types = [primary, ...(item.extraTypes || [])].map((t) =>
      String(t || '').toLowerCase(),
    );
    if (!types.includes('potion')) continue;
    const strongName = `Strong ${item.name}`;
    if (!byName.has(strongName)) continue;
    // Skip if already present from recipesRaw (e.g. Health Potion → Strong Health Potion)
    if (
      recipes.some(
        (r) => r.resultName === strongName && r.ingredientNames?.includes('Cauldron'),
      )
    ) {
      continue;
    }
    recipes.push({
      resultName: strongName,
      resultGid: null,
      ownerName: item.name,
      ownerGid: item.gid,
      ingredientNames: [item.name, 'Cauldron'],
      raw: `Cauldron>${strongName}`,
      source: 'addCauldronRecipes',
    });
    added++;
  }
  return added;
}

function main() {
  const { items } = JSON.parse(fs.readFileSync(ITEMS, 'utf8'));
  const recipes = [];
  for (const item of items) {
    const raw = item.recipesRaw;
    if (!raw) continue;
    for (const part of String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const parsed = parseRecipeString(item.name, part);
      if (!parsed) {
        recipes.push({
          resultName: null,
          resultGid: null,
          ownerName: item.name,
          ownerGid: item.gid,
          ingredientNames: [],
          raw: part,
          skipped: true,
        });
        continue;
      }
      recipes.push({
        resultName: parsed.resultName,
        resultGid: null, // filled at import via name resolve
        ownerName: item.name,
        ownerGid: item.gid,
        ingredientNames: parsed.ingredientNames,
        raw: parsed.raw,
        typeIngredients: parsed.ingredientNames.filter((n) =>
          TYPE_INGREDIENTS.has(n),
        ),
      });
    }
  }

  const cauldronAdded = addCauldronRecipes(items, recipes);

  fs.writeFileSync(
    OUT,
    JSON.stringify({ count: recipes.length, recipes }, null, 2),
  );
  console.log('wrote', OUT, 'recipes', recipes.length, 'cauldronAdded', cauldronAdded);
  console.log(
    'deathScythe row',
    recipes.filter((r) => r.ownerName === 'Death Scythe'),
  );
  console.log(
    'warScythe as result',
    recipes.filter((r) => r.resultName === 'War Scythe'),
  );
}

main();
