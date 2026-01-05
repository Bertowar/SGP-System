-- Create a default organization if none exists
INSERT INTO public.organizations (name, slug)
SELECT 'SGP Padrão',
    'sgp-padrao'
WHERE NOT EXISTS (
        SELECT 1
        FROM public.organizations
    );
-- Update all profiles to belong to the first organization found if they don't have one
UPDATE public.profiles
SET organization_id = (
        SELECT id
        FROM public.organizations
        LIMIT 1
    ), role = 'owner', -- Force owner for dev/test
    is_super_admin = true -- Force SA for dev/test
WHERE organization_id IS NULL;