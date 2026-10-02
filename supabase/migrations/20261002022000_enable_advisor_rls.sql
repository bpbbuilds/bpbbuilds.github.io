-- Supabase Advisor: all public-schema tables must have RLS enabled.
-- These tables are accessed only by SECURITY DEFINER RPCs; no client policy is
-- added, so direct Data API reads and writes remain denied.
alter table public.founding_promo enable row level security;
alter table public.member_daily enable row level security;
alter table public.page_views enable row level security;

notify pgrst, 'reload schema';
