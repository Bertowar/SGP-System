-- Fix qty_defect column type to allow decimals (Weights)
ALTER TABLE production_entries 
ALTER COLUMN qty_defect TYPE NUMERIC(15, 3);
