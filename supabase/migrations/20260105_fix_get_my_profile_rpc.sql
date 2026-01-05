-- MIGRATION: 20260105_fix_get_my_profile_rpc.sql
-- DESCRIPTION: Redefine get_my_profile RPC to include is_super_admin column
-- DROP function first to avoid return type conflict (Error 42P13)
DROP FUNCTION IF EXISTS public.get_my_profile();
CREATE OR REPLACE FUNCTION public.get_my_profile() RETURNS TABLE (
        id UUID,
        email TEXT,
        role TEXT,
        full_name TEXT,
        organization_id UUID,
        organization_name TEXT,
        avatar_url TEXT,
        is_super_admin BOOLEAN
    ) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public,
    auth AS $$ BEGIN RETURN QUERY
SELECT p.id,
    u.email::TEXT,
    p.role,
    p.full_name,
    p.organization_id,
    o.name as organization_name,
    p.avatar_url,
    p.is_super_admin
FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.organizations o ON o.id = p.organization_id
WHERE p.id = auth.uid();
END;
$$;