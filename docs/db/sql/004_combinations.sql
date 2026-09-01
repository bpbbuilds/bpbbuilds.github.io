-- Catalog craft recipes (depends on public.items)
-- Source: docs/db/tables/combinations-table.md

create table if not exists public.combinations (
  id bigint generated always as identity primary key,
  result_item_id text not null references public.items (id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists combinations_result_item_id_idx
  on public.combinations (result_item_id);

create table if not exists public.combination_ingredients (
  id bigint generated always as identity primary key,
  combination_id bigint not null
    references public.combinations (id) on delete cascade,
  item_id text not null references public.items (id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  sort_order integer not null default 0,
  unique (combination_id, item_id)
);

create index if not exists combination_ingredients_item_id_idx
  on public.combination_ingredients (item_id);

create index if not exists combination_ingredients_combination_id_idx
  on public.combination_ingredients (combination_id);

alter table public.combinations enable row level security;
alter table public.combination_ingredients enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'combinations'
      and policyname = 'Public read combinations'
  ) then
    create policy "Public read combinations"
      on public.combinations
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'combination_ingredients'
      and policyname = 'Public read combination_ingredients'
  ) then
    create policy "Public read combination_ingredients"
      on public.combination_ingredients
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;
