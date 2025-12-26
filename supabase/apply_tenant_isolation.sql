-- MIGRATION: Tenant Isolation & RLS for Business Data
-- Apply this script in the Supabase SQL Editor.
BEGIN;
-- 0. Helper: Get 'Default' Org (First created) to migrate existing data
CREATE OR REPLACE FUNCTION public.get_migration_default_org() RETURNS UUID LANGUAGE sql STABLE AS $$
SELECT id
FROM public.organizations
ORDER BY created_at ASC
LIMIT 1;
$$;
-- 1. Helper Trigger Function: Auto-assign Organization ID on Insert
CREATE OR REPLACE FUNCTION public.trg_set_org_id() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF new.organization_id IS NULL THEN new.organization_id := public.get_current_org_id();
END IF;
RETURN new;
END;
$$;
-- MACRO: Function to Apply Multi-Tenancy to a Table
CREATE OR REPLACE FUNCTION public.apply_tenant_isolation(tbl_name text, unique_col text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE default_org UUID;
pol RECORD;
BEGIN default_org := public.get_migration_default_org();
-- Add Column
EXECUTE 'ALTER TABLE public.' || tbl_name || ' ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id)';
-- Backfill Data
IF default_org IS NOT NULL THEN EXECUTE 'UPDATE public.' || tbl_name || ' SET organization_id = $1 WHERE organization_id IS NULL' USING default_org;
END IF;
-- Enable RLS
EXECUTE 'ALTER TABLE public.' || tbl_name || ' ENABLE ROW LEVEL SECURITY';
-- Drop ALL existing policies to ensure strict isolation
FOR pol IN
SELECT policyname
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = tbl_name LOOP EXECUTE 'DROP POLICY "' || pol.policyname || '" ON public.' || tbl_name;
END LOOP;
EXECUTE 'CREATE POLICY "Tenant Isolation" ON public.' || tbl_name || ' USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id())';
-- Create Trigger
EXECUTE 'DROP TRIGGER IF EXISTS set_org_id ON public.' || tbl_name;
EXECUTE 'CREATE TRIGGER set_org_id BEFORE INSERT ON public.' || tbl_name || ' FOR EACH ROW EXECUTE PROCEDURE public.trg_set_org_id()';
-- Handle Unique Constraint Scope (if unique_col provided)
IF unique_col IS NOT NULL THEN -- Attempt to drop existing global unique constraint. 
-- Naming convention varies, trying common patterns.
BEGIN EXECUTE 'ALTER TABLE public.' || tbl_name || ' DROP CONSTRAINT IF EXISTS ' || tbl_name || '_' || unique_col || '_key';
EXCEPTION
WHEN OTHERS THEN RAISE NOTICE 'Could not drop constraint on %.%, manual check required.',
tbl_name,
unique_col;
END;
-- Create new Composite Unique Index AND Constraint
-- We apply a UNIQUE CONSTRAINT via an Index to support ON CONFLICT
BEGIN EXECUTE 'ALTER TABLE public.' || tbl_name || ' ADD CONSTRAINT ' || tbl_name || '_org_' || unique_col || '_key UNIQUE (organization_id, ' || unique_col || ')';
EXCEPTION
WHEN OTHERS THEN RAISE NOTICE 'Constraint already exists or error: %',
SQLERRM;
END;
END IF;
END;
$$;
-- 2. APPLY TO TABLES
-- 2.1 Master Data
SELECT public.apply_tenant_isolation('products', 'code');
SELECT public.apply_tenant_isolation('raw_materials', 'code');
SELECT public.apply_tenant_isolation('machines', 'code');
SELECT public.apply_tenant_isolation('operators', 'name');
SELECT public.apply_tenant_isolation('sectors', 'id');
SELECT public.apply_tenant_isolation('work_shifts');
SELECT public.apply_tenant_isolation('downtime_types');
SELECT public.apply_tenant_isolation('scrap_reasons');
SELECT public.apply_tenant_isolation('custom_field_configs', 'key');
SELECT public.apply_tenant_isolation('product_categories');
-- 2.2 Transactional Data
SELECT public.apply_tenant_isolation('production_entries');
SELECT public.apply_tenant_isolation('inventory_transactions');
SELECT public.apply_tenant_isolation('product_bom');
-- 2.3 Commercial / Logistics
SELECT public.apply_tenant_isolation('suppliers');
SELECT public.apply_tenant_isolation('purchase_orders');
SELECT public.apply_tenant_isolation('purchase_order_items');
SELECT public.apply_tenant_isolation('shipping_orders');
SELECT public.apply_tenant_isolation('shipping_items');
-- 2.4 App Settings (Special Case)
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
UPDATE public.app_settings
SET organization_id = public.get_migration_default_org()
WHERE organization_id IS NULL;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Settings" ON public.app_settings;
CREATE POLICY "Tenant Settings" ON public.app_settings USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
-- 3. Update Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_entries_org_date ON public.production_entries(organization_id, date);
COMMIT;
-- 4. Clean up Helper
DROP FUNCTION IF EXISTS public.apply_tenant_isolation;
DROP FUNCTION IF EXISTS public.get_migration_default_org;