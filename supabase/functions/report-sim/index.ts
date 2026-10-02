/** Authenticated, size-limited combat sandbox issue reports. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SESSION_BYTES = 32 * 1024;
const clip = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Server misconfigured' }, 500);
  const length = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json({ error: 'Report is too large' }, 413);
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json({ error: 'Sign in to submit a report.' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: 'Sign in to submit a report.' }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const description = clip(body.description, 4000);
  if (!description) return json({ error: 'Description is required' }, 400);
  const session = body.session && typeof body.session === 'object' && !Array.isArray(body.session) ? body.session : {};
  try { if (JSON.stringify(session).length > MAX_SESSION_BYTES) return json({ error: 'Session data is too large' }, 413); } catch { return json({ error: 'Invalid session data' }, 400); }
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: allowed, error: limitErr } = await supabase.rpc('consume_security_rate_limit', { p_endpoint: 'report-sim', p_subject_id: userData.user.id, p_limit: 5, p_window: '1 hour' });
  if (limitErr || allowed !== true) return json({ error: 'Report limit reached. Try again later.' }, 429);
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userData.user.id).maybeSingle();
  const name = clip(profile?.display_name, 80) || 'Signed in';
  const numberOrNull = (v: unknown) => Number.isFinite(Number(v)) ? Math.round(Number(v)) : null;
  const { data, error } = await supabase.from('sim_reports').insert({
    reporter_id: userData.user.id, reporter_label: name, description,
    seed: clip(body.seed, 64) || null, you_title: clip(body.youTitle, 120) || null,
    you_slug: clip(body.youSlug, 80) || null, you_round: numberOrNull(body.youRound),
    foe_mode: clip(body.foeMode, 24) || null, foe_label: clip(body.foeLabel, 200) || null,
    permalink: clip(body.permalink, 1500) || null, coverage_pct: numberOrNull(body.coveragePct), session,
  }).select('id').maybeSingle();
  if (error) return json({ error: 'Could not save report' }, 500);
  return json({ ok: true, id: data?.id || null });
});
