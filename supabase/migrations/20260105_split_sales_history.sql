-- MIGRATION: 20260105_split_sales_history.sql
-- DESCRIPTION: Split sales history into Matriz and Filial columns for detailed reporting.
-- 1. Alter Monthly Accumulated Table
ALTER TABLE public.sales_monthly_accumulated
ADD COLUMN IF NOT EXISTS last_accumulated_qty_matriz INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_accumulated_val_matriz DECIMAL(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_accumulated_qty_filial INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_accumulated_val_filial DECIMAL(15, 2) DEFAULT 0;
-- 2. Alter Daily Movements Table
ALTER TABLE public.sales_daily_movements
ADD COLUMN IF NOT EXISTS daily_qty_matriz INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS daily_val_matriz DECIMAL(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS daily_qty_filial INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS daily_val_filial DECIMAL(15, 2) DEFAULT 0;
-- 3. Update RPC Function to handle split data
CREATE OR REPLACE FUNCTION public.process_sales_import(
        items JSONB,
        file_date DATE,
        force_override BOOLEAN DEFAULT FALSE
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public,
    auth AS $$
DECLARE item JSONB;
v_org_id UUID;
v_year INTEGER;
v_month INTEGER;
v_acc_record public.sales_monthly_accumulated %ROWTYPE;
-- Current Input Values
v_cur_total_qty INTEGER;
v_cur_total_val DECIMAL;
v_cur_matriz_qty INTEGER;
v_cur_matriz_val DECIMAL;
v_cur_filial_qty INTEGER;
v_cur_filial_val DECIMAL;
-- Deltas
v_delta_qty_total INTEGER;
v_delta_val_total DECIMAL;
v_delta_qty_matriz INTEGER;
v_delta_val_matriz DECIMAL;
v_delta_qty_filial INTEGER;
v_delta_val_filial DECIMAL;
BEGIN -- Get User Org
SELECT organization_id INTO v_org_id
FROM public.profiles
WHERE id = auth.uid();
IF v_org_id IS NULL THEN RAISE EXCEPTION 'Organização não encontrada para o usuário.';
END IF;
v_year := EXTRACT(
    YEAR
    FROM file_date
);
v_month := EXTRACT(
    MONTH
    FROM file_date
);
-- Loop through items
FOR item IN
SELECT *
FROM jsonb_array_elements(items) LOOP -- Fetch existing record
SELECT * INTO v_acc_record
FROM public.sales_monthly_accumulated
WHERE organization_id = v_org_id
    AND product_code = (item->>'reference')
    AND year = v_year
    AND month = v_month;
-- Extract Input Values
v_cur_total_qty := (item->>'qtyTotal')::INTEGER;
v_cur_total_val := (item->>'valTotal')::DECIMAL;
v_cur_matriz_qty := COALESCE((item->>'qtyMatriz')::INTEGER, 0);
v_cur_matriz_val := COALESCE((item->>'valMatriz')::DECIMAL, 0);
v_cur_filial_qty := COALESCE((item->>'qtyFilial')::INTEGER, 0);
v_cur_filial_val := COALESCE((item->>'valFilial')::DECIMAL, 0);
-- Security Checks (on Total)
IF v_acc_record.id IS NOT NULL
AND force_override = FALSE THEN IF file_date < v_acc_record.last_import_date THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    format(
        'DATA_RETROATIVA: Data %s < %s',
        file_date,
        v_acc_record.last_import_date
    )
);
END IF;
IF v_cur_total_val < v_acc_record.last_accumulated_value THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    format(
        'VALOR_NEGATIVO: %s (Atual: %s, Ant: %s)',
        (item->>'reference'),
        v_cur_total_val,
        v_acc_record.last_accumulated_value
    )
);
END IF;
END IF;
-- Calculate Deltas
IF v_acc_record.id IS NULL THEN -- First Insertion
v_delta_qty_total := v_cur_total_qty;
v_delta_val_total := v_cur_total_val;
v_delta_qty_matriz := v_cur_matriz_qty;
v_delta_val_matriz := v_cur_matriz_val;
v_delta_qty_filial := v_cur_filial_qty;
v_delta_val_filial := v_cur_filial_val;
ELSE -- Deltas
v_delta_qty_total := v_cur_total_qty - v_acc_record.last_accumulated_qty;
v_delta_val_total := v_cur_total_val - v_acc_record.last_accumulated_value;
-- Matriz Delta
v_delta_qty_matriz := v_cur_matriz_qty - COALESCE(v_acc_record.last_accumulated_qty_matriz, 0);
v_delta_val_matriz := v_cur_matriz_val - COALESCE(v_acc_record.last_accumulated_val_matriz, 0);
-- Filial Delta
v_delta_qty_filial := v_cur_filial_qty - COALESCE(v_acc_record.last_accumulated_qty_filial, 0);
v_delta_val_filial := v_cur_filial_val - COALESCE(v_acc_record.last_accumulated_val_filial, 0);
END IF;
-- Insert Daily Movement if there is any change
IF v_delta_qty_total <> 0
OR v_delta_val_total <> 0 THEN
INSERT INTO public.sales_daily_movements (
        organization_id,
        product_code,
        consolidated_id,
        date,
        daily_qty,
        daily_value,
        daily_qty_matriz,
        daily_val_matriz,
        daily_qty_filial,
        daily_val_filial,
        origin
    )
VALUES (
        v_org_id,
        (item->>'reference'),
        (item->>'nobreId'),
        file_date,
        v_delta_qty_total,
        v_delta_val_total,
        v_delta_qty_matriz,
        v_delta_val_matriz,
        v_delta_qty_filial,
        v_delta_val_filial,
        'AMBOS'
    );
END IF;
-- Update Monthly Accumulator
INSERT INTO public.sales_monthly_accumulated (
        organization_id,
        product_code,
        consolidated_id,
        year,
        month,
        last_accumulated_qty,
        last_accumulated_value,
        last_accumulated_qty_matriz,
        last_accumulated_val_matriz,
        last_accumulated_qty_filial,
        last_accumulated_val_filial,
        last_import_date
    )
VALUES (
        v_org_id,
        (item->>'reference'),
        (item->>'nobreId'),
        v_year,
        v_month,
        v_cur_total_qty,
        v_cur_total_val,
        v_cur_matriz_qty,
        v_cur_matriz_val,
        v_cur_filial_qty,
        v_cur_filial_val,
        file_date
    ) ON CONFLICT (organization_id, product_code, year, month) DO
UPDATE
SET last_accumulated_qty = EXCLUDED.last_accumulated_qty,
    last_accumulated_value = EXCLUDED.last_accumulated_value,
    last_accumulated_qty_matriz = EXCLUDED.last_accumulated_qty_matriz,
    last_accumulated_val_matriz = EXCLUDED.last_accumulated_val_matriz,
    last_accumulated_qty_filial = EXCLUDED.last_accumulated_qty_filial,
    last_accumulated_val_filial = EXCLUDED.last_accumulated_val_filial,
    last_import_date = EXCLUDED.last_import_date,
    updated_at = NOW();
END LOOP;
RETURN jsonb_build_object('success', true);
END;
$$;