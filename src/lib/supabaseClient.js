// supabaseClient.js — one Supabase client for the whole app.
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.js';

let clientPromise = null;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = Promise.resolve(
      createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
        realtime: {
          params: { eventsPerSecond: 40 },
        },
      })
    );
  }
  return clientPromise;
}
