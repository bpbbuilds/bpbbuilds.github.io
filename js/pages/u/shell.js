/**
 * Profile hub shell — left identity + rail, module stage.
 */

import { normalizePlan, planLabel } from '../../shared/entitlements.js';
import { getProfile } from '../../shared/auth.js';
import { faceHtml, hydrateFaces } from '../../shared/blob-face.js';
import { paintNavAuth } from '../../shared/nav/session.js';
import { escapeAttr, escapeHtml } from './html.js';
import { bindProfilePersonaScroll } from './persona-scroll.js';
import { mountBlobTab } from './tab-blob.js';
import { mountBuildsTab } from './tab-builds.js?v=liked-once';
import { mountInventoryTab } from './tab-inventory.js';
import { mountSettingsTab } from './tab-settings.js';
import {
  PROFILE_TAB_LABELS,
  normalizeTab,
  tabFromLocation,
  urlForTab,
  visibleTabs,
} from './tabs.js';

/**
 * @param {{ coins?: number | null }} profile
 * @param {string} root
 * @param {string} [className]
 */
function coinsRowHtml(profile, root, className = 'profile-coins') {
  const base = root.endsWith('/') ? root : `${root}/`;
  const coins =
    profile?.coins != null && Number.isFinite(Number(profile.coins))
      ? Math.max(0, Math.floor(Number(profile.coins)))
      : 0;
  const goldSrc = `${base}assets/tooltips/icons/Gold.png`;
  return `
    <div class="${escapeAttr(className)}" title="Coins" aria-label="${coins} coins">
      <img class="profile-coins__icon" src="${escapeAttr(goldSrc)}" alt="" width="22" height="22" draggable="false" decoding="async" />
      <span class="profile-coins__value">${escapeHtml(String(coins))}</span>
    </div>`;
}

/**
 * @param {object} profile
 * @param {string} name
 * @param {string} root
 */
function personaParts(profile, name, root) {
  const plan = normalizePlan(profile.plan);
  const entitled = plan === 'founding' || plan === 'premium';
  const flairHtml = entitled
    ? `<div class="profile-persona__flairs"><span class="profile-persona__flair profile-persona__flair--${escapeAttr(plan)}">${escapeHtml(planLabel(profile))}</span></div>`
    : '';
  const avatarClass = entitled
    ? `profile-persona__avatar profile-persona__avatar--${escapeAttr(plan)}`
    : 'profile-persona__avatar';
  const avatarHtml = faceHtml(profile, root, {
    className: avatarClass,
    alt: name,
    emptyHtml: `<span class="${avatarClass} profile-persona__avatar--empty" aria-hidden="true"></span>`,
  });
  const metaHtml = `<p class="profile-persona__meta">Discord · ${escapeHtml(String(profile.discord_id))}</p>`;
  const coinsHtml = coinsRowHtml(profile, root, 'profile-coins profile-coins--under-avatar');
  return { avatarHtml, flairHtml, metaHtml, coinsHtml, nameText: escapeHtml(name) };
}

/**
 * Big header — avatar over the tab column, name + Discord over the stage.
 * @param {object} profile
 * @param {string} name
 * @param {string} root
 */
function personaHtml(profile, name, root) {
  const p = personaParts(profile, name, root);
  return `
    <header class="profile-persona" data-profile-persona>
      <div class="profile-persona__avatar-cell">
        ${p.avatarHtml}
        ${p.coinsHtml}
      </div>
      <div class="profile-persona__copy">
        <h1 class="profile-persona__name bpb-label-text">${p.nameText}</h1>
        ${p.flairHtml}
        ${p.metaHtml}
      </div>
    </header>`;
}

/**
 * Mini card — sticky top of the tab column once the big header scrolls away.
 * @param {object} profile
 * @param {string} name
 * @param {string} root
 */
function miniPersonaHtml(profile, name, root) {
  const p = personaParts(profile, name, root);
  return `
    <div class="profile-mini" data-profile-mini aria-hidden="true">
      <div class="profile-mini__clip">
        <div class="profile-mini__inner">
          ${p.avatarHtml}
          ${p.coinsHtml}
          <p class="profile-persona__name profile-mini__name bpb-label-text">${p.nameText}</p>
          ${p.flairHtml}
          ${p.metaHtml}
        </div>
      </div>
    </div>`;
}

/**
 * @param {import('./tabs.js').ProfileTabId} active
 * @param {boolean} isSelf
 */
function railHtml(active, isSelf) {
  const tiles = visibleTabs(isSelf)
    .map((id) => {
      const on = id === active;
      return `
        <li class="profile-rail__item">
          <button
            type="button"
            class="profile-rail__tile${on ? ' is-active' : ''}"
            data-profile-tab="${escapeAttr(id)}"
            ${on ? 'aria-current="page"' : ''}
          >${escapeHtml(PROFILE_TAB_LABELS[id])}</button>
        </li>`;
    })
    .join('');

  return `
    <nav class="profile-rail" aria-label="Profile sections">
      <ul class="profile-rail__list">${tiles}</ul>
    </nav>`;
}

/**
 * @param {HTMLElement} stage
 * @param {import('./tabs.js').ProfileTabId} tab
 * @param {object} ctx
 * @param {{ onIdentityChange?: (payload: string) => void }} [hooks]
 */
async function mountStage(stage, tab, ctx, hooks = {}) {
  if (tab === 'builds') {
    await mountBuildsTab(stage, ctx);
    return;
  }
  if (tab === 'blob') {
    await mountBlobTab(stage, {
      ...ctx,
      onLoadoutChange: hooks.onIdentityChange,
    });
    return;
  }
  if (tab === 'inventory') {
    await mountInventoryTab(stage, ctx);
    return;
  }
  if (tab === 'settings') {
    mountSettingsTab(stage, {
      ...ctx,
      onIdentityChange: hooks.onIdentityChange,
    });
  }
}

/**
 * @param {HTMLElement} main
 * @param {{
 *   profile: object,
 *   viewerProfile: object | null,
 *   isSelf: boolean,
 *   root: string,
 *   assets: { spriteDisplay: object | null, shapes: object | null, sockets: object | null },
 * }} opts
 */
export function mountProfileShell(main, opts) {
  const { profile, viewerProfile, isSelf, root, assets } = opts;
  const name = String(profile.display_name || profile.discord_id || 'Adventurer').trim();
  let active = tabFromLocation(isSelf);
  /** @type {(() => void) | null} */
  let unbindPersona = null;

  /** @type {{ profile: object, viewerProfile: object | null, isSelf: boolean, root: string, name: string, assets: typeof assets, buildsCache: object[] | null }} */
  const ctx = {
    profile,
    viewerProfile,
    isSelf,
    root,
    name,
    assets,
    buildsCache: null,
  };

  main.innerHTML = `
    <div class="profile-hub">
      ${personaHtml(profile, name, root)}
      <aside class="profile-side">
        ${miniPersonaHtml(profile, name, root)}
        ${railHtml(active, isSelf)}
      </aside>
      <div class="profile-stage" data-profile-stage aria-live="polite"></div>
    </div>`;

  const stage = main.querySelector('[data-profile-stage]');
  const side = main.querySelector('.profile-side');
  if (!(stage instanceof HTMLElement) || !(side instanceof HTMLElement)) return;

  const bindPersona = () => {
    unbindPersona?.();
    unbindPersona = null;
    const persona = main.querySelector('[data-profile-persona]');
    const mini = main.querySelector('[data-profile-mini]');
    if (!(persona instanceof HTMLElement) || !(mini instanceof HTMLElement)) return;
    unbindPersona = bindProfilePersonaScroll(persona, mini);
    void hydrateFaces(main, root);
  };

  /**
   * @param {string} payload
   */
  const onIdentityChange = (payload) => {
    ctx.profile.equipped_avatar = payload;
    if (ctx.viewerProfile) ctx.viewerProfile.equipped_avatar = payload;
    const persona = main.querySelector('[data-profile-persona]');
    const mini = main.querySelector('[data-profile-mini]');
    if (persona instanceof HTMLElement) {
      persona.outerHTML = personaHtml(ctx.profile, ctx.name, ctx.root);
    }
    if (mini instanceof HTMLElement) {
      mini.outerHTML = miniPersonaHtml(ctx.profile, ctx.name, ctx.root);
    }
    bindPersona();
    const authHosts = [...document.querySelectorAll('[data-nav-auth]')].filter(
      (el) => el instanceof HTMLElement,
    );
    if (authHosts.length) {
      void getProfile({ force: true })
        .then(() => Promise.all(authHosts.map((el) => paintNavAuth(el, root))))
        .catch((err) => console.error(err));
    }
  };

  const paintRail = () => {
    const current = side.querySelector('.profile-rail');
    if (!(current instanceof HTMLElement)) return;
    current.outerHTML = railHtml(active, isSelf);
    const next = side.querySelector('.profile-rail');
    if (next instanceof HTMLElement) bindRail(next);
  };

  /**
   * @param {HTMLElement} railEl
   */
  const bindRail = (railEl) => {
    railEl.addEventListener('click', (e) => {
      const btn = e.target instanceof Element ? e.target.closest('[data-profile-tab]') : null;
      if (!(btn instanceof HTMLButtonElement)) return;
      const next = normalizeTab(btn.getAttribute('data-profile-tab'), isSelf);
      if (next === active) return;
      void setTab(next, true);
    });
  };

  /**
   * @param {import('./tabs.js').ProfileTabId} tab
   * @param {boolean} push
   */
  const setTab = async (tab, push) => {
    active = normalizeTab(tab, isSelf);
    if (push) {
      history.pushState({ profileTab: active }, '', urlForTab(active));
    }
    paintRail();
    const stageEl = main.querySelector('[data-profile-stage]');
    if (stageEl instanceof HTMLElement) await mountStage(stageEl, active, ctx, { onIdentityChange });
  };

  const rail = side.querySelector('.profile-rail');
  if (rail instanceof HTMLElement) bindRail(rail);
  bindPersona();
  void mountStage(stage, active, ctx, { onIdentityChange });

  const onPop = () => {
    const next = tabFromLocation(isSelf);
    if (next === active) return;
    active = next;
    paintRail();
    const stageEl = main.querySelector('[data-profile-stage]');
    if (stageEl instanceof HTMLElement) void mountStage(stageEl, active, ctx, { onIdentityChange });
  };
  window.addEventListener('popstate', onPop);
}
