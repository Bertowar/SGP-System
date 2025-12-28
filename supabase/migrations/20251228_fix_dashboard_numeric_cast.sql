-- MIGRATION: 20251228_fix_dashboard_numeric_cast.sql
-- DESCRIPTION: Fixes 'invalid input syntax for type numeric: ""' by handling empty strings in JSON extraction.
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_start_date text, p_end_date text) RETURNS json LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_org_id uuid;
v_machines json;
v_products json;
v_operators json;
v_shifts json;
v_kpis json;
v_is_short_period boolean;
v_days_diff int;
v_start date;
v_end date;
BEGIN -- 1. Get Current Org ID (Secure)
v_org_id := public.get_current_org_id();
IF v_org_id IS NULL THEN RAISE EXCEPTION 'Organization context missing';
END IF;
-- Cast inputs to date
v_start := p_start_date::date;
v_end := p_end_date::date;
-- 2. Determine Period Type
v_days_diff := v_end - v_start;
v_is_short_period := v_days_diff <= 3;
-- 3. Aggregates
-- MACHINES
IF v_is_short_period THEN
SELECT json_agg(t) INTO v_machines
FROM (
        SELECT pe.machine_id,
            m.name as machine_name,
            pe.date,
            pe.start_time,
            pe.end_time,
            pe.downtime_minutes,
            pe.qty_ok,
            pe.qty_defect,
            COALESCE(pe.measured_weight, 0) as measured_weight,
            pe.qty_ok as total_qty,
            (pe.meta_data->>'downtime_desc') as downtime_desc
        FROM public.production_entries pe
            LEFT JOIN public.machines m ON pe.machine_id = m.code
            AND m.organization_id = v_org_id
        WHERE pe.organization_id = v_org_id
            AND pe.date >= v_start
            AND pe.date <= v_end
        ORDER BY pe.date,
            pe.machine_id,
            pe.start_time
    ) t;
ELSE
SELECT json_agg(t) INTO v_machines
FROM (
        SELECT pe.machine_id,
            MAX(m.name) as name,
            SUM(pe.qty_ok) as total_qty,
            SUM(pe.qty_defect) as total_defect,
            SUM(COALESCE(pe.measured_weight, 0)) as total_weight,
            COUNT(pe.id) as entries_count,
            -- Aggregation Update: Safe Cast for Refile/Borra 
            -- Uses NULLIF(val, '') to handle empty strings before casting to numeric
            SUM(
                CASE
                    WHEN m.sector = 'Extrusão' THEN COALESCE(
                        NULLIF(pe.meta_data->'extrusion'->>'refile', '')::numeric,
                        0
                    )
                    WHEN m.sector IN ('Termoformagem', 'TFs') THEN GREATEST(
                        COALESCE(pe.measured_weight, 0) - (
                            pe.qty_ok * (COALESCE(prod.net_weight, 0) / 1000.0)
                        ),
                        0
                    )
                    ELSE 0
                END
            ) as total_return,
            SUM(
                CASE
                    WHEN m.sector = 'Extrusão' THEN COALESCE(
                        NULLIF(pe.meta_data->'extrusion'->>'borra', '')::numeric,
                        0
                    )
                    ELSE pe.qty_defect
                END
            ) as total_loss
        FROM public.production_entries pe
            LEFT JOIN public.machines m ON pe.machine_id = m.code
            AND m.organization_id = v_org_id
            LEFT JOIN public.products prod ON pe.product_code = prod.code
            AND prod.organization_id = v_org_id
        WHERE pe.organization_id = v_org_id
            AND pe.date >= v_start
            AND pe.date <= v_end
        GROUP BY pe.machine_id
    ) t;
END IF;
-- PRODUCTS
SELECT json_agg(t) INTO v_products
FROM (
        SELECT COALESCE(prod.name, pe.product_code::text) as name,
            SUM(pe.qty_ok) as ok,
            SUM(pe.qty_defect) as defect
        FROM public.production_entries pe
            LEFT JOIN public.products prod ON pe.product_code = prod.code
            AND prod.organization_id = v_org_id
        WHERE pe.organization_id = v_org_id
            AND pe.date >= v_start
            AND pe.date <= v_end
            AND pe.product_code IS NOT NULL
        GROUP BY COALESCE(prod.name, pe.product_code::text)
        ORDER BY ok DESC
        LIMIT 10
    ) t;
-- OPERATORS
SELECT json_agg(t) INTO v_operators
FROM (
        SELECT COALESCE(op.name, pe.operator_id::text) as name,
            SUM(pe.qty_ok) as ok,
            SUM(pe.qty_defect) as defect
        FROM public.production_entries pe
            LEFT JOIN public.operators op ON pe.operator_id = op.id
            AND op.organization_id = v_org_id
        WHERE pe.organization_id = v_org_id
            AND pe.date >= v_start
            AND pe.date <= v_end
        GROUP BY COALESCE(op.name, pe.operator_id::text)
        ORDER BY ok DESC
        LIMIT 10
    ) t;
-- SHIFTS
SELECT json_agg(t) INTO v_shifts
FROM (
        SELECT pe.shift as name,
            SUM(pe.qty_ok) as ok,
            SUM(pe.qty_defect) as defect
        FROM public.production_entries pe
        WHERE pe.organization_id = v_org_id
            AND pe.date >= v_start
            AND pe.date <= v_end
            AND pe.shift IS NOT NULL
        GROUP BY pe.shift
    ) t;
-- KPIS (Totals)
SELECT json_build_object(
        'produced',
        COALESCE(SUM(qty_ok), 0),
        'defects',
        COALESCE(SUM(qty_defect), 0)
    ) INTO v_kpis
FROM public.production_entries
WHERE organization_id = v_org_id
    AND date >= v_start
    AND date <= v_end;
-- Final Result
RETURN json_build_object(
    'machines',
    COALESCE(v_machines, '[]'::json),
    'products',
    COALESCE(v_products, '[]'::json),
    'operators',
    COALESCE(v_operators, '[]'::json),
    'shifts',
    COALESCE(v_shifts, '[]'::json),
    'kpis',
    v_kpis,
    'isShortPeriod',
    v_is_short_period
);
END;
$$;