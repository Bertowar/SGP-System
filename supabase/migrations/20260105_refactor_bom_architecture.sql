-- MIGRATION: 20260105_refactor_bom_architecture.sql
-- DESCRIPTION: Refactors BOM from flat list (product_bom) to Header (product_boms) + Items (bom_items) structure.
-- 1. Create BOM Header Table (product_boms)
CREATE TABLE IF NOT EXISTS public.product_boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS for product_boms
ALTER TABLE public.product_boms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolation for product_boms" ON public.product_boms FOR ALL USING (organization_id = get_current_org_id()) WITH CHECK (organization_id = get_current_org_id());
CREATE INDEX IF NOT EXISTS idx_product_boms_org ON public.product_boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_boms_product ON public.product_boms(product_id);
CREATE INDEX IF NOT EXISTS idx_product_boms_active ON public.product_boms(active)
WHERE active = TRUE;
-- 2. Create New BOM Items Table (bom_items)
CREATE TABLE IF NOT EXISTS public.bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    bom_id UUID NOT NULL REFERENCES public.product_boms(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS for bom_items
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolation for bom_items" ON public.bom_items FOR ALL USING (organization_id = get_current_org_id()) WITH CHECK (organization_id = get_current_org_id());
CREATE INDEX IF NOT EXISTS idx_bom_items_org ON public.bom_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON public.bom_items(bom_id);
-- 3. DATA MIGRATION: Convert existing flat BOMs to Version 1 Headers + Items
DO $$
DECLARE r RECORD;
new_bom_id UUID;
BEGIN -- For each distinct product that has items in the old product_bom table
FOR r IN (
    SELECT DISTINCT pb.product_code,
        p.id as product_id,
        pb.organization_id
    FROM public.product_bom pb
        JOIN public.products p ON p.code = pb.product_code -- Corrected column name
    WHERE pb.organization_id IS NOT NULL -- Safety check
) LOOP -- Create a Header (v1)
INSERT INTO public.product_boms (
        organization_id,
        product_id,
        version,
        active,
        description
    )
VALUES (
        r.organization_id,
        r.product_id,
        1,
        TRUE,
        'Migração Inicial (v1)'
    )
RETURNING id INTO new_bom_id;
-- Migrating items for this product
INSERT INTO public.bom_items (organization_id, bom_id, material_id, quantity)
SELECT pb.organization_id,
    new_bom_id,
    pb.material_id,
    pb.quantity_required
FROM public.product_bom pb
WHERE pb.product_code = r.product_code;
END LOOP;
END $$;
-- 4. Cleanup (Optional/Later): Drop old table
-- We keep it for safety for now, or just rename it.
-- ALTER TABLE public.product_bom RENAME TO product_bom_legacy;