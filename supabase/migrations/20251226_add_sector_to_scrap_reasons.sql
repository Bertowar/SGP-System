-- Add sector column to scrap_reasons if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'scrap_reasons'
        AND column_name = 'sector'
) THEN
ALTER TABLE public.scrap_reasons
ADD COLUMN sector TEXT;
END IF;
END $$;