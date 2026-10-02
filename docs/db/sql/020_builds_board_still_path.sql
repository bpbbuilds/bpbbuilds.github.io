-- Catalog board still path (Supabase Storage bucket board-stills).
-- Null → client paints from placements (legacy / failed upload).
-- Do not use thumbnail_path (YouTube / featured video art).

alter table public.builds
  add column if not exists board_still_path text;

comment on column public.builds.board_still_path is
  'Storage object path in public bucket board-stills ({author_id}/{uuid}.webp|png). Null = client canvas thumb.';

-- Public bucket for baked board thumbs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-stills',
  'board-stills',
  true,
  2097152,
  array['image/webp', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read
drop policy if exists "Public read board-stills" on storage.objects;
create policy "Public read board-stills"
  on storage.objects
  for select
  using (bucket_id = 'board-stills');

-- Authenticated upload only under {auth.uid()}/…
drop policy if exists "Auth upload own board-stills" on storage.objects;
create policy "Auth upload own board-stills"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'board-stills'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow overwrite of own objects (upsert on re-submit attempts)
drop policy if exists "Auth update own board-stills" on storage.objects;
create policy "Auth update own board-stills"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'board-stills'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'board-stills'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
