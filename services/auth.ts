
import { supabase } from './supabaseClient';
import { UserProfile, UserRole } from '../types';

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  console.log("signIn: Success", data);
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resetPasswordForEmail = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  });
  if (error) throw error;
};

export const getUserProfile = async (userId: string, email?: string): Promise<UserProfile | null> => {
  try {
    // Use RPC to bypass RLS and guarantee profile access
    console.log("AuthContext: Calling get_my_profile RPC...");
    const { data: rpcData, error } = await supabase.rpc('get_my_profile');

    if (error) {
      console.error('Error fetching profile via RPC:', error);
      // Fallback or early exit? Let's return null to handle gracefully
      return null;
    }

    if (!rpcData || rpcData.length === 0) {
      console.warn('Profile RPC returned no data. User might not have a profile yet.');
      return null;
    }

    // RPC returns an array, but for single user it's one row
    const profileRow = rpcData[0];

    return {
      id: profileRow.id,
      email: profileRow.email || email || '', // Fixed: use 'email' argument as fallback
      role: (profileRow.role as UserRole) || 'operator',
      fullName: profileRow.full_name,
      organizationId: profileRow.organization_id,
      organizationName: profileRow.organization_name || '',
      avatarUrl: profileRow.avatar_url,
      isSuperAdmin: profileRow.is_super_admin
    };
  } catch (e) {
    console.error("Unexpected error in getUserProfile:", e);
    return null;
  }
};

export const getCurrentOrgId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  // Metadata can be stale. Always fetch from DB (Source of Truth) to avoid RLS mismatches.
  // const metaOrgId = session.user.user_metadata?.organization_id || session.user.app_metadata?.organization_id;
  // if (metaOrgId) return metaOrgId;

  // Fallback to profile fetch
  const profile = await getUserProfile(session.user.id);
  return profile?.organizationId || null;
};
