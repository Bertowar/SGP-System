-- Fix quantity columns to allow decimals (numeric) instead of integer
ALTER TABLE production_orders
ALTER COLUMN target_quantity TYPE numeric USING target_quantity::numeric;
ALTER TABLE material_reservations
ALTER COLUMN quantity TYPE numeric USING quantity::numeric;