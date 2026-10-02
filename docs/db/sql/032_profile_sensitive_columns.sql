-- Canonical migration: supabase/migrations/20261002023000_profile_sensitive_columns.sql
-- Apply with `supabase db push`; do not execute this documentation pointer separately.

-- Public profile cards retain display/cosmetic/plan fields. Payment ids, vote
-- keys, ownership, and Discord access verification are only in the
-- authenticated `get_my_profile()` response for the account that owns them.
