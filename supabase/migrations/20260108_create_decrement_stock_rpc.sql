-- RPC for Atomic Decrement Stock
CREATE OR REPLACE FUNCTION decrement_stock(
        p_material_id UUID,
        p_quantity NUMERIC,
        p_org_id UUID
    ) RETURNS VOID AS $$ BEGIN
UPDATE raw_materials
SET current_stock = current_stock - p_quantity
WHERE id = p_material_id
    AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql;