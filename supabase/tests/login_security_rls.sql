-- Run with `supabase test db` against a local database after applying all
-- migrations. These are regression checks for the Private-mode trust boundary.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_function('private', 'site_access_allowed', 'Private-mode predicate is not exposed through public');
select isnt(
  to_regprocedure('public.private_site_access_allowed()'),
  to_regprocedure('private.site_access_allowed()'),
  'Public private-mode predicate was removed'
);
select results_eq(
  $$select has_table_privilege('anon', 'public.profiles', 'UPDATE')$$,
  $$values (false)$$,
  'Anonymous users cannot update profiles'
);
select results_eq(
  $$select has_table_privilege('authenticated', 'public.profiles', 'DELETE')$$,
  $$values (false)$$,
  'Authenticated users cannot delete profiles'
);
select results_eq(
  $$select relrowsecurity from pg_class where oid = 'public.founding_promo'::regclass$$,
  $$values (true)$$,
  'Founding promo has RLS enabled'
);
select results_eq(
  $$select relrowsecurity from pg_class where oid = 'public.member_daily'::regclass$$,
  $$values (true)$$,
  'Member daily has RLS enabled'
);
select results_eq(
  $$select relrowsecurity from pg_class where oid = 'public.page_views'::regclass$$,
  $$values (true)$$,
  'Page views has RLS enabled'
);
select results_eq(
  $$select has_column_privilege('anon', 'public.profiles', 'stripe_customer_id', 'select')$$,
  $$values (false)$$,
  'Stripe customer ids are not publicly selectable'
);
select results_eq(
  $$select has_column_privilege('anon', 'public.profiles', 'voter_key', 'select')$$,
  $$values (false)$$,
  'Vote keys are not publicly selectable'
);
select has_function('public', 'get_my_profile', 'Self-profile RPC exists');

select * from finish();
rollback;
