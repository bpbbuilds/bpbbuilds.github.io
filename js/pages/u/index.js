/**
 * Public profile — /u/{discord_id}/ (or /u/?d=)
 */

import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { getProfile } from '../../shared/auth.js';
import { getSupabase } from '../../shared/supabase.js';
import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';
import { fetchJson, rootPrefix } from './html.js';
import { mountProfileShell } from './shell.js?v=liked-once';
import { loadBlobCatalog } from './blob/catalog.js';
import { applyProfileBackground } from './profile-bg.js';

/**
 * @returns {string}
 */
function discordIdFromLocation() {
  const q = new URLSearchParams(location.search);
  const fromQuery = String(q.get('d') || q.get('id') || '').trim();
  if (fromQuery) return fromQuery;

  const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const uIdx = parts.lastIndexOf('u');
  if (uIdx >= 0 && parts[uIdx + 1]) return decodeURIComponent(parts[uIdx + 1]);
  return '';
}

/**
 * @param {string} discordId
 */
async function fetchProfile(discordId) {
  const supabase = getSupabase();
  const full =
    'id, discord_id, display_name, avatar_url, equipped_avatar, plan, founding_slot, is_owner, cosmetic_grants, coins';
  const core =
    'id, discord_id, display_name, avatar_url, equipped_avatar, plan, founding_slot, is_owner';

  let { data, error } = await supabase
    .from('profiles')
    .select(full)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (
    error &&
    (/cosmetic_grants|coins/i.test(String(error.message || '')) ||
      /column .* does not exist/i.test(String(error.message || '')))
  ) {
    console.warn(
      '[profile] profiles missing cosmetic_grants/coins — apply docs/db/sql/021 + 022',
    );
    ({ data, error } = await supabase
      .from('profiles')
      .select(core)
      .eq('discord_id', discordId)
      .maybeSingle());
  }

  if (error) throw error;
  if (data) {
    if (data.cosmetic_grants == null) {
      data = { ...data, cosmetic_grants: [] };
    }
    if (data.coins == null || !Number.isFinite(Number(data.coins))) {
      data = { ...data, coins: 0 };
    } else {
      data = { ...data, coins: Math.max(0, Math.floor(Number(data.coins))) };
    }
  }
  return data;
}

function loadingSkel() {
  return skelRegion(
    `<div class="profile-skel">
      <div class="profile-skel__hub">
        <div class="profile-skel__persona">
          ${skelBlock({ className: 'profile-skel__avatar' })}
          <div class="profile-skel__persona-copy">
            ${skelBar({ width: '42%' })}
            ${skelBar({ width: '28%' })}
          </div>
        </div>
        <div class="profile-skel__side">
          <div class="profile-skel__rail">${skelBlock()}${skelBlock()}${skelBlock()}</div>
        </div>
        <div class="profile-skel__stage">${skelBlock()}${skelBlock()}</div>
      </div>
    </div>`,
    { label: 'Loading profile' },
  );
}

async function boot() {
  if (!(await initNav())) return;
  initFooter({ variant: 'slim' });
  const main = document.getElementById('main');
  if (!(main instanceof HTMLElement)) return;
  const root = rootPrefix();
  const discordId = discordIdFromLocation();
  if (!discordId) {
    main.innerHTML = `<p class="build-status">Missing profile id. Use <code>/u/?d={discord_id}</code>.</p>`;
    return;
  }

  main.innerHTML = loadingSkel();

  try {
    const [profile, spriteDisplay, shapes, sockets] = await Promise.all([
      fetchProfile(discordId),
      fetchJson(`${root}assets/data/sprite-display.json`),
      fetchJson(`${root}assets/data/item-shapes.json`),
      fetchJson(`${root}assets/data/socket-offsets.json`),
    ]);

    if (!profile) {
      main.innerHTML = `<p class="build-status">Profile not found.</p>`;
      return;
    }

    const name = String(profile.display_name || profile.discord_id || 'Adventurer').trim();
    document.title = `${name} — Smojo Builds`;

    const viewerProfile = await getProfile();
    const isSelf =
      Boolean(viewerProfile?.discord_id) &&
      String(viewerProfile.discord_id) === String(profile.discord_id);

    mountProfileShell(main, {
      profile,
      viewerProfile,
      isSelf,
      root,
      assets: { spriteDisplay, shapes, sockets },
    });

    loadBlobCatalog(root)
      .then((cat) => applyProfileBackground(profile.equipped_avatar, cat))
      .catch((err) => console.error(err));
  } catch (err) {
    console.error(err);
    main.innerHTML = `<p class="build-status">Could not load profile.</p>`;
  }
}

boot();
