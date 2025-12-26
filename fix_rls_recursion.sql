-- FIX RLS RECURSION AND 406 ERRORS
-- Redefine helper to prevent infinite recursion when querying profiles
CREATE OR REPLACE FUNCTION public.get_current_org_id() RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_org_id UUID;
BEGIN -- Because this is SECURITY DEFINER, it runs as the function owner (usually postgres/admin).
-- This bypasses RLS policies on 'profiles', preventing the recursion loop:
-- profiles -> RLS -> get_current_org_id() -> profiles -> RLS ...
SELECT organization_id INTO v_org_id
FROM public.profiles
WHERE id = auth.uid();
RETURN v_org_id;
END;
$$;