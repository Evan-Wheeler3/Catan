import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Null when no backend is configured — the app then offers offline Practice only. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export interface ApiError {
  code: string;
  message: string;
}

/** Calls an Edge Function and unwraps our `{ error: { code, message } }` envelope. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<{ data: T; error: null } | { data: null; error: ApiError }> {
  if (!supabase) return { data: null, error: { code: 'offline', message: 'Online play is not set up on this build.' } };
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return { data: data as T, error: null };
  // FunctionsHttpError carries the response; pull our friendly message out of it.
  try {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx ? await ctx.json() : null;
    if (payload?.error) return { data: null, error: payload.error as ApiError };
  } catch {
    /* fall through */
  }
  const offline = /network|fetch/i.test(error.message);
  return {
    data: null,
    error: offline
      ? { code: 'network', message: "Can't reach the harbor right now. Check your connection and try again." }
      : { code: 'unknown', message: 'Something went wrong. Please try again.' },
  };
}
