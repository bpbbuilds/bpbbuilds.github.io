/**
 * After sign-in, ask to join the community server when the bot says
 * this Discord account is not a member. Members are left alone.
 */
import { getSession } from './auth.js';
import { config } from './config.js';
import { DISCORD_INVITE_URL } from './social-links.js';

const ASKED = 'bpb-discord-join-asked';

/** @type {HTMLElement | null} */
let layer = null;

function alreadyAsked() {
  try {
    return sessionStorage.getItem(ASKED) === '1';
  } catch {
    return false;
  }
}

function markAsked() {
  try {
    sessionStorage.setItem(ASKED, '1');
  } catch {
    /* private mode */
  }
}

function closeJoinPrompt() {
  if (layer) layer.hidden = true;
  document.body.classList.remove('bpb-discord-join-open');
  markAsked();
}

function showJoinPrompt() {
  if (!(layer instanceof HTMLElement)) {
    layer = document.createElement('div');
    layer.className = 'bpb-discord-join';
    layer.innerHTML = `
      <div class="bpb-discord-join__backdrop" data-discord-join-close tabindex="-1"></div>
      <div
        class="bpb-discord-join__panel bpb-panel--rewards"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bpb-discord-join-title"
      >
        <button type="button" class="bpb-discord-join__x" data-discord-join-close aria-label="Close">×</button>
        <h2 id="bpb-discord-join-title" class="bpb-discord-join__title">Join the server</h2>
        <div class="bpb-discord-join__rule" aria-hidden="true"><span></span><i></i><span></span></div>
        <p class="bpb-discord-join__hint">Would you like to join our Discord server?</p>
        <a class="bpb-discord-join__join" href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer">Join</a>
        <button type="button" class="bpb-discord-join__later" data-discord-join-close>Not now</button>
      </div>
    `;
    layer.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('[data-discord-join-close]')) closeJoinPrompt();
      if (t?.closest('.bpb-discord-join__join')) markAsked();
    });
    document.body.appendChild(layer);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && layer && !layer.hidden) closeJoinPrompt();
    });
  }
  layer.hidden = false;
  document.body.classList.add('bpb-discord-join-open');
}

/** Check membership and open the invite prompt when they are not in the server. */
export async function maybePromptDiscordJoin() {
  // The private launch gate owns this state and must not leave a dismissible
  // invite prompt over the mandatory membership screen.
  if (String(config.siteAccessMode || 'live').toLowerCase() === 'private') return;
  if (alreadyAsked()) return;
  const url = config.discordGuildUrl;
  if (!url) return;
  const session = await getSession();
  const token = session?.access_token;
  if (!token) return;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) return;
    const body = await res.json();
    if (body?.inGuild === false) showJoinPrompt();
  } catch (err) {
    console.error(err);
  }
}
