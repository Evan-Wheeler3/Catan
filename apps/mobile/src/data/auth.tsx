import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export interface Profile {
  id: string;
  username: string;
  avatar: string;
}

interface AuthCtx {
  ready: boolean;
  online: boolean;
  session: Session | null;
  profile: Profile | null;
  reloadProfile: () => Promise<void>;
  sendEmailCode: (email: string) => Promise<string | null>;
  verifyEmailCode: (email: string, code: string) => Promise<string | null>;
  signInWithApple: () => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  saveProfile: (username: string, avatar: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!supabase || !s) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('id, username, avatar').eq('id', s.user.id).maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthCtx>(
    () => ({
      ready,
      online: !!supabase,
      session,
      profile,
      reloadProfile: () => loadProfile(session),
      async sendEmailCode(email) {
        if (!supabase) return 'Online play is not set up on this build.';
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
        return error ? friendlyAuthError(error.message) : null;
      },
      async verifyEmailCode(email, code) {
        if (!supabase) return 'Online play is not set up on this build.';
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
        return error ? "That code didn't match. Check the latest email and try again." : null;
      },
      async signInWithApple() {
        if (!supabase || Platform.OS !== 'ios') return 'Sign in with Apple is available on iPhone and iPad.';
        try {
          const cred = await AppleAuthentication.signInAsync({
            requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
          });
          if (!cred.identityToken) return 'Apple did not return a sign-in token.';
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
          return error ? friendlyAuthError(error.message) : null;
        } catch (e) {
          if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
          return 'Sign in with Apple did not finish. Please try again.';
        }
      },
      async signInWithGoogle() {
        if (!supabase) return 'Online play is not set up on this build.';
        const redirectTo = Linking.createURL('auth-callback');
        const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
        if (error || !data.url) return 'Google sign-in is not available right now.';
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type !== 'success') return null;
        const { queryParams } = Linking.parse(res.url.replace('#', '?'));
        if (queryParams?.code) {
          const { error: ex } = await supabase.auth.exchangeCodeForSession(String(queryParams.code));
          return ex ? friendlyAuthError(ex.message) : null;
        }
        if (queryParams?.access_token && queryParams?.refresh_token) {
          const { error: se } = await supabase.auth.setSession({
            access_token: String(queryParams.access_token),
            refresh_token: String(queryParams.refresh_token),
          });
          return se ? friendlyAuthError(se.message) : null;
        }
        return 'Google sign-in did not finish. Please try again.';
      },
      async saveProfile(username, avatar) {
        if (!supabase || !session) return 'Please sign in first.';
        const name = username.trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return 'Usernames are 3–20 letters, numbers or underscores.';
        const { error } = await supabase.from('profiles').upsert({ id: session.user.id, username: name, avatar });
        if (error) return error.code === '23505' ? `“${name}” is already taken. Try another?` : 'Could not save your profile. Please try again.';
        await loadProfile(session);
        return null;
      },
      async signOut() {
        await supabase?.auth.signOut();
        setProfile(null);
      },
    }),
    [ready, session, profile, loadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function friendlyAuthError(message: string): string {
  if (/rate/i.test(message)) return 'Too many tries — wait a minute and try again.';
  if (/email/i.test(message)) return "That email address doesn't look right.";
  return 'Sign-in failed. Please try again.';
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
