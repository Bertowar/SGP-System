-- MIGRATION: 20251227_make_func_volatile.sql
-- DESCRIPTION: Changes get_current_org_id to VOLATILE to prevent caching issues
CREATE OR REPLACE FUNCTION public.get_current_org_id() RETURNS uuid LANGUAGE plpgsql VOLATILE AS $function$
DECLARE v_org_id uuid;
BEGIN
SELECT organization_id INTO v_org_id
FROM public.profiles
WHERE id = auth.uid();
RETURN v_org_id;
END;
$function$;