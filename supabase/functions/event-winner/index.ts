/** Public, read-only winner result for an event whose entries are public. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    },
  });
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const slug = new URL(req.url).searchParams.get('event')?.trim().toLowerCase() || '';
  if (!SLUG_RE.test(slug) || slug.length > 80) return json({ error: 'Invalid event' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server misconfigured' }, 500);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: selected, error: winnerError } = await supabase
    .from('event_winners')
    .select('build_id, selected_at')
    .eq('event_slug', slug)
    .maybeSingle();
  if (winnerError) return json({ error: 'Could not load event winner' }, 500);
  if (!selected?.build_id) return json({ winner: null });

  // The owner may select a winner during judging. Do not reveal the board until
  // the normal SQL visibility job has made that build public.
  const { data: build, error: buildError } = await supabase
    .from('builds')
    .select(`
      id, slug, title, hero_class, build_tag, rank, gold_count, created_at,
      board_still_path, is_public, event_slug, author_name,
      profile:profiles!builds_author_id_fkey (
        discord_id, display_name, avatar_url, equipped_avatar
      )
    `)
    .eq('id', selected.build_id)
    .eq('event_slug', slug)
    .maybeSingle();
  if (buildError) return json({ error: 'Could not load winning build' }, 500);
  if (!build) return json({ winner: null });

  // The selection itself is safe to acknowledge while judging, but the
  // entrant/build identity remains private until the SQL visibility job
  // releases the event entry. This lets the Events module show that a winner
  // was selected without leaking the held build early.
  if (build.is_public !== true) {
    return json({
      winner: {
        selected_at: selected.selected_at,
        build: null,
      },
    });
  }

  const raw = Array.isArray(build.profile) ? build.profile[0] : build.profile;
  const profile = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return json({
    winner: {
      selected_at: selected.selected_at,
      build: {
        id: build.id,
        slug: build.slug,
        title: build.title,
        hero_class: build.hero_class,
        build_tag: build.build_tag,
        rank: build.rank,
        gold_count: build.gold_count,
        created_at: build.created_at,
        board_still_path: build.board_still_path,
        author_name: String(profile.display_name || build.author_name || 'Unknown'),
        author_discord_id: profile.discord_id || null,
        author_avatar_url: profile.avatar_url || null,
        author_equipped_avatar: profile.equipped_avatar || null,
      },
    },
  });
});
