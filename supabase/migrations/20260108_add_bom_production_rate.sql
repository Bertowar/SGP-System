-- Add production_rate_per_hour to product_boms table
-- This allows defining a standard production rate (Pieces/Hour) per BOM version.
ALTER TABLE product_boms
ADD COLUMN production_rate_per_hour NUMERIC DEFAULT NULL;