-- MIGRATION: 20251223_fix_recursion.sql
-- FIX: Infinite recursion in RLS policies when checking is_super_admin
-- 1. Create a helper function to check super admin status SAFELY
-- SECURITY DEFINER bypasses RLS (runs as table owner/postgres)
CREATE OR REPLACE FUNCTION public.check_is_super_admin() RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
            AND is_super_admin = true
    );
END;
$$;
-- 2. Fix RLS on 'profiles' (Use the function instead of recursive subquery)
DROP POLICY IF EXISTS "Users can view members of same organization" ON public.profiles;
CREATE POLICY "Users can view members of same organization" ON public.profiles FOR
SELECT USING (
        organization_id = public.get_current_org_id()
        OR id = auth.uid()
        OR public.check_is_super_admin()
    );
-- 3. Fix RLS on 'organizations' (Use the function for consistency)
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
CREATE POLICY "Users can view their own organization" ON public.organizations FOR
SELECT USING (
        id = public.get_current_org_id()
        OR public.check_is_super_admin()
    );
DROP POLICY IF EXISTS "Owners and Super Admins can update organization" ON public.organizations;
CREATE POLICY "Owners and Super Admins can update organization" ON public.organizations FOR
UPDATE USING (
        (
            id = public.get_current_org_id()
            AND EXISTS (
                SELECT 1
                FROM public.profiles
                WHERE id = auth.uid()
                    AND role = 'owner'
            )
        )
        OR public.check_is_super_admin()
    );