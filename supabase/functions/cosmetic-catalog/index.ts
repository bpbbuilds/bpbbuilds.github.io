/** Public published blob-cosmetic catalog. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET') return reply({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !serviceKey) return reply({ error: 'Server misconfigured' }, 500);

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase
    .from('cosmetic_drops')
    .select('id,name,slot,rarity,grant,description,image,artist,owner,kind,starter,swatch,cost,added')
    .eq('published', true)
    .order('name', { ascending: true });
  if (error) return reply({ error: 'Could not load cosmetic catalog' }, 500);
  return reply({ items: data || [] });
});
