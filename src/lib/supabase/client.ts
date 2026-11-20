import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when .env.local is missing; the app then shows setup instructions instead of crashing. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Only the public anon key is ever used in the browser. Row Level Security in
// the database is what keeps each user's data private.
export const supabase: SupabaseClient<Database> = isSupabaseConfigured
  ? createClient<Database>(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Sign-in is email + PIN only; there are no email links to read from the URL.
        detectSessionInUrl: false,
      },
    })
  : (null as unknown as SupabaseClient<Database>);
