
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { getUserProfile, signIn as supabaseSignIn, signOut as supabaseSignOut } from '../services/auth';
import { UserProfile, Organization } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: UserProfile | null;
  currentOrg: Organization | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  manualLogin: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  debugSetRole: (role: string) => void;
  cleanStorage: () => void;
  realRole: UserProfile['role'] | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  currentOrg: null,
  session: null,
  loading: true,
  isAdmin: false,
  manualLogin: async () => { },
  logout: async () => { },
  debugSetRole: () => { },
  cleanStorage: () => { },
  realRole: null,
  refreshProfile: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [realRole, setRealRole] = useState<UserProfile['role'] | null>(null);

  // Ref to track the last fetched user ID to avoid redundant fetches
  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async (currentSession: Session | null) => {
      if (!currentSession?.user) {
        if (isMounted) {
          setUser(null);
          setCurrentOrg(null);
          setRealRole(null);
          setLoading(false);
          lastFetchedUserId.current = null;
        }
        return;
      }

      // Optimization: access token change doesn't necessarily mean profile change
      // But for safety in this refactor, we just check if ID changed or if we don't have a user yet
      if (lastFetchedUserId.current === currentSession.user.id && user) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        console.log("AuthContext: Fetching profile for", currentSession.user.email);
        const profile = await getUserProfile(currentSession.user.id, currentSession.user.email);

        if (isMounted) {
          if (profile) {
            setUser(profile);
            setRealRole(profile.role);
            lastFetchedUserId.current = currentSession.user.id;

            // Fetch Organization Details
            if (profile.organizationId) {
              const { data: org, error: orgError } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', profile.organizationId)
                .single();

              if (org && !orgError) {
                setCurrentOrg(org as Organization);
              }
            }

          } else {
            console.warn("AuthContext: Profile not found for authenticated user.");
            setUser(null);
            setCurrentOrg(null);
          }
        }
      } catch (error) {
        console.error("AuthContext: Error fetching profile", error);
        if (isMounted) {
          setUser(null);
          setCurrentOrg(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // 1. Initial Session Check (Get existing session from storage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setSession(session);
        fetchProfile(session);
      }
    });

    // 2. Subscribe to Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log(`AuthContext: Auth event ${_event}`);
      if (isMounted) {
        setSession(newSession);
        // If event is SIGN_OUT, we can clear immediately
        if (_event === 'SIGNED_OUT') {
          setUser(null);
          setCurrentOrg(null);
          setRealRole(null);
          lastFetchedUserId.current = null;
          setLoading(false);
        } else {
          fetchProfile(newSession);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const manualLogin = async (email: string, pass: string) => {
    await supabaseSignIn(email, pass);
    // onAuthStateChange handles the rest
  };

  const logout = async () => {
    try {
      await supabaseSignOut();
      // State updates handled by onAuthStateChange
    } catch (error) {
      console.error("Logout error:", error);
      // Force local cleanup if server logout fails
      setUser(null);
      setCurrentOrg(null);
      setSession(null);
      localStorage.removeItem('sb-ojnrtqejmnssmkgywufa-auth-token'); // Clear Supabase standard token
      localStorage.removeItem('sgp-auth-token'); // Clear our custom key if used
    }
  };

  const debugSetRole = (role: string) => {
    if (user) {
      setUser({ ...user, role: role as any });
      console.log(`[DEBUG] Role switched to: ${role}`);
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      setLoading(true);
      // Force fetch by ignoring lastFetchedUserId temporarily
      const profile = await getUserProfile(session.user.id, session.user.email);
      if (profile) {
        setUser(profile);
        setRealRole(profile.role);
        lastFetchedUserId.current = session.user.id;

        if (profile.organizationId) {
          const { data: org } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profile.organizationId)
            .single();
          if (org) setCurrentOrg(org as Organization);
        }
      }
      setLoading(false);
    }
  };

  const cleanStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const value = {
    user,
    currentOrg,
    session,
    loading,
    isAdmin: user?.role === 'admin' || user?.role === 'manager',
    manualLogin,
    logout,
    debugSetRole,
    cleanStorage,
    realRole,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
