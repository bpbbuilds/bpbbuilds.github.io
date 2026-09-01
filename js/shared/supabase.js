import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { config } from './config.js';

let client;

export function getSupabase() {
  if (client) return client;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey) {
    throw new Error('Missing supabase config — run: node scripts/write-config.mjs');
  }
  if (config.supabaseUrl.includes('YOUR_')) {
    throw new Error('Fill js/shared/config.js from config.example.js');
  }
  client = createClient(config.supabaseUrl, config.supabasePublishableKey);
  return client;
}
