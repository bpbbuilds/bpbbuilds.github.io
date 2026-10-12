/**
 * Source-backed item art states that persist or change during a fight.
 *
 * The extracted game swaps the Icon texture for these states. Keeping the
 * state on the combat piece lets the scrubber render the same state at every
 * snapshot instead of relying on a one-shot animation event.
 */

export const SIM_VISUAL_VARIANTS = Object.freeze({
  phoenix: Object.freeze({ ash: 'Phoenix_Ash.png' }),
  phoenix2: Object.freeze({ ash: 'Phoenix2_Ash.png' }),
  dark_lantern: Object.freeze({ used: 'DarkLantern_used.png' }),
  deer_totem: Object.freeze({ active: 'DeerTotem_active.png' }),
  dual_wielding: Object.freeze({ active: 'DualWielding_active.png' }),
  full_body_protection: Object.freeze({ active: 'FullBodyProtection_active.png' }),
  vampiric_gloves: Object.freeze({ active: 'VampiricGloves_active.png' }),
  pumpkin: Object.freeze({ glowing: 'Pumpkin_glowing.png' }),
  lucky_cat: Object.freeze({
    none: 'LuckyCat_no_paw.png',
    one: 'LuckyCat_left_paw.png',
    two: 'LuckyCat_both_paws.png',
  }),
  scale: Object.freeze({
    base: 'Scale.png',
    left: 'Scale_left.png',
    right: 'Scale_right.png',
  }),
});

/**
 * @param {object | null | undefined} piece
 * @returns {string | null}
 */
export function visualStateForPiece(piece) {
  const id = String(piece?.itemId || piece?.id || '').toLowerCase();
  if (id === 'phoenix' || id === 'phoenix2') {
    return piece?._phxUsed ? 'ash' : null;
  }
  if (id === 'dark_lantern') return piece?._lanternUsed ? 'used' : null;
  if (id === 'deer_totem') return piece?._deerRageActive ? 'active' : null;
  if (id === 'dual_wielding') return piece?._dualWieldingActive ? 'active' : null;
  if (id === 'full_body_protection') return piece?._fbpActive ? 'active' : null;
  if (id === 'vampiric_gloves') return piece?._vampiricGlovesActive ? 'active' : null;
  if (id === 'pumpkin') return piece?._pumpkinGlowing ? 'glowing' : null;
  if (id === 'lucky_cat') return piece?._luckyCatState || null;
  if (id === 'scale') return piece?._scaleState || null;
  return null;
}

/**
 * Return the source asset for a state, or null when the normal catalog art
 * should be used.
 *
 * @param {string} itemId
 * @param {string | null | undefined} state
 * @returns {string | null}
 */
export function visualVariantFor(itemId, state) {
  const variants = SIM_VISUAL_VARIANTS[String(itemId || '').toLowerCase()];
  const file = variants?.[String(state || '')];
  return typeof file === 'string' ? file : null;
}

/**
 * @param {Array<{t:number, byKey: Record<string, {visualState?: string|null}>}>} snapshots
 * @param {number} t
 * @param {string} key
 * @returns {string | null}
 */
export function visualStateAt(snapshots, t, key) {
  if (!Array.isArray(snapshots) || !key) return null;
  let state = null;
  for (const snap of snapshots) {
    if (Number(snap?.t) > Number(t) + 1e-6) break;
    const value = snap?.byKey?.[key]?.visualState;
    if (value !== undefined) state = value || null;
  }
  return state;
}
