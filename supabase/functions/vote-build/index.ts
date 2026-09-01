/**
 * Public build vote (up / down / clear).
 * Body: { slug, vote: -1 | 0 | 1, voter_key?: uuid }
 * Optional Authorization: Bearer <user JWT> → use profiles.voter_key (bind if missing).
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VoteBody = {
  slug?: string;
  vote?: number;
  voter_key?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  let body: VoteBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const slug = String(body.slug || '').trim();
  const voteRaw = Number(body.vote);
  const vote: -1 | 0 | 1 | null =
    voteRaw === 1 || voteRaw === -1 || voteRaw === 0 ? voteRaw : null;

  if (!slug) return json({ error: 'slug is required' }, 400);
  if (vote === null) {
    return json({ error: 'vote must be -1, 0, or 1' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  let voter_key = String(body.voter_key || '').trim().toLowerCase();

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (jwt && anonKey) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, voter_key')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (profile?.id) {
        let bound = profile.voter_key
          ? String(profile.voter_key).toLowerCase()
          : '';
        if (!bound || !UUID_RE.test(bound)) {
          const candidate = UUID_RE.test(voter_key)
            ? voter_key
            : crypto.randomUUID();
          const { data: other } = await supabase
            .from('profiles')
            .select('id')
            .eq('voter_key', candidate)
            .neq('id', profile.id)
            .maybeSingle();
          if (other?.id) {
            bound = crypto.randomUUID();
          } else {
            bound = candidate;
          }
          await supabase
            .from('profiles')
            .update({ voter_key: bound, updated_at: new Date().toISOString() })
            .eq('id', profile.id);
        }
        voter_key = bound;
      }
    }
  }

  if (!UUID_RE.test(voter_key)) {
    return json({ error: 'voter_key must be a UUID' }, 400);
  }

  const { data: build, error: buildErr } = await supabase
    .from('builds')
    .select('id, slug, is_public')
    .eq('slug', slug)
    .maybeSingle();

  if (buildErr) {
    console.error(buildErr);
    return json({ error: 'Could not load build' }, 500);
  }
  if (!build?.id || build.is_public !== true) {
    return json({ error: 'Build not found' }, 404);
  }

  const buildId = build.id as number;

  if (vote === 0) {
    const { error: delErr } = await supabase
      .from('build_votes')
      .delete()
      .eq('build_id', buildId)
      .eq('voter_key', voter_key);
    if (delErr) {
      console.error(delErr);
      return json({ error: 'Could not clear vote' }, 500);
    }
  } else {
    const now = new Date().toISOString();
    const { error: upErr } = await supabase.from('build_votes').upsert(
      {
        build_id: buildId,
        voter_key,
        vote,
        updated_at: now,
      },
      { onConflict: 'build_id,voter_key' },
    );
    if (upErr) {
      console.error(upErr);
      return json({ error: 'Could not save vote' }, 500);
    }
  }

  const { data: sumRows, error: sumErr } = await supabase
    .from('build_votes')
    .select('vote')
    .eq('build_id', buildId);

  if (sumErr) {
    console.error(sumErr);
    return json({ error: 'Could not sum votes' }, 500);
  }

  const vote_score = (sumRows || []).reduce(
    (acc, row) => acc + (Number(row.vote) || 0),
    0,
  );

  const { error: scoreErr } = await supabase
    .from('builds')
    .update({ vote_score, updated_at: new Date().toISOString() })
    .eq('id', buildId);

  if (scoreErr) {
    console.error(scoreErr);
    return json({ error: 'Could not update score' }, 500);
  }

  return json({
    slug: build.slug,
    vote_score,
    my_vote: vote,
    voter_key,
  });
});
