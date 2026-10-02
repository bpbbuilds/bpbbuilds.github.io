/**
 * Prize Discord titles pick a guild role.
 * Nothing calls the Discord API yet. When the bot can list roles,
 * pass that fetch to setDiscordRoleLoader and the prize selects fill in.
 */

import { escapeAttr, escapeHtml } from './row.js';

/**
 * @typedef {{ id: string, name: string }} DiscordRole
 */

/** @type {(() => Promise<DiscordRole[]>) | null} */
let loader = null;

/**
 * @param {(() => Promise<DiscordRole[]>) | null} fn
 */
export function setDiscordRoleLoader(fn) {
  loader = fn;
}

/** @returns {Promise<DiscordRole[]>} */
export async function listDiscordRoles() {
  if (!loader) return [];
  try {
    const rows = await loader();
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({
        id: String(row?.id || '').trim(),
        name: String(row?.name || '').trim(),
      }))
      .filter((row) => row.id && row.name);
  } catch {
    return [];
  }
}

/**
 * @param {number} index
 * @param {{ discordTitle?: string, discordRoleId?: string }} place
 */
export function discordRoleField(index, place) {
  const title = String(place.discordTitle || '').trim();
  const roleId = String(place.discordRoleId || '').trim();
  const current = title
    ? `<option value="${escapeAttr(roleId || `name:${title}`)}" data-role-id="${escapeAttr(roleId)}" data-role-name="${escapeAttr(title)}" selected>${escapeHtml(title)}</option>`
    : '';
  return `<div>
    <label class="admin-event-form__key" for="ev-${index}-discordRole">Discord title</label>
    <select id="ev-${index}-discordRole" class="cr-input" name="place-${index}-discordRole" data-discord-role>
      <option value="">No role</option>
      ${current}
    </select>
    <p class="admin-event-form__role-hint cr-hint" data-discord-role-hint hidden></p>
  </div>`;
}

/**
 * @param {ParentNode} root
 */
export function bindDiscordRolePickers(root) {
  const selects = [...root.querySelectorAll('[data-discord-role]')].filter(
    (el) => el instanceof HTMLSelectElement,
  );
  if (!selects.length) return;
  listDiscordRoles().then((roles) => {
    for (const sel of selects) fillRoleSelect(sel, roles);
  });
}

/**
 * @param {HTMLSelectElement} sel
 * @param {DiscordRole[]} roles
 */
function fillRoleSelect(sel, roles) {
  const prev = readRoleOption(sel);
  const matched = roles.find((role) => role.id === prev.id || role.name === prev.name);
  const keepSaved = prev.name && !matched;
  const options = [`<option value="">No role</option>`];
  for (const role of roles) {
    const selected = matched && matched.id === role.id;
    options.push(roleOption(role.id, role.id, role.name, role.name, selected));
  }
  if (keepSaved) {
    options.push(roleOption(prev.id || `name:${prev.name}`, prev.id, prev.name, prev.name, true));
  }
  sel.innerHTML = options.join('');
  const hint = sel.parentElement?.querySelector('[data-discord-role-hint]');
  if (hint instanceof HTMLElement) {
    hint.hidden = roles.length > 0;
    hint.textContent = roles.length
      ? ''
      : 'Roles show up here once the Discord server is linked.';
  }
}

/**
 * @param {HTMLSelectElement} sel
 */
function readRoleOption(sel) {
  const opt = sel.selectedOptions[0];
  if (!(opt instanceof HTMLOptionElement) || !opt.value) return { id: '', name: '' };
  return {
    id: opt.getAttribute('data-role-id') || '',
    name: opt.getAttribute('data-role-name') || '',
  };
}

/**
 * @param {string} value
 * @param {string} roleId
 * @param {string} roleName
 * @param {string} label
 * @param {boolean} selected
 */
function roleOption(value, roleId, roleName, label, selected) {
  return `<option value="${escapeAttr(value)}" data-role-id="${escapeAttr(roleId)}" data-role-name="${escapeAttr(roleName)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

/**
 * @param {HTMLFormElement} form
 * @param {number} index
 * @returns {{ discordRoleId: string, discordTitle: string }}
 */
export function readPlaceDiscordRole(form, index) {
  const el = form.elements.namedItem(`place-${index}-discordRole`);
  if (!(el instanceof HTMLSelectElement)) return { discordRoleId: '', discordTitle: '' };
  return {
    discordRoleId: readRoleOption(el).id,
    discordTitle: readRoleOption(el).name,
  };
}
