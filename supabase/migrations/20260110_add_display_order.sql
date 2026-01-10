-- Add display_order column to sectors table
ALTER TABLE sectors
ADD COLUMN IF NOT EXISTS display_order INTEGER;
-- Add display_order column to machines table
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS display_order INTEGER;