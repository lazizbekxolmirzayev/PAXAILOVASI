import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Only the public anon key is used in the browser; all privileged work happens in
// Row-Level-Security-protected tables and Edge Functions.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true } }) : null;
export const cloudEnabled = !!supabase;
