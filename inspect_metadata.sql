-- Inspect raw metadata for Extrusion on 2025-12-04
SELECT 
    id,
    date,
    machine_id,
    qty_defect,
    meta_data,
    meta_data->'extrusion' as extrusion_obj,
    meta_data->'extrusion'->>'refile' as refile_val,
    meta_data->'extrusion'->>'borra' as borra_val
FROM production_entries 
WHERE date = '2025-12-04' 
  AND machine_id LIKE 'EXT%'
ORDER BY start_time;
