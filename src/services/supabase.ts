import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured || !supabaseUrl || !supabaseKey) return null;
  client ??= createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}

export async function ensureAnonymousIdentity(): Promise<User> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Global rankings are not configured on this build.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error('Could not create a guest account.');
  return data.user;
}
