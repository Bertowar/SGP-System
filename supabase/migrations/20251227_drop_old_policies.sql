-- MIGRATION: 20251227_drop_old_policies.sql
-- DESCRIPTION: Drops conflicting 'Tenant Isolation' policies to enforce strict isolation
DO $$ BEGIN -- PRODUCTS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.products;
-- RAW MATERIALS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.raw_materials;
-- INVENTORY TRANSACTIONS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.inventory_transactions;
-- SUPPLIERS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.suppliers;
-- MACHINES
DROP POLICY IF EXISTS "Tenant Isolation" ON public.machines;
-- PRODUCTION ENTRIES
DROP POLICY IF EXISTS "Tenant Isolation" ON public.production_entries;
-- SECTORS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.sectors;
-- CATEGORIES
DROP POLICY IF EXISTS "Tenant Isolation" ON public.product_categories;
END $$;