/**
 * Optional launch gate for the static site.
 *
 * `siteAccessMode: 'private'` requires a Discord session whose account is in
 * the community server. `live` leaves the public site unchanged.
 */
import { getSession, onAuthChange, signInWithDiscord, signOut } from './auth.js';
import { config } from './config.js';
import { DISCORD_INVITE_URL } from './social-links.js';

let gate = null;
let gatePromise = null;
let checking = false;

function privateMode() {
  return String(config.siteAccessMode || 'live').toLowerCase() === 'private';
}

function showGate(state = 'checking') {
  if (!(gate instanceof HTMLElement)) {
    gate = document.createElement('section');
    gate.className = 'bpb-access-gate';
    gate.setAttribute('aria-live', 'polite');
    document.body.appendChild(gate);
  }

  const content = {
    checking: {
      title: 'Checking access',
      message: 'Verifying your BPB Builds access…',
      actions: '',
    },
    signin: {
      title: 'BPB Builds is in private access',
      message: 'Sign in with Discord to verify that you are a member of the BPB Builds server.',
      actions: '<button type="button" class="bpb-access-gate__primary" data-access-signin>Sign in with Discord</button>',
    },
    member: {
      title: 'Discord server members only',
      message: 'BPB Builds is currently available only to members of the BPB Builds Discord server. Join the server, then choose Check again.',
      actions: `
        <a class="bpb-access-gate__primary" href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer">Join the Discord server</a>
        <button type="button" class="bpb-access-gate__secondary" data-access-check>Check again</button>
        <button type="button" class="bpb-access-gate__text" data-access-signout>Use another Discord account</button>
      `,
    },
    unavailable: {
      title: 'Access check unavailable',
      message: 'We could not verify Discord server membership. Please try again in a moment.',
      actions: '<button type="button" class="bpb-access-gate__primary" data-access-check>Try again</button>',
    },
  }[state] || { title: 'Checking access', message: 'Verifying access…', actions: '' };

  gate.innerHTML = `
    <div class="bpb-access-gate__backdrop"></div>
    <div class="bpb-access-gate__panel bpb-panel--rewards" role="dialog" aria-modal="true" aria-labelledby="bpb-access-gate-title">
      <img class="bpb-access-gate__logo" src="${document.body.dataset.root || './'}assets/theme/logo-bpb.png" alt="BPB Builds" />
      <h1 id="bpb-access-gate-title">${content.title}</h1>
      <div class="bpb-access-gate__rule" aria-hidden="true"><span></span><i></i><span></span></div>
      <p>${content.message}</p>
      <div class="bpb-access-gate__actions">${content.actions}</div>
    </div>
  `;
  document.body.classList.add('bpb-access-gate-open');
  gate.querySelector('[data-access-signin]')?.addEventListener('click', () => {
    signInWithDiscord().catch((error) => {
      console.error('[access-gate] Discord sign-in failed', error);
      showGate('signin');
    });
  });
  gate.querySelector('[data-access-check]')?.addEventListener('click', () => {
    void checkAccess();
  });
  gate.querySelector('[data-access-signout]')?.addEventListener('click', () => {
    signOut().finally(() => showGate('signin'));
  });
}

function allowAccess() {
  gate?.remove();
  gate = null;
  document.body.classList.remove('bpb-access-gate-open');
}

async function checkAccess() {
  if (!privateMode()) return true;
  if (checking) return false;
  checking = true;
  showGate('checking');
  try {
    const session = await getSession();
    if (!session?.access_token) {
      showGate('signin');
      return false;
    }
    if (!config.discordGuildUrl) {
      showGate('unavailable');
      return false;
    }
    const response = await fetch(config.discordGuildUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: config.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.inGuild == null) {
      showGate('unavailable');
      return false;
    }
    if (body.inGuild !== true) {
      showGate('member');
      return false;
    }
    allowAccess();
    return true;
  } catch (error) {
    console.error('[access-gate] membership check failed', error);
    showGate('unavailable');
    return false;
  } finally {
    checking = false;
  }
}

/** Start the site-wide gate. Safe to call from every page bootstrap. */
export function initSiteAccess() {
  if (!privateMode()) return Promise.resolve(true);
  if (!gatePromise) {
    gatePromise = checkAccess();
    onAuthChange(() => {
      void checkAccess();
    });
  }
  return gatePromise;
}

/** @returns {'live' | 'private'} */
export function siteAccessMode() {
  return privateMode() ? 'private' : 'live';
}
