-- Function to update stock based on transaction type
CREATE OR REPLACE FUNCTION update_stock_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- IN: Add quantity
    IF NEW.type = 'IN' THEN
        UPDATE raw_materials
        SET current_stock = COALESCE(current_stock, 0) + NEW.quantity
        WHERE id = NEW.material_id;
    
    -- OUT: Subtract quantity
    ELSIF NEW.type = 'OUT' THEN
        UPDATE raw_materials
        SET current_stock = COALESCE(current_stock, 0) - NEW.quantity
        WHERE id = NEW.material_id;
    
    -- ADJ: Set absolute quantity (Adjustment)
    ELSIF NEW.type = 'ADJ' THEN
        UPDATE raw_materials
        SET current_stock = NEW.quantity
        WHERE id = NEW.material_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to execute the function after insert on inventory_transactions
DROP TRIGGER IF EXISTS trg_update_stock ON inventory_transactions;

CREATE TRIGGER trg_update_stock
AFTER INSERT ON inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION update_stock_from_transaction();
