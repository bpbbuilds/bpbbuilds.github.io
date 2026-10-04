-- Moderated player cosmetic submissions.
-- Browsers never receive a direct table or Storage write policy. The
-- cosmetic-submissions Edge Function validates a signed-in user, rate-limits
-- uploads, and uses the service role to write private review assets.

create table if not exists public.cosmetic_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending',
  submitter_id uuid not null references public.profiles(id) on delete cascade,
  submitter_label text not null,
  cosmetic_id text not null,
  name text not null,
  slot text not null,
  rarity text not null,
  description text not null default '',
  image_path text not null,
  image_mime text not null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  published_cosmetic_id text,
  constraint cosmetic_submissions_status_chk check (status in ('pending', 'approved', 'rejected')),
  constraint cosmetic_submissions_cosmetic_id_chk check (cosmetic_id ~ '^[a-z0-9][a-z0-9_-]{1,80}$'),
  constraint cosmetic_submissions_name_len_chk check (char_length(btrim(name)) between 1 and 120),
  constraint cosmetic_submissions_slot_chk check (slot in ('hat', 'face', 'neck', 'head', 'body', 'hand')),
  constraint cosmetic_submissions_rarity_chk check (rarity in ('Common', 'Rare', 'Epic', 'Legendary', 'Godly', 'Unique')),
  constraint cosmetic_submissions_description_len_chk check (char_length(description) <= 500),
  constraint cosmetic_submissions_image_mime_chk check (image_mime in ('image/png', 'image/webp')),
  constraint cosmetic_submissions_review_state_chk check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null and published_cosmetic_id is null)
    or (status = 'rejected' and reviewed_at is not null and reviewed_by is not null and published_cosmetic_id is null)
    or (status = 'approved' and reviewed_at is not null and reviewed_by is not null and published_cosmetic_id is not null)
  )
);

comment on table public.cosmetic_submissions is
  'Private player-created blob-cosmetic submissions. Only the Edge Function and verified owners may process them.';
comment on column public.cosmetic_submissions.image_path is
  'Private cosmetic-submissions Storage object path. It is copied to cosmetic-assets only after approval.';

create index if not exists cosmetic_submissions_queue_idx
  on public.cosmetic_submissions (status, created_at asc);
create index if not exists cosmetic_submissions_submitter_idx
  on public.cosmetic_submissions (submitter_id, created_at desc);

alter table public.cosmetic_submissions enable row level security;
revoke all on table public.cosmetic_submissions from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cosmetic-submissions',
  'cosmetic-submissions',
  false,
  2097152,
  array['image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Keep the shared abuse-control helper allow-list in sync with this endpoint.
alter table public.security_rate_limit_events
  drop constraint if exists security_rate_limit_events_endpoint_check;
alter table public.security_rate_limit_events
  add constraint security_rate_limit_events_endpoint_check
  check (endpoint in ('vote-build', 'report-sim', 'submit-build', 'screenshot-to-build', 'cosmetic-submissions'));

create or replace function public.consume_security_rate_limit(
  p_endpoint text,
  p_subject_id uuid,
  p_limit integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare recent_count integer;
begin
  if p_endpoint not in ('vote-build', 'report-sim', 'submit-build', 'screenshot-to-build', 'cosmetic-submissions')
    or p_subject_id is null or p_limit < 1 or p_window <= interval '0 seconds' then
    raise exception 'invalid rate-limit request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_endpoint || ':' || p_subject_id::text, 0));
  delete from public.security_rate_limit_events
    where created_at < now() - greatest(p_window, interval '7 days');
  select count(*) into recent_count
    from public.security_rate_limit_events
    where endpoint = p_endpoint
      and subject_id = p_subject_id
      and created_at >= now() - p_window;
  if recent_count >= p_limit then return false; end if;
  insert into public.security_rate_limit_events (endpoint, subject_id)
    values (p_endpoint, p_subject_id);
  return true;
end;
$$;

revoke all on function public.consume_security_rate_limit(text, uuid, integer, interval)
  from public, anon, authenticated;
notify pgrst, 'reload schema';
