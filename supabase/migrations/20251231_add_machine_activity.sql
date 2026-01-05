-- Add activity column to machines table
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS activity TEXT;
-- Update RLS if necessary (usually not needed for new columns if policy is on table)
-- Ensure it is visible to metadata queries
COMMENT ON COLUMN machines.activity IS 'Activity performed by the machine (e.g., Extrusão, Corte)';