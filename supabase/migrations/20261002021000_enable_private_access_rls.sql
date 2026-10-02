-- Restrictive policies only apply when row-level security is enabled.
-- These tables retain their existing permissive read policies in Live mode;
-- the restrictive Private-mode policies added in 029 then gate every read.
alter table public.items enable row level security;
alter table public.combinations enable row level security;
alter table public.combination_ingredients enable row level security;
alter table public.builds enable row level security;
alter table public.build_placements enable row level security;
alter table public.profiles enable row level security;

notify pgrst, 'reload schema';
