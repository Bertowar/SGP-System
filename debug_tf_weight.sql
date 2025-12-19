SELECT 
    pe.id, 
    pe.date, 
    pe.machine_id, 
    m.sector,
    pe.measured_weight, 
    pe.qty_ok, 
    pe.meta_data 
FROM production_entries pe
LEFT JOIN machines m ON pe.machine_id = m.code
WHERE pe.date = '2025-12-04' AND (m.sector = 'Termoformagem' OR pe.machine_id LIKE 'TF%');
