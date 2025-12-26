DO $$
DECLARE r record;
BEGIN RAISE NOTICE '--- FK Constraints on downtime_types ---';
FOR r IN
SELECT tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table
FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'downtime_types'
    AND tc.constraint_type = 'FOREIGN KEY' LOOP RAISE NOTICE 'Constraint: % | Column: % | Ref Table: %',
    r.constraint_name,
    r.column_name,
    r.foreign_table;
END LOOP;
END $$;