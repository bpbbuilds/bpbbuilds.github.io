-- Public equipped look for sim / combat Profile pick (separate from Discord avatar_url).
-- NULL defaults to the website blob; 'discord' is an explicit Discord-avatar choice.
-- Later: blob keys or https asset URLs.

alter table public.profiles
  add column if not exists equipped_avatar text;

comment on column public.profiles.equipped_avatar is
  'Public sim/combat look. NULL → website blob; ''discord'' → use avatar_url; JSON loadouts may select either base.';
