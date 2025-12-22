
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

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
    }

    // Use the role from profile or default to 'operator' if undefined
    const role: UserRole = (profileData?.role as UserRole) || 'operator';

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    return {
      id: userId,
      email: user.email || '',
      role: role,
      fullName: profileData?.full_name,
      organizationId: profileData?.organization_id,
      avatarUrl: profileData?.avatar_url,
      isSuperAdmin: profileData?.is_super_admin
    };
  } catch (e) {
    console.error(e);
    return null;
  }
};
