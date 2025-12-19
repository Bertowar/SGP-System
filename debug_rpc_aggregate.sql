-- Aggregate the RPC results by Machine ID to find the high value source
-- This helps us verify if the backend is sending 5508kg for Extrusion or if it's a frontend issue.

WITH raw_data AS (
    SELECT * 
    FROM jsonb_array_elements( 
        (get_dashboard_metrics('2025-12-04', '2025-12-04')->'machines')::jsonb 
    )
)
SELECT 
    value->>'machine_id' as machine,
    SUM((value->>'qty_return')::numeric) as total_return,
    SUM((value->>'qty_loss')::numeric) as total_loss,
    SUM((value->>'qty_ok')::numeric) as total_production
FROM raw_data
GROUP BY value->>'machine_id';
