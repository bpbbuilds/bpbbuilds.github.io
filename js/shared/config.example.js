/**
 * Public browser config (safe to expose except submitSecret).
 * Copy to config.js and fill from .env, or run: node scripts/write-config.mjs
 *
 * submitSecret is owner break-glass only — never commit a real value.
 * Normal publish uses Discord JWT. Admin prefers owner Discord; secret unlocks /admin/.
 */
export const config = {
  // 'live' (public) or 'private' (signed-in Discord server members only)
  siteAccessMode: 'live',
  supabaseUrl: 'YOUR_SUPABASE_PROJECT_URL',
  supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
  submitBuildUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/submit-build',
  adminBuildsUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/admin-builds',
  adminReportsUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/admin-reports',
  siteAccessUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/site-access',
  voteBuildUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/vote-build',
  createCheckoutUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/create-checkout',
  createPortalUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/create-portal',
  reportSimUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/report-sim',
  screenshotToBuildUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/screenshot-to-build',
  discordGuildUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/discord-guild',
  cosmeticCatalogUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/cosmetic-catalog',
  cosmeticSubmissionsUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/cosmetic-submissions',
};
