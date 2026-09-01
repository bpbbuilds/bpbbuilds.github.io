/**
 * Band AK — combat noops: shop junk + chess pieces.
 * Gems moved to Band AN socket apply (not board noops).
 */

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * @param {string} id
 * @param {string} note
 * @returns {ScriptHandler}
 */
function noopPort(id, note) {
  return {
    handlerId: id,
    family: 'unique',
    deferStartActivate: true,
    onCombatStart(piece, ctx) {
      piece.cooldown = 999;
      piece.triggerTime = 999;
      void ctx;
      void note;
    },
  };
}

const SHOP = [
  'coins',
  'customer_card',
  'lootbox',
  'amulet_unidentified',
  'box_of_riches',
  'unidentified_skill',
  'leather_bag',
  'box_of_prosperity',
  'engineer_bag_2',
  'random_loadout_bag',
  'hypercube',
  'snowman',
  'furcifer_prime',
  'employee_uniform',
];

const CHESS = [
  'black_bishop',
  'black_king',
  'black_knight',
  'black_pawn',
  'black_queen',
  'black_rook',
  'white_bishop',
  'white_king',
  'white_knight',
  'white_pawn',
  'white_queen',
  'white_rook',
];

/** @type {Record<string, ScriptHandler>} */
export const AK_NOOP_PORTS = {};
for (const id of SHOP) {
  AK_NOOP_PORTS[id] = noopPort(id, 'shop/storage combat noop (AK/AN)');
}
for (const id of CHESS) {
  AK_NOOP_PORTS[id] = noopPort(id, 'chess piece AI noop (same as chess_board)');
}

export const AK_NOOP_IDS = [...SHOP, ...CHESS];
export const AN_SHOP_NOOP_IDS = [
  'hypercube',
  'snowman',
  'furcifer_prime',
  'employee_uniform',
];
