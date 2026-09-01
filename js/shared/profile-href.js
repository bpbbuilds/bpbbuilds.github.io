/**
 * Public profile URL — query form works on static hosts (Live Server + GitHub Pages).
 * Pretty `/u/{id}/` still resolves on Pages via 404.html → ?d=
 *
 * @param {string | null | undefined} discordId
 * @param {string} root site root prefix ending with `/` or not
 * @returns {string | null}
 */
export function profileHref(discordId, root) {
  const id = String(discordId || '').trim();
  if (!id) return null;
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}u/?d=${encodeURIComponent(id)}`;
}
