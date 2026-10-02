/**
 * Runtime site-access setting.
 * GET is public so the static client can decide whether to display the gate.
 * POST requires a signed-in owner and changes live/private mode.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function mode(value: unknown): 'live' | 'private' {
  return value === 'private' ? 'private' : 'live';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return reply({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return reply({ error: 'Server is not configured' }, 503);

  const supabase = createClient(supabaseUrl, serviceKey);
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value, updated_at')
      .eq('key', 'site_access_mode')
      .maybeSingle();
    if (error) return reply({ error: 'Could not read access mode' }, 500);
    return reply({ mode: mode(data?.value), updatedAt: data?.updated_at || null });
  }

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!jwt || !anonKey) return reply({ error: 'Sign in required' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return reply({ error: 'Sign in required' }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_owner')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError) return reply({ error: 'Could not verify owner access' }, 500);
  if (!profile?.is_owner) return reply({ error: 'Owner access required' }, 403);

  const body = await req.json().catch(() => null);
  if (body?.mode !== 'live' && body?.mode !== 'private') {
    return reply({ error: 'mode must be live or private' }, 400);
  }
  const { data, error } = await supabase
    .from('site_settings')
    .upsert({
      key: 'site_access_mode',
      value: body.mode,
      updated_at: new Date().toISOString(),
      updated_by: userData.user.id,
    }, { onConflict: 'key' })
    .select('value, updated_at')
    .single();
  if (error) return reply({ error: 'Could not update access mode' }, 500);
  return reply({ mode: mode(data?.value), updatedAt: data?.updated_at || null });
});
