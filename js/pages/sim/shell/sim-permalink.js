/**
 * Deep-link helpers for /sim/?slug=&round=&seed=&mode=&t=&speed=
 */

/**
 * @param {string | number | null | undefined} raw
 * @returns {number | null}
 */
export function parseDummyBlock(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

export function parseSimRound(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

/**
 * Play CTA from a build page (current scrubber round).
 * @param {string} root
 * @param {string} slug
 * @param {number | null | undefined} round
 */
export function buildSimPlayHref(root, slug, round) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const q = new URLSearchParams();
  q.set('slug', slug);
  const r = parseSimRound(round);
  if (r != null) q.set('round', String(r));
  return `${base}sim/?${q.toString()}`;
}

/**
 * @returns {{
 *   slug: string | null,
 *   round: number | null,
 *   seed: string | null,
 *   mode: 'demo' | 'engine' | null,
 *   t: number | null,
 *   speed: number | null,
 *   dummyBlock: number,
 *   dummyHp: number | null,
 *   dummyAtk: boolean | null,
 *   dummyDmg: number | null,
 *   dummyCd: number | null,
 *   oppSlug: string | null,
 *   oppRound: number | null,
 *   foe: 'dummy' | 'build' | 'mirror' | null,
 * }}
 */
export function readSimQuery() {
  const q = new URLSearchParams(location.search);
  const modeRaw = q.get('mode');
  const mode = modeRaw === 'demo' || modeRaw === 'engine' ? modeRaw : null;
  const tRaw = q.get('t');
  const t = tRaw != null && tRaw !== '' ? Number(tRaw) : null;
  const speedRaw = q.get('speed');
  const speed = speedRaw != null && speedRaw !== '' ? Number(speedRaw) : null;
  const foeRaw = String(q.get('foe') || '')
    .trim()
    .toLowerCase();
  const foe =
    foeRaw === 'dummy' || foeRaw === 'build' || foeRaw === 'mirror'
      ? foeRaw
      : null;
  const dummyHpRaw = q.get('dummyHp');
  const dummyHpN = dummyHpRaw != null && dummyHpRaw !== '' ? Number(dummyHpRaw) : null;
  const dummyAtkRaw = q.get('dummyAtk');
  const dummyAtk =
    dummyAtkRaw === '0'
      ? false
      : dummyAtkRaw === '1'
        ? true
        : null;
  const dummyDmgRaw = q.get('dummyDmg');
  const dummyDmgN = dummyDmgRaw != null && dummyDmgRaw !== '' ? Number(dummyDmgRaw) : null;
  const dummyCdRaw = q.get('dummyCd');
  const dummyCdN = dummyCdRaw != null && dummyCdRaw !== '' ? Number(dummyCdRaw) : null;
  return {
    slug: q.get('slug')?.trim() || null,
    round: parseSimRound(q.get('round')),
    seed: q.get('seed')?.trim() || null,
    mode,
    t: Number.isFinite(t) && t >= 0 ? t : null,
    speed: Number.isFinite(speed) && speed > 0 ? speed : null,
    dummyBlock: parseDummyBlock(q.get('dummyBlock')),
    dummyHp: Number.isFinite(dummyHpN) && dummyHpN > 0 ? Math.round(dummyHpN) : null,
    dummyAtk,
    dummyDmg: Number.isFinite(dummyDmgN) && dummyDmgN >= 0 ? Math.round(dummyDmgN) : null,
    dummyCd: Number.isFinite(dummyCdN) && dummyCdN > 0 ? dummyCdN : null,
    oppSlug: q.get('oppSlug')?.trim() || null,
    oppRound: parseSimRound(q.get('oppRound')),
    foe,
  };
}

/**
 * @param {{
 *   slug?: string | null,
 *   round?: number | null,
 *   seed?: string | number | null,
 *   mode?: 'demo' | 'engine' | null,
 *   t?: number | null,
 *   speed?: number | null,
 *   dummyBlock?: number | null,
 *   dummyHp?: number | null,
 *   dummyAtk?: boolean | null,
 *   dummyDmg?: number | null,
 *   dummyCd?: number | null,
 *   oppSlug?: string | null,
 *   oppRound?: number | null,
 *   foe?: 'dummy' | 'build' | 'mirror' | null,
 * }} patch
 * @param {{ replace?: boolean }} [opts]
 */
export function patchSimQuery(patch, opts = {}) {
  const q = new URLSearchParams(location.search);
  if ('slug' in patch) {
    if (patch.slug) q.set('slug', String(patch.slug));
    else q.delete('slug');
  }
  if ('round' in patch) {
    const r = parseSimRound(patch.round);
    if (r != null) q.set('round', String(r));
    else q.delete('round');
  }
  if ('seed' in patch && patch.seed != null && patch.seed !== '') {
    q.set('seed', String(patch.seed));
  }
  if ('mode' in patch && patch.mode) q.set('mode', patch.mode);
  if ('t' in patch) {
    if (patch.t == null || patch.t <= 0) q.delete('t');
    else {
      const n = Math.round(Number(patch.t) * 100) / 100;
      q.set('t', String(n));
    }
  }
  if ('speed' in patch) {
    if (!patch.speed || patch.speed === 1) q.delete('speed');
    else q.set('speed', String(patch.speed));
  }
  if ('dummyBlock' in patch) {
    const n = parseDummyBlock(patch.dummyBlock);
    if (n > 0) q.set('dummyBlock', String(n));
    else q.delete('dummyBlock');
  }
  if ('dummyHp' in patch) {
    const n = Number(patch.dummyHp);
    if (Number.isFinite(n) && n > 0) q.set('dummyHp', String(Math.round(n)));
    else q.delete('dummyHp');
  }
  if ('dummyAtk' in patch) {
    if (patch.dummyAtk === false) q.set('dummyAtk', '0');
    else if (patch.dummyAtk === true) q.delete('dummyAtk');
    else q.delete('dummyAtk');
  }
  if ('dummyDmg' in patch) {
    const n = Number(patch.dummyDmg);
    if (Number.isFinite(n) && n >= 0) q.set('dummyDmg', String(Math.round(n)));
    else q.delete('dummyDmg');
  }
  if ('dummyCd' in patch) {
    const n = Number(patch.dummyCd);
    if (Number.isFinite(n) && n > 0) q.set('dummyCd', String(n));
    else q.delete('dummyCd');
  }
  if ('oppSlug' in patch) {
    if (patch.oppSlug) q.set('oppSlug', String(patch.oppSlug));
    else q.delete('oppSlug');
  }
  if ('oppRound' in patch) {
    const r = parseSimRound(patch.oppRound);
    if (r != null) q.set('oppRound', String(r));
    else q.delete('oppRound');
  }
  if ('foe' in patch) {
    const f = String(patch.foe || '')
      .trim()
      .toLowerCase();
    if (f === 'dummy' || f === 'build' || f === 'mirror') q.set('foe', f);
    else q.delete('foe');
  }
  const next = `${location.pathname}?${q.toString()}${location.hash || ''}`;
  if (opts.replace === false) history.pushState(null, '', next);
  else history.replaceState(null, '', next);
}

/**
 * Build a shareable relative query string.
 * @param {{
 *   slug?: string | null,
 *   round?: number | null,
 *   seed: string | number,
 *   mode: 'demo' | 'engine',
 *   t?: number,
 *   speed?: number,
 *   dummyBlock?: number,
 *   dummyHp?: number | null,
 *   dummyAtk?: boolean | null,
 *   dummyDmg?: number | null,
 *   dummyCd?: number | null,
 *   oppSlug?: string | null,
 *   oppRound?: number | null,
 *   foe?: 'dummy' | 'build' | 'mirror' | null,
 * }} opts
 */
export function buildPermalinkQuery(opts) {
  const q = new URLSearchParams();
  if (opts.slug) q.set('slug', opts.slug);
  const r = parseSimRound(opts.round);
  if (r != null) q.set('round', String(r));
  q.set('seed', String(opts.seed));
  q.set('mode', opts.mode);
  if (opts.t != null && opts.t > 0) q.set('t', opts.t.toFixed(2));
  if (opts.speed && opts.speed !== 1) q.set('speed', String(opts.speed));
  const dummyBlock = parseDummyBlock(opts.dummyBlock);
  if (dummyBlock > 0) q.set('dummyBlock', String(dummyBlock));
  if (opts.dummyHp != null && Number(opts.dummyHp) > 0) {
    q.set('dummyHp', String(Math.round(Number(opts.dummyHp))));
  }
  if (opts.dummyAtk === false) q.set('dummyAtk', '0');
  if (opts.dummyDmg != null && Number.isFinite(Number(opts.dummyDmg))) {
    q.set('dummyDmg', String(Math.round(Number(opts.dummyDmg))));
  }
  if (opts.dummyCd != null && Number(opts.dummyCd) > 0) {
    q.set('dummyCd', String(opts.dummyCd));
  }
  const foe = String(opts.foe || '')
    .trim()
    .toLowerCase();
  if (foe === 'dummy' || foe === 'build' || foe === 'mirror') q.set('foe', foe);
  if (foe === 'build' || !foe) {
    if (opts.oppSlug) q.set('oppSlug', String(opts.oppSlug));
    const oppR = parseSimRound(opts.oppRound);
    if (oppR != null) q.set('oppRound', String(oppR));
  }
  return q.toString();
}
