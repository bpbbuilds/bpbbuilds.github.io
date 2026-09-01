/**
 * Smoke-test anon REST nested select used by the build page.
 * Does not print secrets.
 */
import { config } from '../js/shared/config.js';

const select =
  'id,slug,title,route_r3,route_r10,placements:build_placements(id,x,y,priority,item:items(id,name,image,shape))';

const url = new URL(`${config.supabaseUrl}/rest/v1/builds`);
url.searchParams.set('select', select);
url.searchParams.set('slug', 'eq.infinite-combo-machine');
url.searchParams.set('is_public', 'eq.true');
url.searchParams.set('limit', '1');

const res = await fetch(url, {
  headers: {
    apikey: config.supabasePublishableKey,
    Authorization: `Bearer ${config.supabasePublishableKey}`,
    Accept: 'application/json',
  },
});

if (!res.ok) {
  console.error('HTTP', res.status, await res.text());
  process.exit(1);
}

const rows = await res.json();
const data = rows[0];
if (!data) {
  console.error('no row');
  process.exit(1);
}

console.log('slug:', data.slug);
console.log('placements:', data.placements?.length ?? 0);
console.log(
  'items:',
  (data.placements || [])
    .map((p) => `${p.item?.name}@${p.x},${p.y}[${p.priority}]`)
    .join(' | '),
);
