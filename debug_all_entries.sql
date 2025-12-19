-- Fetch ALL entries for 2025-12-04 to detect hidden data
SELECT 
    pe.id,
    pe.machine_id,
    m.sector,
    pe.qty_ok,
    pe.measured_weight,
    pe.qty_defect,
    pe.meta_data,
    (pe.meta_data->'extrusion'->>'refile')::numeric as refile,
    (pe.meta_data->'extrusion'->>'borra')::numeric as borra
FROM production_entries pe
LEFT JOIN machines m ON pe.machine_id = m.code
WHERE pe.date = '2025-12-04';
