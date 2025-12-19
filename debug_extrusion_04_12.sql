-- Seleciona dados consolidados da Extrusão para o dia 04/12/2025
SELECT 
    'Extrusão' as setor,
    SUM(COALESCE(pe.measured_weight, 0)) as peso_total_kg,
    SUM(COALESCE(pe.qty_ok, 0)) as qtd_bobinas,
    SUM(COALESCE((pe.meta_data->'extrusion'->>'refile')::numeric, 0)) as refile_kg,
    SUM(COALESCE((pe.meta_data->'extrusion'->>'borra')::numeric, 0)) as borra_kg
FROM production_entries pe
JOIN machines m ON pe.machine_id = m.code
WHERE m.sector = 'Extrusão'
  AND pe.date = '2025-12-04';

-- Se quiser ver s lançamentos individuais para conferência:
SELECT 
    pe.id,
    pe.start_time,
    pe.end_time,
    pe.machine_id,
    pe.measured_weight as peso,
    pe.qty_ok as qtd,
    (pe.meta_data->'extrusion'->>'refile')::numeric as refile,
    (pe.meta_data->'extrusion'->>'borra')::numeric as borra
FROM production_entries pe
JOIN machines m ON pe.machine_id = m.code
WHERE m.sector = 'Extrusão'
  AND pe.date = '2025-12-04'
ORDER BY pe.start_time;
