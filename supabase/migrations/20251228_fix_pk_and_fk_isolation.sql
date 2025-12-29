-- MIGRATION: 20251228_fix_pk_and_fk_isolation.sql
-- DESCRIPTION: Fixes Primary Keys for products and machines to be ID-based (UUID) instead of Code-based. 
--              Recreates Foreign Keys to enforce (organization_id, code) relationship for isolation.
--              Includes CLEANUP of orphaned records.
BEGIN;
-- =================================================================================================
-- 1. PRODUCTS
-- =================================================================================================
-- Drop old PK (CASCADE will drop dependent FKs from production_orders, production_entries, product_bom etc.)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_pkey CASCADE;
-- Ensure ID Column exists (and backfill if needed)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'products'
        AND column_name = 'id'
) THEN
ALTER TABLE public.products
ADD COLUMN id UUID DEFAULT gen_random_uuid();
END IF;
END $$;
-- Update ID to be NOT NULL if it was just added or nullable
UPDATE public.products
SET id = gen_random_uuid()
WHERE id IS NULL;
ALTER TABLE public.products
ALTER COLUMN id
SET NOT NULL;
ALTER TABLE public.products
ALTER COLUMN id
SET DEFAULT gen_random_uuid();
-- Ensure ID is Primary Key
ALTER TABLE public.products
ADD PRIMARY KEY (id);
-- Ensure Composite Unique Key (organization_id, code) exists for FK referencing
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_org_code_key'
) THEN
ALTER TABLE public.products
ADD CONSTRAINT products_org_code_key UNIQUE (organization_id, code);
END IF;
END $$;
-- CLEANUP: Delete orphaned Production Orders (Product mismatch)
DELETE FROM public.production_orders po
WHERE NOT EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.organization_id = po.organization_id
            AND p.code = po.product_code
    );
-- CLEANUP: Delete orphaned Production Entries (Product mismatch)
DELETE FROM public.production_entries pe
WHERE NOT EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.organization_id = pe.organization_id
            AND p.code = pe.product_code
    );
-- CLEANUP: Delete orphaned Product BOMs (Parent Product mismatch)
DELETE FROM public.product_bom pb
WHERE NOT EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.organization_id = pb.organization_id
            AND p.code = pb.product_code
    );
-- Re-create Foreign Keys with Composite Isolation
-- Production Orders -> Products
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_product_code_fkey,
    -- Ensure old one is gone
ADD CONSTRAINT production_orders_product_org_fkey FOREIGN KEY (organization_id, product_code) REFERENCES public.products (organization_id, code) ON UPDATE CASCADE;
-- Production Entries -> Products
ALTER TABLE public.production_entries DROP CONSTRAINT IF EXISTS production_entries_product_code_fkey,
    ADD CONSTRAINT production_entries_product_org_fkey FOREIGN KEY (organization_id, product_code) REFERENCES public.products (organization_id, code) ON UPDATE CASCADE;
-- Product BOM (Parent) -> Products
ALTER TABLE public.product_bom DROP CONSTRAINT IF EXISTS product_bom_product_code_fkey,
    ADD CONSTRAINT product_bom_product_org_fkey FOREIGN KEY (organization_id, product_code) REFERENCES public.products (organization_id, code) ON UPDATE CASCADE;
-- =================================================================================================
-- 2. MACHINES
-- =================================================================================================
-- Drop old PK (CASCADE drops FKs)
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_pkey CASCADE;
-- Ensure ID column exists (and backfill if needed)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'machines'
        AND column_name = 'id'
) THEN
ALTER TABLE public.machines
ADD COLUMN id UUID DEFAULT gen_random_uuid();
END IF;
END $$;
-- Update ID to be NOT NULL if it was just added or nullable
UPDATE public.machines
SET id = gen_random_uuid()
WHERE id IS NULL;
ALTER TABLE public.machines
ALTER COLUMN id
SET NOT NULL;
ALTER TABLE public.machines
ALTER COLUMN id
SET DEFAULT gen_random_uuid();
-- Make ID Primary Key
ALTER TABLE public.machines
ADD PRIMARY KEY (id);
-- Ensure Composite Unique Key (organization_id, code)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'machines_org_code_key'
) THEN
ALTER TABLE public.machines
ADD CONSTRAINT machines_org_code_key UNIQUE (organization_id, code);
END IF;
END $$;
-- CLEANUP: Delete orphaned Production Orders (Machine mismatch)
DELETE FROM public.production_orders po
WHERE NOT EXISTS (
        SELECT 1
        FROM public.machines m
        WHERE m.organization_id = po.organization_id
            AND m.code = po.machine_id
    );
-- CLEANUP: Delete orphaned Production Entries (Machine mismatch)
DELETE FROM public.production_entries pe
WHERE NOT EXISTS (
        SELECT 1
        FROM public.machines m
        WHERE m.organization_id = pe.organization_id
            AND m.code = pe.machine_id
    );
-- Re-create Foreign Keys
-- Production Orders -> Machines
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_machine_id_fkey,
    ADD CONSTRAINT production_orders_machine_org_fkey FOREIGN KEY (organization_id, machine_id) REFERENCES public.machines (organization_id, code) ON UPDATE CASCADE;
-- Production Entries -> Machines
ALTER TABLE public.production_entries DROP CONSTRAINT IF EXISTS production_entries_machine_id_fkey,
    ADD CONSTRAINT production_entries_machine_org_fkey FOREIGN KEY (organization_id, machine_id) REFERENCES public.machines (organization_id, code) ON UPDATE CASCADE;
COMMIT;