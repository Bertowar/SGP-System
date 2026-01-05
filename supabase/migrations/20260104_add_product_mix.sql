-- Add extrusion_mix column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS extrusion_mix JSONB DEFAULT NULL;
-- Comment for clarity
COMMENT ON COLUMN products.extrusion_mix IS 'Stores the standard recipe/mix for extrusion products (JSON Array: [{type, subType, qty}])';