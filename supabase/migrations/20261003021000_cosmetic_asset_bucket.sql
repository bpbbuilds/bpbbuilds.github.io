-- Keep official cosmetic uploads in their own public bucket. Do not alter the
-- existing Discord bot bucket or any of its objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cosmetic-assets',
  'cosmetic-assets',
  true,
  2097152,
  array['image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
