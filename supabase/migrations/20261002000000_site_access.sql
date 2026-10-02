-- Runtime public/private application access setting.
-- The value is read and written only by the site-access Edge Function.

create table if not exists public.site_settings (
  key text primary key check (key = 'site_access_mode'),
  value text not null check (value in ('live', 'private')),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.site_settings (key, value)
values ('site_access_mode', 'live')
on conflict (key) do nothing;

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from public;

comment on table public.site_settings is
  'Small owner-managed site settings. site_access_mode controls the Discord-member UI access gate.';
