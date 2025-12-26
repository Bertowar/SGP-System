-- EMERGENCY FIX: BREAK RLS RECURSION
-- Run this entire script in Supabase SQL Editor
-- 1. Temporarily Disable RLS on profiles to stop the infinite loop immediately
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- 2. Drop the problematic function to ensure clean recreation
-- DROP FUNCTION IF EXISTS public.get_current_org_id();
-- 3. Recreate the function with SECURITY DEFINER (Crucial: This allows it to read profiles without checking RLS)
CREATE OR REPLACE FUNCTION public.get_current_org_id() RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_org_id UUID;
BEGIN -- This query now runs as 'admin' (Table Owner), ignoring RLS policies
SELECT organization_id INTO v_org_id
FROM public.profiles
WHERE id = auth.uid();
RETURN v_org_id;
END;
$$;
-- 4. Re-enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- 5. Drop old recursive policies if they exist (clean up)
DROP POLICY IF EXISTS "Tenant Isolation" ON public.profiles;
DROP POLICY IF EXISTS "Users can see own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can see org members" ON public.profiles;
-- 6. Create clean, non-recursive policies
-- Policy A: You can always see your own profile
CREATE POLICY "Users can see own profile" ON public.profiles FOR
SELECT USING (auth.uid() = id);
-- Policy B: You can see other members of your organization (Using the fixed function)
CREATE POLICY "Users can see org members" ON public.profiles FOR
SELECT USING (
        organization_id = public.get_current_org_id()
    );
-- 7. Grant permissions just in case
GRANT EXECUTE ON FUNCTION public.get_current_org_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_org_id TO service_role;