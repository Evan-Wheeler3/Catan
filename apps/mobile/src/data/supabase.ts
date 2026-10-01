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

// Optional override, e.g. the Docker-free dev server (supabase/functions/dev-server.ts).
const functionsUrl = process.env.EXPO_PUBLIC_FUNCTIONS_URL || (url ? `${url}/functions/v1` : '');

/** Calls an Edge Function and unwraps our `{ error: { code, message } }` envelope. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<{ data: T; error: null } | { data: null; error: ApiError }> {
  if (!supabase) return { data: null, error: { code: 'offline', message: 'Online play is not set up on this build.' } };
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return { data: null, error: { code: 'signed_out', message: 'Please sign in again.' } };
  try {
    const res = await fetch(`${functionsUrl}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey!, Authorization: `Bearer ${auth.session.access_token}` },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    if (res.ok) return { data: payload as T, error: null };
    if (payload?.error?.message) return { data: null, error: payload.error as ApiError };
    return { data: null, error: { code: `http_${res.status}`, message: 'Something went wrong. Please try again.' } };
  } catch {
    return { data: null, error: { code: 'network', message: "Can't reach the harbor right now. Check your connection and try again." } };
  }
}
