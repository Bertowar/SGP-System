// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 1. Check Super Admin Role
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (!profile || !profile.is_super_admin) {
            return new Response(JSON.stringify({ error: 'Only super admins can create tenants.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403,
            })
        }

        // 2. Parse Body
        const { name, slug, plan, owner_email, owner_name, logo_url } = await req.json()

        if (!name || !slug || !owner_email) {
            throw new Error('Name, slug, and owner_email are required.')
        }

        const supabaseAdmin = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Create Organization
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
                name,
                slug,
                plan: plan || 'free',
                owner_id: user.id, // Temporary owner, will be updated or just reference creator
                logo_url: logo_url || null
            })
            .select()
            .single()

        if (orgError) throw orgError

        // 4. Invite Owner
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(owner_email, {
            data: {
                organization_id: org.id,
                role: 'owner',
                full_name: owner_name || '',
                company_name: name
            }
        })

        if (inviteError) {
            // Rollback org creation? ideally yes, but for simplicity we keep it or manual cleanup
            console.error('Invite failed', inviteError)
            return new Response(JSON.stringify({ error: 'Org created but invite failed: ' + inviteError.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        // 5. Update Org Owner to the new invited user (Invited user has an ID even before accepting)
        if (inviteData.user) {
            await supabaseAdmin
                .from('organizations')
                .update({ owner_id: inviteData.user.id })
                .eq('id', org.id)
        }

        return new Response(JSON.stringify({ org, invite: inviteData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
