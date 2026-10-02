-- Public equipped look for sim / combat Profile pick (separate from Discord avatar_url).
-- NULL or 'discord' → clients fall back to avatar_url.
-- Later: blob keys or https asset URLs.

alter table public.profiles
  add column if not exists equipped_avatar text;

comment on column public.profiles.equipped_avatar is
  'Public sim/combat look. NULL or ''discord'' → use avatar_url; later blob keys or https asset URLs.';
