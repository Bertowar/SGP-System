DO $$
DECLARE v_count integer;
BEGIN RAISE NOTICE '--- Checking table product_types ---';
SELECT count(*) INTO v_count
FROM information_schema.tables
WHERE table_name = 'product_types';
RAISE NOTICE 'Table product_types exists: %',
v_count > 0;
RAISE NOTICE '--- Checking columns in product_types ---';
FOR v_count IN
SELECT count(*)
FROM information_schema.columns
WHERE table_name = 'product_types' LOOP RAISE NOTICE 'Column count: %',
    v_count;
END LOOP;
RAISE NOTICE '--- Checking policies on product_types ---';
PERFORM count(*)
FROM pg_policies
WHERE tablename = 'product_types';
-- We can't easily iterate pg_policies notices in a simple way without more logic, but let's just count
SELECT count(*) INTO v_count
FROM pg_policies
WHERE tablename = 'product_types';
RAISE NOTICE 'Policy count: %',
v_count;
RAISE NOTICE '--- Checking product_type_id in products ---';
SELECT count(*) INTO v_count
FROM information_schema.columns
WHERE table_name = 'products'
    AND column_name = 'product_type_id';
RAISE NOTICE 'Column product_type_id exists in products: %',
v_count > 0;
END $$;