-- Create a secure RPC function to fetch the current user's profile
-- This bypasses RLS on 'profiles' and 'organizations' tables because it is SECURITY DEFINER.
-- This ensures that if a user is authenticated, we ALWAYS get their profile data.
CREATE OR REPLACE FUNCTION public.get_my_profile() RETURNS TABLE (
        id uuid,
        email text,
        role text,
        organization_id uuid,
        organization_name text,
        full_name text,
        avatar_url text,
        is_super_admin boolean
    ) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public,
    auth AS $$ BEGIN RETURN QUERY
SELECT p.id,
    u.email::text,
    p.role::text,
    p.organization_id,
    COALESCE(o.name, 'Sem Organização'),
    -- Handle null org name
    p.full_name,
    p.avatar_url,
    COALESCE(p.is_super_admin, false) -- Default to false
FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.organizations o ON o.id = p.organization_id
WHERE p.id = auth.uid();
END;
$$;
-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO service_role;