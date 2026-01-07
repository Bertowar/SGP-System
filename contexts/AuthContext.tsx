
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { getUserProfile, signIn as supabaseSignIn, signOut as supabaseSignOut, switchOrganization } from '../services/auth';
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
  switchOrg: (orgId: string) => Promise<void>;
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
  switchOrg: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [realRole, setRealRole] = useState<UserProfile['role'] | null>(null);

  const [realIsSuperAdmin, setRealIsSuperAdmin] = useState(false);

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
          setRealIsSuperAdmin(false);
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
            setRealIsSuperAdmin(profile.isSuperAdmin || false);
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
            console.warn("AuthContext: Profile not found for authenticated user. Using session fallback.");
            // Fallback: Create a minimal user object from session so they are not "logged out"
            setUser({
              id: currentSession.user.id,
              email: currentSession.user.email || '',
              role: 'operator', // Default fallback role
              fullName: currentSession.user.user_metadata?.name || 'Usuário Sem Perfil',
              avatarUrl: '',
              organizationId: null,
              isSuperAdmin: false
            });
            setCurrentOrg(null);
            setRealIsSuperAdmin(false);
          }
        }
      } catch (error) {
        console.error("AuthContext: Error fetching profile", error);
        if (isMounted) {
          setUser(null);
          setCurrentOrg(null);
          setRealIsSuperAdmin(false);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // 1. Initial Session Check (Get existing session from storage)
    console.log("AuthContext: Starting initial session check...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("AuthContext: getSession resolved", session?.user?.email);
      if (isMounted) {
        setSession(session);
        fetchProfile(session);
      }
    }).catch(err => console.error("AuthContext: getSession failed", err));

    // 2. Subscribe to Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log(`AuthContext: Auth event ${_event}`, newSession?.user?.email);
      if (isMounted) {
        setSession(newSession);
        // If event is SIGN_OUT, we can clear immediately
        if (_event === 'SIGNED_OUT') {
          console.log("AuthContext: Handling SIGNED_OUT");
          setUser(null);
          setCurrentOrg(null);
          setRealRole(null);
          setRealIsSuperAdmin(false);
          lastFetchedUserId.current = null;
          setLoading(false);
        } else {
          console.log("AuthContext: Calling fetchProfile from onAuthStateChange");
          fetchProfile(newSession);
        }
      }
    });

    return () => {
      console.log("AuthContext: Unmounting");
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
      setRealIsSuperAdmin(false);
    }
  };

  const debugSetRole = (role: string) => {
    setUser(prev => {
      if (!prev) return null;
      return {
        ...prev,
        role: role as any,
        // Update super admin status based on role for simulation
        // Use realIsSuperAdmin instead of user.isSuperAdmin to ensure we can restore it
        isSuperAdmin: (role === 'owner' || role === 'admin') ? realIsSuperAdmin : false
      };
    });
    console.log(`[DEBUG] Role switched to: ${role}`);
  };

  const switchOrg = async (orgId: string) => {
    try {
      setLoading(true);
      await switchOrganization(orgId);
      await refreshProfile();
      // Optional: reload page to ensure clean state
      // window.location.reload(); 
    } catch (e) {
      console.error("AuthContext: Error switching org", e);
    } finally {
      setLoading(false);
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
        setRealIsSuperAdmin(profile.isSuperAdmin || false);
        // lastFetchedUserId.current = session.user.id; // Removed this to force re-eval if needed

        if (profile.organizationId) {
          // Re-fetch current org details
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
    refreshProfile,
    switchOrg
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

