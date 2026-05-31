import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../lib/supabase';

const SELECTED_CONTROL_STORAGE_KEY = 'selected_control_id';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ confirmationRequired: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setLoading(false);
        return;
      }
      setSession(data.session);
      setLoading(false);
    };

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event: string, nextSession: Session | null) => {
      if (event === 'SIGNED_OUT' || !nextSession) {
        AsyncStorage.removeItem(SELECTED_CONTROL_STORAGE_KEY).catch(() => undefined);
      }
      setSession(nextSession);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    loading,
    signIn: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUp: async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      return { confirmationRequired: !data.session };
    },
    signOut: async () => {
      await AsyncStorage.removeItem(SELECTED_CONTROL_STORAGE_KEY);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
