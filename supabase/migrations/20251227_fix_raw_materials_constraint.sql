-- MIGRATION: 20251227_fix_raw_materials_constraint.sql
-- DESCRIPTION: Adiciona organization_id em raw_materials e corrige constraint UNIQUE para multi-tenancy
DO $$
DECLARE default_org_id UUID;
BEGIN -- 1. Obter org padrão para backfill se necessário
SELECT id INTO default_org_id
FROM public.organizations
LIMIT 1;
-- 2. Adicionar coluna organization_id se não existir
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'raw_materials'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.raw_materials
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
-- Backfill
IF default_org_id IS NOT NULL THEN
UPDATE public.raw_materials
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
-- 3. Corrigir Constraints
-- Remover constraint antiga 'raw_materials_code_key' se existir (padrão do Supabase para unique)
IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'raw_materials_code_key'
) THEN
ALTER TABLE public.raw_materials DROP CONSTRAINT raw_materials_code_key;
END IF;
-- Adicionar nova constraint (organization_id, code)
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'raw_materials_org_code_key'
) THEN
ALTER TABLE public.raw_materials
ADD CONSTRAINT raw_materials_org_code_key UNIQUE (organization_id, code);
END IF;
-- 4. RLS Policies
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
-- Drop existing if any just to be safe/clean
DROP POLICY IF EXISTS "Isolation for raw_materials" ON public.raw_materials;
CREATE POLICY "Isolation for raw_materials" ON public.raw_materials USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL -- Opcional: permitir ver globais se houver
) WITH CHECK (
    organization_id = public.get_current_org_id()
);
END $$;