-- Canonical migration: supabase/migrations/20261002022000_enable_advisor_rls.sql
-- Apply with `supabase db push`; do not execute this documentation pointer separately.

-- Enables RLS on founding_promo, member_daily, and page_views. No direct
-- client policy is granted; their existing SECURITY DEFINER RPCs keep working.
