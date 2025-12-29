-- MIGRATION: 20251228_fix_raw_materials_rls.sql
-- DESCRIPTION: Relax RLS on raw_materials to allow INSERT/UPDATE if user is a member of the organization, not just if it matches profile.organization_id.
BEGIN;
-- 1. DROP EXISTING STRICT POLICY
DROP POLICY IF EXISTS "Strict isolation for materials" ON public.raw_materials;
-- 2. CREATE NEW FLEXIBLE POLICY (READ)
-- Users can see materials if they belong to the organization
CREATE POLICY "View materials of own org" ON public.raw_materials FOR
SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );
-- 3. CREATE NEW FLEXIBLE POLICY (WRITE)
-- Users can insert/update/delete materials if they belong to the organization
CREATE POLICY "Manage materials of own org" ON public.raw_materials FOR ALL USING (
    organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE user_id = auth.uid()
    )
) WITH CHECK (
    organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE user_id = auth.uid()
    )
);
COMMIT;