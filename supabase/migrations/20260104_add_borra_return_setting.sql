-- Add column to control Borra return logic
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS include_borra_in_return BOOLEAN DEFAULT FALSE;
-- Update comment
COMMENT ON COLUMN app_settings.include_borra_in_return IS 'Se true, soma Borra no cálculo de Retorno da Extrusão. Se false, não soma.';