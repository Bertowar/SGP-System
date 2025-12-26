-- MIGRATION: 20251224_isolate_data.sql
-- DESCRIPTION: Adiciona isolamento de dados (organization_id + RLS) e ajusta Constraints para Multi-tenancy
DO $$
DECLARE default_org_id UUID;
BEGIN -- Obter uma org padrão para migrar dados órfãos se houver
SELECT id INTO default_org_id
FROM public.organizations
LIMIT 1;
-- =================================================================================================
-- 1. ADICIONAR COLUNAS (organization_id)
-- =================================================================================================
-- PRODUCTS
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'products'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.products
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.products
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
-- MACHINES
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'machines'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.machines
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.machines
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
-- PRODUCTION_ENTRIES
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'production_entries'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.production_entries
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.production_entries
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
-- OPERATORS
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'operators'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.operators
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.operators
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
-- APP_SETTINGS (Se ainda não tiver)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'app_settings'
        AND column_name = 'organization_id'
) THEN
ALTER TABLE public.app_settings
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
IF default_org_id IS NOT NULL THEN
UPDATE public.app_settings
SET organization_id = default_org_id
WHERE organization_id IS NULL;
END IF;
END IF;
-- =================================================================================================
-- 2. AJUSTAR CONSTRAINTS (Unique Keys compostas)
-- Necessário para o UPSERT funcionar por organização (Ex: Produtos com código 10 em empresas diferentes)
-- =================================================================================================
-- PRODUCTS: Remover unicidade apenas do 'code' e criar (organization_id, code)
IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_code_key'
) THEN
ALTER TABLE public.products DROP CONSTRAINT products_code_key;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_org_code_key'
) THEN
ALTER TABLE public.products
ADD CONSTRAINT products_org_code_key UNIQUE (organization_id, code);
END IF;
-- MACHINES: (organization_id, code)
IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'machines_code_key'
) THEN
ALTER TABLE public.machines DROP CONSTRAINT machines_code_key;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'machines_org_code_key'
) THEN
ALTER TABLE public.machines
ADD CONSTRAINT machines_org_code_key UNIQUE (organization_id, code);
END IF;
-- OPERATORS: (organization_id, name)
-- Nota: Se operators usa ID como PK, precisamos garantir que o sistema não tente inserir duplicados por nome na mesma org.
IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operators_name_key'
) THEN
ALTER TABLE public.operators DROP CONSTRAINT operators_name_key;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operators_org_name_key'
) THEN
ALTER TABLE public.operators
ADD CONSTRAINT operators_org_name_key UNIQUE (organization_id, name);
END IF;
END $$;
-- =================================================================================================
-- 3. HABILITAR RLS E CRIAR POLICIES
-- =================================================================================================
-- PRODUCTS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for products" ON public.products;
CREATE POLICY "Isolation for products" ON public.products USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
-- MACHINES
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for machines" ON public.machines;
CREATE POLICY "Isolation for machines" ON public.machines USING (
    organization_id = public.get_current_org_id()
    OR organization_id IS NULL
) WITH CHECK (organization_id = public.get_current_org_id());
-- PRODUCTION_ENTRIES
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for entries" ON public.production_entries;
CREATE POLICY "Isolation for entries" ON public.production_entries USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
-- OPERATORS
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for operators" ON public.operators;
CREATE POLICY "Isolation for operators" ON public.operators USING (
    organization_id = public.get_current_org_id()
    OR id = 99999
) -- System Operator ID (Integer)
WITH CHECK (organization_id = public.get_current_org_id());
-- APP_SETTINGS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation for settings" ON public.app_settings;
CREATE POLICY "Isolation for settings" ON public.app_settings USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());