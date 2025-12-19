
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { getUserProfile, signIn as supabaseSignIn, signOut as supabaseSignOut } from '../services/auth';
import { UserProfile } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  manualLogin: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  manualLogin: async () => { },
  logout: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // --- MODO DESENVOLVIMENTO (Auth Bypass) ---
  useEffect(() => {
    console.warn("⚠️ MODO DEV ATIVO: Login automático como Admin.");

    const devUser: UserProfile = {
      id: 'dev-admin-id',
      email: 'dev@admin.com',
      role: 'admin',
      fullName: 'Desenvolvedor (Admin)'
    };

    // Simula delay para não quebrar UI que depende de loading state transitions
    setTimeout(() => {
      setUser(devUser);
      setSession({
        access_token: 'fake-token',
        token_type: 'bearer',
        user: { id: 'dev-admin-id', email: 'dev@admin.com', aud: 'authenticated' }
      } as Session);
      setLoading(false);
    }, 100);
  }, []);

  /* 
  // AUTENTICAÇÃO REAL (Desativada temporariamente para Dev)
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          setSession(session);
          if (session?.user) {
            const profile = await getUserProfile(session.user.id);
            if (isMounted) setUser(profile);
          }
        }
      } catch (e) {
        console.error("Auth init error", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) {
        const profile = await getUserProfile(session.user.id);
        if (isMounted) setUser(profile);
      } else {
        if (isMounted) setUser(null);
      }
      if (isMounted) setLoading(false);
    });

    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);
  */

  const manualLogin = async (email: string, pass: string) => {
    await supabaseSignIn(email, pass);
  };

  const logout = async () => {
    setUser(null);
    setSession(null);
    await supabaseSignOut();
  };

  const value = {
    user,
    session,
    loading,
    isAdmin: user?.role === 'admin' || user?.role === 'manager', // Backwards compatibility helper
    manualLogin,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
