-- Drop existing view to ensure clean slate
DROP VIEW IF EXISTS product_costs_summary;
-- Recreate View with Organization ID and Correct Cost Logic
CREATE OR REPLACE VIEW product_costs_summary AS
SELECT p.organization_id,
    p.id AS product_id,
    p.code AS product_code,
    p.name AS product_name,
    p.selling_price,
    -- Material Cost: Sum of Active BOM Items (excluding Packaging)
    COALESCE(
        (
            SELECT SUM(bi.quantity * rm.unit_cost)
            FROM product_boms pb
                JOIN bom_items bi ON bi.bom_id = pb.id
                JOIN raw_materials rm ON rm.id = bi.material_id
            WHERE pb.product_id = p.id
                AND pb.active = true
                AND rm.category != 'packaging'
        ),
        0
    ) AS material_cost,
    -- Packaging Cost: Sum of Active BOM Items (Packaging only)
    COALESCE(
        (
            SELECT SUM(bi.quantity * rm.unit_cost)
            FROM product_boms pb
                JOIN bom_items bi ON bi.bom_id = pb.id
                JOIN raw_materials rm ON rm.id = bi.material_id
            WHERE pb.product_id = p.id
                AND pb.active = true
                AND rm.category = 'packaging'
        ),
        0
    ) AS packaging_cost,
    -- Operational Cost: Based on Route Cycle Time * Standard Rate (R$ 50/h)
    COALESCE(
        (
            SELECT SUM(
                    (rs.cycle_time / 3600.0) * 50
                )
            FROM product_routes pr
                JOIN route_steps rs ON rs.route_id = pr.id
            WHERE pr.product_id = p.id
                AND pr.active = true
        ),
        0
    ) AS operational_cost
FROM products p;
-- Grant permissions to authenticated users
GRANT SELECT ON product_costs_summary TO authenticated;