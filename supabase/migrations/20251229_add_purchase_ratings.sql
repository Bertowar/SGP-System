ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS rating_price integer;
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS rating_delivery integer;