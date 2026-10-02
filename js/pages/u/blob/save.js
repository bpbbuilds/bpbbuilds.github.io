/**
 * Persist blob loadout to profiles.equipped_avatar (own row only).
 */

import { getSupabase } from '../../../shared/supabase.js';
import { refreshProfile } from '../../../shared/auth.js';
import { serializeLoadout } from './loadout.js';

/**
 * @param {import('./loadout.js').BlobLoadout} loadout
 */
export async function saveBlobLoadout(loadout) {
  const supabase = getSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user?.id) throw new Error('Sign in to save your blob loadout.');

  const payload = serializeLoadout(loadout);
  const { error } = await supabase
    .from('profiles')
    .update({ equipped_avatar: payload })
    .eq('id', user.id);
  if (error) throw error;
  await refreshProfile().catch(() => null);
  return payload;
}
