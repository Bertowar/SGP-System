-- MIGRATION: 20251227_rpc_switch_org.sql
-- DESCRIPTION: Adds switch_organization RPC to bypass RLS for context switching
CREATE OR REPLACE FUNCTION public.switch_organization(target_org_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_is_super_admin boolean;
BEGIN -- Check permission
SELECT is_super_admin INTO v_is_super_admin
FROM public.profiles
WHERE id = auth.uid();
IF v_is_super_admin IS TRUE THEN -- Perform update bypassing RLS
UPDATE public.profiles
SET organization_id = target_org_id
WHERE id = auth.uid();
ELSE RAISE EXCEPTION 'Apenas Super Admins podem trocar de organização livremente.';
END IF;
END;
$$;