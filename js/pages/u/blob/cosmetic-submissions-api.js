/**
 * Authenticated player cosmetic-submission API.
 * Files are sent only to the Edge Function; submitted art is never written
 * into the public wardrobe bucket until an owner approves it.
 */

import { getSession } from '../../../shared/auth.js';
import { config } from '../../../shared/config.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/webp']);

/** @param {File} file */
function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const value = String(reader.result || '');
      if (!value.startsWith('data:image/')) {
        reject(new Error('Choose a PNG or WebP image.'));
        return;
      }
      resolve(value);
    });
    reader.addEventListener('error', () => reject(new Error('Could not read the cosmetic image.')));
    reader.readAsDataURL(file);
  });
}

/** @param {string} endpoint @param {string} token @param {Record<string, unknown>} body */
async function post(endpoint, token, body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: String(config.supabasePublishableKey || ''),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(data?.error || `Submission failed (${response.status}).`));
  }
  return data;
}

/**
 * @param {{ id: string, name: string, slot: string, rarity: string, description: string, file: File }} payload
 */
export async function submitCosmeticSubmission(payload) {
  const endpoint = String(config.cosmeticSubmissionsUrl || '').trim();
  if (!endpoint || endpoint.includes('YOUR_')) {
    throw new Error('Cosmetic submissions are not configured yet.');
  }
  const file = payload.file;
  if (!(file instanceof File) || !file.size) throw new Error('Choose a PNG or WebP image.');
  if (!ALLOWED_TYPES.has(String(file.type || '').toLowerCase())) {
    throw new Error('Cosmetic art must be a PNG or WebP image.');
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Cosmetic art must be 2 MB or smaller.');

  const session = await getSession();
  if (!session?.access_token) throw new Error('Sign in with Discord before submitting cosmetic art.');
  const imageData = await fileAsDataUrl(file);
  return post(endpoint, session.access_token, {
    action: 'submit',
    cosmetic: {
      id: payload.id,
      name: payload.name,
      slot: payload.slot,
      rarity: payload.rarity,
      description: payload.description,
      imageData,
    },
  });
}
