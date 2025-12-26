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
    logo_url?: string;
}

export const inviteUser = async ({ email, role }: InviteUserParams) => {
    // MOCK FOR DEV MODE (Fake Token)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token === 'fake-token') {
        console.log('[DEV] Mocking inviteUser:', email, role);
        return { message: 'Mock invite sent' };
    }

    // 1. Validate session (fetched at start of function)
    if (!session || !session.access_token) {
        throw new Error("Usuário não autenticado no frontend. Recarregue a página.");
    }

    try {
        console.log("Sending invite with token length:", session.access_token.length);

        const { data, error } = await supabase.functions.invoke('invite-user', {
            body: { email, role },
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        });

        if (error) {
            console.error("Invite User Function Error:", error);

            if (error instanceof Error && 'context' in error) {
                const response = (error as any).context as Response;
                if (response && typeof response.json === 'function') {
                    try {
                        const errorBody = await response.json();
                        console.error("EDGE FUNCTION ERROR BODY:", JSON.stringify(errorBody, null, 2));
                        // Elevate the clean error message to the UI
                        if (errorBody.error) {
                            throw new Error(errorBody.error);
                        }
                    } catch (jsonErr) {
                        console.error("Could not parse error body JSON", jsonErr);
                    }
                }
            }
            throw error;
        }
        return data;
    } catch (e: any) {
        console.error("Invite User Wrapper Exception:", e);
        throw e;
    }
};

export const createTenant = async ({ name, slug, plan, owner_email, owner_name, logo_url }: CreateTenantParams) => {
    // Call Edge Function to create tenant and invite owner
    const { data, error } = await supabase.functions.invoke('create-tenant', {
        body: { name, slug, plan, owner_email, owner_name, logo_url }
    });

    if (error) throw new Error(error.message || 'Erro ao criar organização.');
    return data;
};

export const updateTenant = async (id: string, updates: Partial<CreateTenantParams>) => {
    // Filter out fields that are not columns in 'organizations' table
    // owner_email and owner_name are used only for invite during creation
    const { owner_email, owner_name, ...tableUpdates } = updates;

    const { error } = await supabase
        .from('organizations')
        .update(tableUpdates)
        .eq('id', id);

    if (error) throw new Error(error.message || 'Erro ao atualizar organização.');
};
