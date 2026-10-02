/**
 * Profile page backdrop — default town scene only (no equipable backgrounds in v1).
 */

/**
 * @param {string | null | undefined} _equippedAvatar
 * @param {import('./blob/catalog.js').BlobCosmetic[]} [_catalog]
 */
export function applyProfileBackground(_equippedAvatar, _catalog) {
  const body = document.body;
  if (!(body instanceof HTMLElement)) return;
  body.style.removeProperty('--profile-equip-bg');
  body.classList.remove('has-profile-equip-bg');
}
