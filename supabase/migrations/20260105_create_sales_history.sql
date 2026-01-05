-- MIGRATION: 20260105_create_sales_history.sql
-- DESCRIPTION: Create tables for Daily and Monthly sales history and logic for incremental import.
-- 1. Add consolidated_id to products if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'products'
        AND column_name = 'consolidated_id'
) THEN
ALTER TABLE public.products
ADD COLUMN consolidated_id TEXT;
-- Optional: Add index for performance
CREATE INDEX idx_products_consolidated_id ON public.products(consolidated_id);
END IF;
END $$;
-- 2. Create Monthly Accumulated Table (Pointer for incremental calculation)
CREATE TABLE IF NOT EXISTS public.sales_monthly_accumulated (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    product_code TEXT NOT NULL,
    -- Original Reference
    consolidated_id TEXT,
    -- Grouping ID
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    last_accumulated_qty INTEGER DEFAULT 0,
    last_accumulated_value DECIMAL(15, 2) DEFAULT 0,
    last_import_date DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, product_code, year, month)
);
-- 3. Create Daily Movements Table (The real history)
CREATE TABLE IF NOT EXISTS public.sales_daily_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    product_code TEXT NOT NULL,
    consolidated_id TEXT,
    date DATE NOT NULL,
    daily_qty INTEGER DEFAULT 0,
    daily_value DECIMAL(15, 2) DEFAULT 0,
    origin TEXT CHECK (origin IN ('MATRIZ', 'FILIAL', 'AMBOS')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE public.sales_monthly_accumulated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_daily_movements ENABLE ROW LEVEL SECURITY;
-- 4. Create Policies
CREATE POLICY "Users can view monthly sales of their org" ON public.sales_monthly_accumulated FOR
SELECT USING (
        organization_id = (
            SELECT auth.email()::uuid
            FROM auth.users
            WHERE id = auth.uid()
        )
    );
-- SIMPLIFIED FOR EXAMPLE, USE REAL FUNCTION IN PROD
CREATE POLICY "Users can insert monthly sales of their org" ON public.sales_monthly_accumulated FOR
INSERT WITH CHECK (
        organization_id = (
            SELECT auth.email()::uuid
            FROM auth.users
            WHERE id = auth.uid()
        )
    );
-- SIMPLIFIED
-- NOTE: Reusing the standard RLS pattern for brevity/correctness in actual deployment
-- Dropping simplified policies to use the Robust approach if exists
DROP POLICY IF EXISTS "Users can view monthly sales of their org" ON public.sales_monthly_accumulated;
DROP POLICY IF EXISTS "Users can insert monthly sales of their org" ON public.sales_monthly_accumulated;
CREATE POLICY "Access Monthly Sales" ON public.sales_monthly_accumulated USING (
    organization_id = (
        SELECT organization_id
        FROM public.profiles
        WHERE id = auth.uid()
    )
);
CREATE POLICY "Access Daily Sales" ON public.sales_daily_movements USING (
    organization_id = (
        SELECT organization_id
        FROM public.profiles
        WHERE id = auth.uid()
    )
);
-- 5. RPC Function to Process Import
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
v_current_accumulated_qty INTEGER;
v_current_accumulated_val DECIMAL;
v_delta_qty INTEGER;
v_delta_val DECIMAL;
v_result JSONB;
v_errors TEXT [] := ARRAY []::TEXT [];
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
FROM jsonb_array_elements(items) LOOP -- Check Logic for specific product
SELECT * INTO v_acc_record
FROM public.sales_monthly_accumulated
WHERE organization_id = v_org_id
    AND product_code = (item->>'reference')
    AND year = v_year
    AND month = v_month;
v_current_accumulated_qty := (item->>'qtyTotal')::INTEGER;
v_current_accumulated_val := (item->>'valTotal')::DECIMAL;
-- Validation Checks (Skip if force_override is TRUE)
IF v_acc_record.id IS NOT NULL
AND force_override = FALSE THEN IF file_date < v_acc_record.last_import_date THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    format(
        'DATA_RETROATIVA: Data %s é anterior à última importação (%s)',
        file_date,
        v_acc_record.last_import_date
    )
);
END IF;
IF v_current_accumulated_val < v_acc_record.last_accumulated_value THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    format(
        'VALOR_NEGATIVO: Produto %s tem valor acumulado menor que o anterior (Atual: %s, Ant: %s)',
        (item->>'reference'),
        v_current_accumulated_val,
        v_acc_record.last_accumulated_value
    )
);
END IF;
END IF;
-- Calculate Deltas
IF v_acc_record.id IS NULL THEN -- First record for month
v_delta_qty := v_current_accumulated_qty;
v_delta_val := v_current_accumulated_val;
ELSE -- Delta
v_delta_qty := v_current_accumulated_qty - v_acc_record.last_accumulated_qty;
v_delta_val := v_current_accumulated_val - v_acc_record.last_accumulated_value;
END IF;
-- Insert Daily Movement (The "Delta")
-- Only insert if there is movement (avoid zeros if re-importing same day/file)
IF v_delta_qty <> 0
OR v_delta_val <> 0 THEN
INSERT INTO public.sales_daily_movements (
        organization_id,
        product_code,
        consolidated_id,
        date,
        daily_qty,
        daily_value,
        origin
    )
VALUES (
        v_org_id,
        (item->>'reference'),
        (item->>'nobreId'),
        -- Mapped from frontend logic
        file_date,
        v_delta_qty,
        v_delta_val,
        'AMBOS' -- Simplified origin tracking
    );
END IF;
-- Update or Insert Monthly Accumulator
INSERT INTO public.sales_monthly_accumulated (
        organization_id,
        product_code,
        consolidated_id,
        year,
        month,
        last_accumulated_qty,
        last_accumulated_value,
        last_import_date
    )
VALUES (
        v_org_id,
        (item->>'reference'),
        (item->>'nobreId'),
        v_year,
        v_month,
        v_current_accumulated_qty,
        v_current_accumulated_val,
        file_date
    ) ON CONFLICT (organization_id, product_code, year, month) DO
UPDATE
SET last_accumulated_qty = EXCLUDED.last_accumulated_qty,
    last_accumulated_value = EXCLUDED.last_accumulated_value,
    last_import_date = EXCLUDED.last_import_date,
    updated_at = NOW();
END LOOP;
RETURN jsonb_build_object('success', true);
END;
$$;