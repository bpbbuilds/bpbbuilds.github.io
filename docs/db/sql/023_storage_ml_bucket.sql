-- Public Storage bucket for screenshot-detector ONNX + classes JSON.
-- Apply in SQL editor or: node scripts/screenshot-detector/ensure-ml-bucket.mjs
-- (script prefers SERVICE_ROLE Storage API; falls back to this SQL via SUPABASE_DB_URL).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ml',
  'ml',
  true,
  52428800,
  array['application/octet-stream', 'application/json', 'application/onnx']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (detector loads from /object/public/ml/...)
drop policy if exists "Public read ml" on storage.objects;
create policy "Public read ml"
  on storage.objects
  for select
  using (bucket_id = 'ml');

-- Service role / dashboard uploads only (no anon writes).
-- Upserts from publish-model.mjs use the service_role key which bypasses RLS.

notify pgrst, 'reload schema';
