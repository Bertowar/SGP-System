// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let trace = [];
    let profileData = null;

    try {
        trace.push('start');

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('PROJECT_ANON_KEY') ?? '';
        const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
        trace.push('env_resolved');

        const supabaseClient = createClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                global: { headers: { Authorization: req.headers.get('Authorization')! } },
                auth: { persistSession: false }
            }
        )

        trace.push('client_created');

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

        if (userError) {
            console.error("Auth Error:", userError);
            trace.push('auth_error: ' + userError.message);
        } else {
            trace.push('auth_success');
        }

        if (!user) throw new Error('Unauthorized');

        trace.push('fetching_profile');
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single()

        if (profileError) {
            trace.push('profile_error: ' + profileError.message);
        }
        profileData = profile;

        if (!profile || (profile.role !== 'owner' && profile.role !== 'manager' && profile.role !== 'admin')) {
            trace.push('profile_check_failed');
            return new Response(JSON.stringify({ error: 'Only owners, managers and admins can invite members.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403,
            })
        }
        trace.push('profile_valid');

        const { email, role } = await req.json()
        trace.push('body_parsed');

        if (!email) throw new Error('Email is required.')

        const supabaseAdmin = createClient(
            supabaseUrl,
            serviceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        trace.push('inviting_user');
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                organization_id: profile.organization_id,
                role: role || 'entry',
                company_name: 'Minha Empresa'
            }
        })

        if (inviteError) {
            trace.push('invite_error: ' + inviteError.message);
            throw inviteError
        }
        trace.push('invite_success');

        return new Response(JSON.stringify(inviteData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        // Parse JWT role (simple decode without verify)
        let keyRole = 'invalid';
        try {
            const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
            const [, payload] = serviceKey.split('.');
            if (payload) {
                const decoded = JSON.parse(atob(payload));
                keyRole = decoded.role;
            }
        } catch (e) {
            keyRole = 'parse_error';
        }

        const debug = {
            trace,
            keyRole, // <--- CRITICAL CHECK
            profile: profileData,
            errorOriginal: error.message
        };

        return new Response(JSON.stringify({ error: error.message, debug }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
