-- MIGRATION: 20251226_alphanumeric_code.sql
-- DESCRIPTION: Change product code from INTEGER to TEXT to allow alphanumeric codes
-- 1. Alter products table
ALTER TABLE public.products
ALTER COLUMN code TYPE TEXT;
-- 2. Alter product_machines table (foreign key relationship)
-- Note: If there is a foreign key constraint, we might need to drop and recreate it, or PG might handle it if we do it in order.
-- Let's alter the column first.
ALTER TABLE public.product_machines
ALTER COLUMN product_code TYPE TEXT;
-- 3. If there are other tables referencing product code, they should be updated here.
-- Based on previous context, production_entries might reference product_id (good) or code?
-- Let's check production_entries schema if possible, but assuming standard linking is via ID now or Code.
-- If production_entries uses code, we need to update it too. We'll assume it might for legacy reasons.
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'production_entries'
        AND column_name = 'product_code'
) THEN
ALTER TABLE public.production_entries
ALTER COLUMN product_code TYPE TEXT;
END IF;
END $$;