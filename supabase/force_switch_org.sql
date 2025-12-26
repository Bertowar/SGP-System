-- FORCE SWITCH USER TO NEW ORGANIZATION
-- Run this in Supabase SQL Editor
DO $$
DECLARE v_new_org_id UUID;
v_user_id UUID;
v_user_email TEXT := 'bertowebmaster@gmail.com';
BEGIN -- 1. Find the User
SELECT id INTO v_user_id
FROM auth.users
WHERE email = v_user_email;
IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário % não encontrado!',
v_user_email;
END IF;
-- 2. Find the New Organization
SELECT id INTO v_new_org_id
FROM public.organizations
WHERE slug = 'nova-empresa-manual';
IF v_new_org_id IS NULL THEN RAISE EXCEPTION 'A organização "nova-empresa-manual" não existe. Rode o script de criação manual primeiro.';
END IF;
-- 3. FORCE UPDATE Profile
UPDATE public.profiles
SET organization_id = v_new_org_id
WHERE id = v_user_id;
-- 4. Verify
RAISE NOTICE '---------------------------------------------------';
RAISE NOTICE 'USUÁRIO: %',
v_user_email;
RAISE NOTICE 'MUDADO PARA ORG: %',
v_new_org_id;
RAISE NOTICE '---------------------------------------------------';
-- 5. Quick Check of what this user SHOULD see
-- Note: This 'perform' block simulates what the function returns
DECLARE resolved_id UUID;
BEGIN
SELECT organization_id INTO resolved_id
FROM public.profiles
WHERE id = v_user_id;
RAISE NOTICE 'CONFIRMAÇÃO DO BANCO: O Perfil agora aponta para %',
resolved_id;
END;
END $$;