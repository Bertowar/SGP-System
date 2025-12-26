-- DIAGRNOSTIC: Verify current user context and visible data
BEGIN;
-- 1. Who am I?
SELECT auth.uid() as "My User ID",
    (
        SELECT email
        FROM auth.users
        WHERE id = auth.uid()
    ) as "My Email",
    (
        SELECT organization_id
        FROM public.profiles
        WHERE id = auth.uid()
    ) as "My Org ID (in Profile)",
    public.get_current_org_id() as "Resolved Org ID (Function)";
-- 2. What Organization is this?
SELECT id,
    name,
    slug
FROM public.organizations
WHERE id = public.get_current_org_id();
-- 3. What Products can I see?
-- If this returns products from another company, RLS is BROKEN.
SELECT count(*) as "Total Visible Products"
FROM public.products;
-- 4. Show a sample of products (to see if they have mixed org_ids)
SELECT code,
    name,
    organization_id
FROM public.products
LIMIT 5;
ROLLBACK;