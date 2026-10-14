import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// The generated config can change independently of the shared client bundle.
// Keep a versioned import so a deployed test page cannot reuse an older project
// origin from the browser module cache after a config correction.
import { config } from './config.js?v=supabase-config-20261013a';

let client;

export function getSupabase() {
  if (client) return client;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey) {
    throw new Error('Missing supabase config — run: node scripts/write-config.mjs');
  }
  if (config.supabaseUrl.includes('YOUR_')) {
    throw new Error('Fill js/shared/config.js from config.example.js');
  }
  client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      // auth.js completes the callback explicitly. This avoids relying on an SDK
      // initialization race when GitHub Pages reloads after Discord returns.
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  });
  return client;
}
