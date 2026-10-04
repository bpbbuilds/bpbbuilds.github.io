-- Official cosmetic catalog workflow.
-- Upload creates an owner-only draft; Publish marks it live and the bot may announce it.

alter table public.cosmetic_drops
  add column if not exists published boolean not null default true,
  add column if not exists artist text not null default '',
  add column if not exists owner text not null default '',
  add column if not exists kind text not null default 'part',
  add column if not exists starter boolean not null default false,
  add column if not exists swatch text not null default '#8a5a2b',
  add column if not exists cost integer,
  add column if not exists added date;

comment on column public.cosmetic_drops.published is
  'False for an owner-uploaded catalog draft; true after the owner publishes it.';

-- The admin Edge Function uses the service role for its owner-gated writes.
-- Keep the dedicated image bucket public because published wardrobe art is public catalog data.
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

notify pgrst, 'reload schema';
