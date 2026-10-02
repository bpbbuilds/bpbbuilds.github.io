-- Run with `supabase test db` against a local database after applying all
-- migrations. These are regression checks for the Private-mode trust boundary.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

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

select * from finish();
rollback;
