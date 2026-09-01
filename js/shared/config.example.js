/**
 * Public browser config (safe to expose except submitSecret).
 * Copy to config.js and fill from .env, or run: node scripts/write-config.mjs
 *
 * submitSecret is owner break-glass only — never commit a real value.
 * Normal publish uses Discord JWT. Admin prefers owner Discord; secret unlocks /admin/.
 */
export const config = {
  supabaseUrl: 'YOUR_SUPABASE_PROJECT_URL',
  supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
  submitBuildUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/submit-build',
  adminBuildsUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/admin-builds',
  voteBuildUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/vote-build',
  submitSecret: '',
};
