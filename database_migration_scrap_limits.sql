ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS extrusion_scrap_limit NUMERIC DEFAULT 5.0;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS thermoforming_scrap_limit NUMERIC DEFAULT 2.0;
