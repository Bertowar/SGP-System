DO $$
DECLARE v_count integer;
BEGIN RAISE NOTICE '--- Checking columns in downtime_types ---';
SELECT count(*) INTO v_count
FROM information_schema.columns
WHERE table_name = 'downtime_types'
    AND column_name = 'sector';
RAISE NOTICE 'Column "sector" exists: %',
v_count > 0;
END $$;