// Real auth via Supabase — email/password for now, Google Sign-In to follow
// as a separate step. Mirrors StoreContext's provider pattern.
//
// isAdmin/banned come from the `profiles` table (one row per user, created
// automatically on signup — see supabase/schema.sql). A banned user is
// signed out immediately on load/sign-in, not just blocked at checkout —
// the real enforcement for orders is a restrictive RLS policy on `orders`
// itself, this is just so a banned account can't do anything at all.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  bannedMessage: string | null;
  signUp: (email: string, password: string, birthYear?: number) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bannedMessage, setBannedMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('is_admin, banned')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.banned) {
          setBannedMessage('Your account has been suspended. Contact us if you think this is a mistake.');
          setIsAdmin(false);
          supabase.auth.signOut();
          return;
        }
        setIsAdmin(Boolean(data?.is_admin));
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isAdmin,
      bannedMessage,
      signUp: async (email, password, birthYear) => {
        // birth_year rides along as auth metadata (not a follow-up profile
        // update) because email confirmation is on for this project — there
        // is no active session yet to authorize that update. The signup
        // trigger (see supabase/analytics_schema.sql) reads it from here.
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: birthYear ? { data: { birth_year: birthYear } } : undefined,
        });
        return { error: error?.message ?? null };
      },
      signIn: async (email, password) => {
        setBannedMessage(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, isAdmin, bannedMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
