-- Fix missing columns in app_settings table
-- This script ensures ALL required columns exist, handling potential missing migrations.
DO $$ BEGIN -- Check and add 'include_borra_in_return'
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'app_settings'
        AND column_name = 'include_borra_in_return'
) THEN
ALTER TABLE app_settings
ADD COLUMN include_borra_in_return BOOLEAN DEFAULT FALSE;
END IF;
-- Check and add 'hard_reserve_stock' (Just in case)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'app_settings'
        AND column_name = 'hard_reserve_stock'
) THEN
ALTER TABLE app_settings
ADD COLUMN hard_reserve_stock BOOLEAN DEFAULT FALSE;
END IF;
END $$;
-- Force Schema Cache Reload
NOTIFY pgrst,
'reload config';