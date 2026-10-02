/**
 * Phase 268–270 — /sim/ engine banner may say “1:1” only when tech gates
 * 252+258+264+265 hold **and** Phase 38 allows public marketing. 270 closeout
 * does not flip that on.
 */

/**
 * @typedef {{
 *   252?: boolean,
 *   258?: boolean,
 *   264?: boolean,
 *   265?: boolean,
 * }} Engine11Gates
 */

/**
 * @typedef {{
 *   phase38CounselReview?: boolean,
 *   allowPublicMatchesTheGameMarketing?: boolean,
 * }} EngineLegalFlags
 */

/**
 * @param {Engine11Gates | null | undefined} gates
 */
export function allEngine11Gates(gates) {
  return !!(gates?.['252'] && gates?.['258'] && gates?.['264'] && gates?.['265']);
}

/**
 * @param {EngineLegalFlags | null | undefined} legal
 */
export function phase38AllowsEngine11Marketing(legal) {
  return !!(
    legal?.phase38CounselReview && legal?.allowPublicMatchesTheGameMarketing
  );
}

/**
 * @param {string} title
 */
export function bannerTitleClaimsEngine11(title) {
  return /^\s*engine 1:1\b/i.test(String(title || ''));
}

/**
 * @param {Engine11Gates | null | undefined} gates
 * @param {{ solidPct?: number, parityPct?: number }} [cov]
 * @param {EngineLegalFlags | null | undefined} [legal]
 */
export function engineBannerCopy(gates, cov = {}, legal = {}) {
  if (allEngine11Gates(gates) && phase38AllowsEngine11Marketing(legal)) {
    return {
      title: 'Engine 1:1',
      detail:
        'dummy fight vs GDScript ports (fan sim). Not a publisher / official product.',
    };
  }
  const solid = Number(cov.solidPct) || 0;
  const parity = Number(cov.parityPct) || 0;
  if (allEngine11Gates(gates) && !phase38AllowsEngine11Marketing(legal)) {
    return {
      title: 'Engine — fixture-validated subset',
      detail:
        'partial / fixture subset. Not engine 1:1 in public copy until Phase 38 counsel review.',
    };
  }
  if (solid < 90) {
    return {
      title: 'Engine (partial)',
      detail: 'partial / fixture subset. Not engine 1:1.',
    };
  }
  if (parity >= 75) {
    return {
      title: 'Engine — fixture-validated subset',
      detail:
        'partial / fixture subset. Not engine 1:1 until 252 + 258 + 264 + 265 hold, and not as public “matches the game” marketing until Phase 38.',
    };
  }
  return {
    title: 'Engine (partial)',
    detail: 'partial / fixture subset. Not engine 1:1.',
  };
}

/**
 * @param {string} root
 * @returns {Promise<{ gates: Engine11Gates | null, legal: EngineLegalFlags }>}
 */
export async function loadEngineClaim(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  try {
    const res = await fetch(`${base}assets/data/sim-engine-claim.json`);
    if (!res.ok) return { gates: null, legal: {} };
    const json = await res.json();
    return { gates: json?.gates || null, legal: json?.legal || {} };
  } catch {
    return { gates: null, legal: {} };
  }
}
