-- MIGRATION: 20251227_fix_security_definer.sql
-- DESCRIPTION: Restores SECURITY DEFINER to get_current_org_id to prevent RLS recursion
-- while keeping it VOLATILE to ensure freshness.
CREATE OR REPLACE FUNCTION public.get_current_org_id() RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_org_id uuid;
BEGIN -- With SECURITY DEFINER, this query runs as the function owner (postgres/superuser),
-- bypassing the RLS on 'profiles', thus avoiding the infinite recursion loop.
SELECT organization_id INTO v_org_id
FROM public.profiles
WHERE id = auth.uid();
RETURN v_org_id;
END;
$$;