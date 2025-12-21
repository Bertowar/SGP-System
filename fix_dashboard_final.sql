DROP FUNCTION IF EXISTS get_dashboard_metrics(text, text);
DROP FUNCTION IF EXISTS get_dashboard_metrics(date, date);

CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_start_date text, p_end_date text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_short boolean;
    v_result json;
    v_kpi_produced numeric;
    v_kpi_defects numeric;
    v_kpi_return numeric;
    v_kpi_loss numeric;
    v_kpi_entries integer;
    v_products json;
    v_operators json;
    v_shifts json;
    v_machines json;
BEGIN
    -- Determine if short period (<= 3 days)
    v_is_short := (p_end_date::date - p_start_date::date) <= 3;

    -- KPIs
    SELECT 
        COALESCE(SUM(pe.qty_ok), 0),
        COALESCE(SUM(CASE WHEN sr.description ILIKE '%Refile%' OR sr.description ILIKE '%Aparas%' OR sr.description ILIKE '%Retorno%' THEN pe.qty_defect ELSE 0 END), 0), -- Return
        COALESCE(SUM(CASE WHEN sr.description NOT ILIKE '%Refile%' AND sr.description NOT ILIKE '%Aparas%' AND sr.description NOT ILIKE '%Retorno%' THEN pe.qty_defect ELSE 0 END), 0), -- True Loss
        COUNT(pe.id)
    INTO v_kpi_produced, v_kpi_return, v_kpi_loss, v_kpi_entries
    FROM production_entries pe
    LEFT JOIN scrap_reasons sr ON pe.scrap_reason_id::text = sr.id::text
    WHERE pe.date >= p_start_date::date AND pe.date <= p_end_date::date;

    -- Products (Top 10)
    SELECT json_agg(t) INTO v_products FROM (
        SELECT 
            COALESCE(p.name, 'Desconhecido') as name,
            SUM(pe.qty_ok) as ok,
            SUM(pe.qty_defect) as defect
        FROM production_entries pe
        LEFT JOIN products p ON pe.product_code = p.code
        WHERE pe.date >= p_start_date::date AND pe.date <= p_end_date::date
        GROUP BY p.name
        ORDER BY SUM(pe.qty_ok) DESC
        LIMIT 10
    ) t;

    -- Operators
    SELECT json_agg(t) INTO v_operators FROM (
        SELECT 
            COALESCE(o.name, 'Desconhecido') as name,
            SUM(pe.qty_ok) as ok,
            SUM(pe.qty_defect) as defect
        FROM production_entries pe
        LEFT JOIN operators o ON pe.operator_id = o.id
        WHERE pe.date >= p_start_date::date AND pe.date <= p_end_date::date
        GROUP BY o.name
        ORDER BY SUM(pe.qty_ok) DESC
        LIMIT 10
    ) t;

    -- Shifts
    SELECT json_agg(t) INTO v_shifts FROM (
        SELECT 
            COALESCE(pe.shift, 'N/A') as name,
            SUM(pe.qty_ok) as ok,
            SUM(pe.qty_defect) as defect
        FROM production_entries pe
        WHERE pe.date >= p_start_date::date AND pe.date <= p_end_date::date
        GROUP BY pe.shift
    ) t;

    -- Machines (Polymorphic)
    IF v_is_short THEN
        -- Detail events
        SELECT json_agg(t ORDER BY t.date, t.start_time) INTO v_machines FROM (
            SELECT DISTINCT ON (pe.id)
                pe.machine_id,
                pe.date,
                pe.start_time,
                pe.end_time,
                pe.qty_ok,
                pe.qty_defect,
                COALESCE(pe.measured_weight, 0) as measured_weight,
                pe.downtime_minutes,
                dt.description as downtime_desc,
                0 as entries_count,
                (
                    CASE 
                        WHEN pe.meta_data->'extrusion' IS NOT NULL THEN 
                            COALESCE(NULLIF(pe.meta_data->'extrusion'->>'refile', '')::numeric, 0)
                        ELSE 
                            CASE WHEN sr.description ILIKE '%Refile%' OR sr.description ILIKE '%Aparas%' OR sr.description ILIKE '%Retorno%' THEN pe.qty_defect ELSE 0 END
                    END
                ) as qty_return,
                (
                    CASE 
                        WHEN pe.meta_data->'extrusion' IS NOT NULL THEN
                            COALESCE(NULLIF(pe.meta_data->'extrusion'->>'borra', '')::numeric, 0)
                        ELSE
                            CASE WHEN sr.description IS NOT NULL AND (sr.description NOT ILIKE '%Refile%' AND sr.description NOT ILIKE '%Aparas%' AND sr.description NOT ILIKE '%Retorno%') THEN pe.qty_defect 
                                 WHEN sr.description IS NULL THEN pe.qty_defect -- Fallback logic
                                 ELSE 0 
                            END
                    END
                ) as qty_loss
            FROM production_entries pe
            LEFT JOIN downtime_types dt ON pe.downtime_type_id::text = dt.id::text
            LEFT JOIN scrap_reasons sr ON pe.scrap_reason_id::text = sr.id::text
            WHERE pe.date >= p_start_date::date AND pe.date <= p_end_date::date
            ORDER BY pe.id
        ) t;
    ELSE
        -- Aggregated
        SELECT json_agg(t) INTO v_machines FROM (
            SELECT 
                pe.machine_id,
                SUM(pe.qty_ok) as total_qty,
                SUM(COALESCE(pe.measured_weight, 0)) as total_weight,
                SUM(pe.qty_defect) as total_defect,
                COUNT(pe.id) as entries_count,
                
                -- Corrigido: CASE externo para decidir a estratégia de agregação
                CASE 
                    WHEN pe.machine_id IN ('TF1', 'TF2', 'TF3') OR pe.machine_id ILIKE 'TF%' OR pe.machine_id ILIKE '%Termo%' THEN
                        -- Lógica Termoformagem: (Peso Total - Peso Teórico Total)
                        GREATEST(0, SUM(COALESCE(pe.measured_weight, 0)) - SUM(pe.qty_ok * COALESCE(p.net_weight, 0)))
                    ELSE
                        -- Lógica Padrão (Extrusão/Outros): Soma linha a linha
                        SUM(
                            CASE 
                                WHEN pe.meta_data->'extrusion' IS NOT NULL THEN 
                                    COALESCE(NULLIF(pe.meta_data->'extrusion'->>'refile', '')::numeric, 0)
                                ELSE 
                                    CASE WHEN sr.description ILIKE '%Refile%' OR sr.description ILIKE '%Aparas%' OR sr.description ILIKE '%Retorno%' THEN pe.qty_defect ELSE 0 END
                            END
                        )
                END as total_return,
                
                SUM(
                    CASE 
                        WHEN pe.meta_data->'extrusion' IS NOT NULL THEN
                            COALESCE(NULLIF(pe.meta_data->'extrusion'->>'borra', '')::numeric, 0)
                        ELSE
                            CASE WHEN sr.description IS NOT NULL AND (sr.description NOT ILIKE '%Refile%' AND sr.description NOT ILIKE '%Aparas%' AND sr.description NOT ILIKE '%Retorno%') THEN pe.qty_defect 
                                 WHEN sr.description IS NULL THEN pe.qty_defect
                                 ELSE 0 
                            END
                    END
                ) as total_loss
            FROM production_entries pe
            LEFT JOIN scrap_reasons sr ON pe.scrap_reason_id::text = sr.id::text
            LEFT JOIN products p ON pe.product_code = p.code
            WHERE pe.date >= p_start_date::date AND pe.date <= p_end_date::date
            GROUP BY pe.machine_id
        ) t;
    END IF;

    -- Construct Final JSON
    v_result := json_build_object(
        'kpis', json_build_object(
            'produced', COALESCE(v_kpi_produced, 0),
            'defects', COALESCE(v_kpi_loss, 0),
            'return', COALESCE(v_kpi_return, 0),
            'entriesCount', COALESCE(v_kpi_entries, 0),
            'efficiency', 0
        ),
        'products', COALESCE(v_products, '[]'::json),
        'operators', COALESCE(v_operators, '[]'::json),
        'shifts', COALESCE(v_shifts, '[]'::json),
        'machines', COALESCE(v_machines, '[]'::json),
        'isShortPeriod', v_is_short
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics(text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics(text, text) TO service_role;
