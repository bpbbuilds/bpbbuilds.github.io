/** Account-bound build votes. Authorization: Bearer <user JWT>. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Server misconfigured' }, 500);
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json({ error: 'Sign in to vote.' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: 'Sign in to vote.' }, 401);
  let body: { slug?: unknown; vote?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const slug = String(body.slug || '').trim();
  const rawVote = Number(body.vote);
  const vote = rawVote === -1 || rawVote === 0 || rawVote === 1 ? rawVote : null;
  if (!slug || !vote && vote !== 0) return json({ error: 'Invalid vote request' }, 400);
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: allowed, error: limitErr } = await supabase.rpc('consume_security_rate_limit', {
    p_endpoint: 'vote-build', p_subject_id: userData.user.id, p_limit: 30, p_window: '1 minute',
  });
  if (limitErr || allowed !== true) return json({ error: 'Too many vote changes. Try again shortly.' }, 429);
  const { data: build, error: buildErr } = await supabase.from('builds').select('id, slug, is_public').eq('slug', slug).maybeSingle();
  if (buildErr) return json({ error: 'Could not load build' }, 500);
  if (!build?.id || build.is_public !== true) return json({ error: 'Build not found' }, 404);
  if (vote === 0) {
    const { error } = await supabase.from('build_votes').delete().eq('build_id', build.id).eq('voter_key', userData.user.id);
    if (error) return json({ error: 'Could not clear vote' }, 500);
  } else {
    const { error } = await supabase.from('build_votes').upsert({ build_id: build.id, voter_key: userData.user.id, vote, updated_at: new Date().toISOString() }, { onConflict: 'build_id,voter_key' });
    if (error) return json({ error: 'Could not save vote' }, 500);
  }
  const { data: rows, error: sumErr } = await supabase.from('build_votes').select('vote').eq('build_id', build.id);
  if (sumErr) return json({ error: 'Could not sum votes' }, 500);
  const vote_score = (rows || []).reduce((sum, row) => sum + (Number(row.vote) || 0), 0);
  const { error: updateErr } = await supabase.from('builds').update({ vote_score, updated_at: new Date().toISOString() }).eq('id', build.id);
  if (updateErr) return json({ error: 'Could not update score' }, 500);
  return json({ slug: build.slug, vote_score, my_vote: vote });
});
