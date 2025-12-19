-- Execute the RPC function directly to see the JSON output in the results table.
-- This query calls the function for the date 2025-12-04 and expands the 'machines' array into rows.

SELECT * 
FROM jsonb_array_elements( 
    (get_dashboard_metrics('2025-12-04', '2025-12-04')->'machines')::jsonb 
);
