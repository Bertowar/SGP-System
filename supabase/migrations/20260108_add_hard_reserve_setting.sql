-- Add hard_reserve_stock to app_settings
ALTER TABLE app_settings
ADD COLUMN hard_reserve_stock BOOLEAN DEFAULT FALSE;