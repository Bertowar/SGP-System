-- MIGRATION: 20251227_strict_rls.sql
-- DESCRIPTION: Enforces STRICT isolation by removing 'OR organization_id IS NULL'
DO $$ BEGIN -- PRODUCTS
DROP POLICY IF EXISTS "Isolation for products" ON public.products;
CREATE POLICY "Isolation for products" ON public.products USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
-- RAW MATERIALS
DROP POLICY IF EXISTS "Isolation for raw_materials" ON public.raw_materials;
CREATE POLICY "Isolation for raw_materials" ON public.raw_materials USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
-- INVENTORY TRANSACTIONS
DROP POLICY IF EXISTS "Isolation for inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Isolation for inventory_transactions" ON public.inventory_transactions USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
-- SUPPLIERS
DROP POLICY IF EXISTS "Isolation for suppliers" ON public.suppliers;
CREATE POLICY "Isolation for suppliers" ON public.suppliers USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
-- MACHINES
DROP POLICY IF EXISTS "Isolation for machines" ON public.machines;
CREATE POLICY "Isolation for machines" ON public.machines USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
-- PRODUCTION ENTRIES
DROP POLICY IF EXISTS "Isolation for entries" ON public.production_entries;
CREATE POLICY "Isolation for entries" ON public.production_entries USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
END $$;