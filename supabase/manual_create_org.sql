-- WORKAROUND: Create Organization Manually (Bypassing Edge Function)
-- 1. Replace values below if needed
-- 2. Run in Supabase SQL Editor
DO $$
DECLARE new_org_id UUID;
v_owner_id UUID;
v_org_slug TEXT := 'nova-empresa-manual';
BEGIN -- 1. Get owner ID (Try current auth user first, then fallback to email)
v_owner_id := auth.uid();
IF v_owner_id IS NULL THEN
SELECT id INTO v_owner_id
FROM auth.users
WHERE email = 'bertowebmaster@gmail.com';
END IF;
IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado! Faça login no SQL Editor ou verifique o email.';
END IF;
-- 2. CLEANUP: Delete existing test organization to avoid "Available" or "Duplicate" errors
-- 2.1 First, unlink any profiles attached to this org to avoid Foreign Key Violation
UPDATE public.profiles
SET organization_id = NULL
WHERE organization_id IN (
        SELECT id
        FROM public.organizations
        WHERE slug = v_org_slug
    );
-- 2.2 Now it's safe to delete
DELETE FROM public.organizations
WHERE slug = v_org_slug;
-- 3. Insert Organization
INSERT INTO public.organizations (name, slug, plan, owner_id)
VALUES (
        'Nova Empresa Manual',
        v_org_slug,
        'enterprise',
        v_owner_id
    )
RETURNING id INTO new_org_id;
-- 4. Force Update Profile to THIS Organization
UPDATE public.profiles
SET organization_id = new_org_id
WHERE id = v_owner_id;
RAISE NOTICE 'SUCESSO! Organização criada: %',
new_org_id;
RAISE NOTICE 'Perfil atualizado para a nova organização.';
END $$;