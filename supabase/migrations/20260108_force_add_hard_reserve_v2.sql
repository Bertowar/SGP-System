-- Force Add hard_reserve_stock check and RPC recreation
-- 1. Safely add column if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'app_settings'
        AND column_name = 'hard_reserve_stock'
) THEN
ALTER TABLE app_settings
ADD COLUMN hard_reserve_stock BOOLEAN DEFAULT FALSE;
END IF;
END $$;
-- 2. Force Refresh Schema Cache (Notify PostgREST)
NOTIFY pgrst,
'reload config';
-- 3. Re-create RPC for atomic stock decrement
CREATE OR REPLACE FUNCTION decrement_stock(
        p_material_id UUID,
        p_quantity NUMERIC,
        p_org_id UUID
    ) RETURNS VOID AS $$ BEGIN -- Validate inputs
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive';
END IF;
-- Verify ownership via RLS context or explicit check (though RLS on update applies)
UPDATE raw_materials
SET current_stock = COALESCE(current_stock, 0) - p_quantity
WHERE id = p_material_id
    AND organization_id = p_org_id;
-- Validation: prevent negative stock? (Optional, maybe for strict mode)
-- FOR NOW allows negative stock as per user business logic flexibility
END;
$$ LANGUAGE plpgsql;
-- 4. Grant Execute permissions explicitly
GRANT EXECUTE ON FUNCTION decrement_stock(UUID, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_stock(UUID, NUMERIC, UUID) TO service_role;