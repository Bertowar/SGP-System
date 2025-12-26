-- DEBUG RLS STATUS
-- Use this to see what policies are actually active on the database
BEGIN;
-- 1. Check if RLS is ENABLED on products
SELECT tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'products';
-- 2. List ALL Policies on products
-- If you see more than ONE policy, or a policy that isn't "Tenant Isolation", that's the problem.
SELECT schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'products';
-- 3. Check specific rows to see their Organization ID
SELECT code,
    name,
    organization_id
FROM public.products
LIMIT 10;
-- 4. Check your current context again
SELECT public.get_current_org_id() as "Current Org Context";
ROLLBACK;