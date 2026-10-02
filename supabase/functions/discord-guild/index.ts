/**
 * Signed-in check: is this Discord account in the community server?
 * If yes, mirror profiles.plan onto the Premium / Founding roles.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, DISCORD_BOT_*
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { discordConfigured, syncPlanRoles } from '../_shared/discord.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  if (!discordConfigured()) return reply({ error: 'Discord bot is not configured' }, 503);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!supabaseUrl || !serviceKey || !anonKey || !jwt) {
    return reply({ error: 'Sign in required' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return reply({ error: 'Sign in required' }, 401);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('discord_id, plan')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error) return reply({ error: 'Profile read failed' }, 500);

  const discordId = String(profile?.discord_id || '').trim();
  if (!discordId) return reply({ inGuild: null });

  const { count } = await supabase
    .from('builds')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userData.user.id);

  const result = await syncPlanRoles(
    discordId,
    String(profile?.plan || 'free'),
    count || 0,
  );
  return reply({ inGuild: result.inGuild });
});
