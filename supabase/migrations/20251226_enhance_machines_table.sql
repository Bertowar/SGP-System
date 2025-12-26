-- Add capacity_unit and machine_value columns to machines if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'machines'
        AND column_name = 'capacity_unit'
) THEN
ALTER TABLE public.machines
ADD COLUMN capacity_unit TEXT;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'machines'
        AND column_name = 'machine_value'
) THEN
ALTER TABLE public.machines
ADD COLUMN machine_value NUMERIC;
END IF;
END $$;