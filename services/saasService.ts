import { supabase } from './supabaseClient';

interface InviteUserParams {
    email: string;
    role: string;
}

interface CreateTenantParams {
    name: string;
    slug: string;
    plan: string;
    owner_email: string;
    owner_name: string;
}

export const inviteUser = async ({ email, role }: InviteUserParams) => {
    // MOCK FOR DEV MODE (Fake Token)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token === 'fake-token') {
        console.log('[DEV] Mocking inviteUser:', email, role);
        return { message: 'Mock invite sent' };
    }

    const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role }
    });

    if (error) throw error;
    return data;
};

export const createTenant = async (params: CreateTenantParams) => {
    // MOCK FOR DEV MODE (Fake Token)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token === 'fake-token') {
        console.log('[DEV] Mocking createTenant:', params);
        return { message: 'Mock tenant created' };
    }

    const { data, error } = await supabase.functions.invoke('create-tenant', {
        body: params
    });

    if (error) throw error;
    return data;
};
