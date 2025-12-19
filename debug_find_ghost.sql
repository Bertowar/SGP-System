-- Search for specific values to identify "Ghost" entries
-- The dashboard shows Loss=39. Finding this entry will tell us the real date range being used.

SELECT 
    id, date, start_time, machine_id, qty_defect, meta_data 
FROM production_entries
WHERE 
    qty_defect = 39 
    OR (meta_data->'extrusion'->>'borra')::numeric = 39
    OR (meta_data->'extrusion'->>'refile')::numeric = 39;

-- Also check close to 5508
SELECT 
    id, date, start_time, machine_id, qty_defect, meta_data
FROM production_entries
WHERE 
    qty_defect > 5000
    OR (meta_data->'extrusion'->>'refile')::numeric > 5000;
