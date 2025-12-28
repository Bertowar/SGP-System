-- MIGRATION: 20251227_isolate_complete.sql
-- DESCRIPTION: Applies organization_id and RLS to ALL remaining tables to ensure full multi-tenancy.
DO $$
DECLARE default_org_id UUID;
BEGIN -- 1. Get default org for backfill
SELECT id INTO default_org_id
FROM public.organizations
LIMIT 1;
-- Helper logic for each table
-- We will repeat this pattern for each table:
-- 1. Add Column
-- 2. Backfill
-- 3. Enable RLS
-- 4. Create Policy
-- 5. Fix Unique Constraints (if applicable)
------------------------------------------------------------------------------------
-- TABLE: inventory_transactions
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.inventory_transactions
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.inventory_transactions
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Isolation for inventory_transactions" ON public.inventory_transactions USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
------------------------------------------------------------------------------------
-- TABLE: suppliers
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'suppliers'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.suppliers
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.suppliers
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for suppliers" ON public.suppliers;
CREATE POLICY "Isolation for suppliers" ON public.suppliers USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
-- Constraint: Name should be unique per ORG
IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'suppliers_name_key'
) THEN
ALTER TABLE public.suppliers DROP CONSTRAINT suppliers_name_key;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'suppliers_org_name_key'
) THEN
ALTER TABLE public.suppliers
ADD CONSTRAINT suppliers_org_name_key UNIQUE (organization_id, name);
END IF;
------------------------------------------------------------------------------------
-- TABLE: purchase_orders
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'purchase_orders'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.purchase_orders
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.purchase_orders
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for purchase_orders" ON public.purchase_orders;
CREATE POLICY "Isolation for purchase_orders" ON public.purchase_orders USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
------------------------------------------------------------------------------------
-- TABLE: purchase_order_items
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'purchase_order_items'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.purchase_order_items
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.purchase_order_items
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "Isolation for purchase_order_items" ON public.purchase_order_items USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
------------------------------------------------------------------------------------
-- TABLE: shipping_orders
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'shipping_orders'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.shipping_orders
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.shipping_orders
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.shipping_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for shipping_orders" ON public.shipping_orders;
CREATE POLICY "Isolation for shipping_orders" ON public.shipping_orders USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
-- Constraint: Order Number unique per ORG
IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shipping_orders_order_number_key'
) THEN
ALTER TABLE public.shipping_orders DROP CONSTRAINT shipping_orders_order_number_key;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shipping_orders_org_number_key'
) THEN
ALTER TABLE public.shipping_orders
ADD CONSTRAINT shipping_orders_org_number_key UNIQUE (organization_id, order_number);
END IF;
------------------------------------------------------------------------------------
-- TABLE: shipping_items
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'shipping_items'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.shipping_items
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.shipping_items
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.shipping_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for shipping_items" ON public.shipping_items;
CREATE POLICY "Isolation for shipping_items" ON public.shipping_items USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
------------------------------------------------------------------------------------
-- TABLE: product_bom
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_bom'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.product_bom
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.product_bom
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.product_bom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for product_bom" ON public.product_bom;
CREATE POLICY "Isolation for product_bom" ON public.product_bom USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
------------------------------------------------------------------------------------
-- TABLE: product_categories
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_categories'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.product_categories
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.product_categories
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for product_categories" ON public.product_categories;
CREATE POLICY "Isolation for product_categories" ON public.product_categories USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
-- Fix constraint usually on 'id' -> 'name'. Assuming PK is ID. If name is unique, make it per org.
IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_categories_name_key'
) THEN
ALTER TABLE public.product_categories DROP CONSTRAINT product_categories_name_key;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_categories_org_name_key'
) THEN
ALTER TABLE public.product_categories
ADD CONSTRAINT product_categories_org_name_key UNIQUE (organization_id, name);
END IF;
------------------------------------------------------------------------------------
-- TABLE: product_types
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_types'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.product_types
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.product_types
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for product_types" ON public.product_types;
CREATE POLICY "Isolation for product_types" ON public.product_types USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
-- Name unique per org
IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_types_name_key'
) THEN
ALTER TABLE public.product_types DROP CONSTRAINT product_types_name_key;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_types_org_name_key'
) THEN
ALTER TABLE public.product_types
ADD CONSTRAINT product_types_org_name_key UNIQUE (organization_id, name);
END IF;
------------------------------------------------------------------------------------
-- TABLE: sectors
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sectors'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.sectors
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.sectors
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for sectors" ON public.sectors;
CREATE POLICY "Isolation for sectors" ON public.sectors USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
-- Name unique per org
IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sectors_name_key'
) THEN
ALTER TABLE public.sectors DROP CONSTRAINT sectors_name_key;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sectors_org_name_key'
) THEN
ALTER TABLE public.sectors
ADD CONSTRAINT sectors_org_name_key UNIQUE (organization_id, name);
END IF;
------------------------------------------------------------------------------------
-- TABLE: work_shifts
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'work_shifts'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.work_shifts
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.work_shifts
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for work_shifts" ON public.work_shifts;
CREATE POLICY "Isolation for work_shifts" ON public.work_shifts USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
------------------------------------------------------------------------------------
-- TABLE: downtime_types
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'downtime_types'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.downtime_types
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.downtime_types
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.downtime_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for downtime_types" ON public.downtime_types;
CREATE POLICY "Isolation for downtime_types" ON public.downtime_types USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
------------------------------------------------------------------------------------
-- TABLE: scrap_reasons
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'scrap_reasons'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.scrap_reasons
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.scrap_reasons
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.scrap_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for scrap_reasons" ON public.scrap_reasons;
CREATE POLICY "Isolation for scrap_reasons" ON public.scrap_reasons USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
------------------------------------------------------------------------------------
-- TABLE: alerts
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'alerts'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.alerts
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.alerts
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for alerts" ON public.alerts;
CREATE POLICY "Isolation for alerts" ON public.alerts USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
------------------------------------------------------------------------------------
-- TABLE: production_orders
------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'production_orders'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.production_orders
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.production_orders
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for production_orders" ON public.production_orders;
CREATE POLICY "Isolation for production_orders" ON public.production_orders USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
END $$;