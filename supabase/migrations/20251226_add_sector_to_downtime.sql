-- Add sector column to downtime_types if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'downtime_types'
        AND column_name = 'sector'
) THEN
ALTER TABLE public.downtime_types
ADD COLUMN sector TEXT;
END IF;
END $$;