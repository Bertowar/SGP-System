-- 1. Create table for dynamic product types
CREATE TABLE IF NOT EXISTS public.product_types (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    classification TEXT NOT NULL CHECK (
        classification IN ('FINISHED', 'INTERMEDIATE', 'COMPONENT')
    ),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT product_types_pkey PRIMARY KEY (id),
    CONSTRAINT product_types_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
-- RLS for product_types
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation" ON public.product_types USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
-- 2. Add product_type_id to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS product_type_id UUID REFERENCES public.product_types(id);
-- 3. Populate default types for existing organizations (optional, but good for UX)
-- This part is tricky in a migration if we want to do it for ALL existing orgs.
-- For now, let's just ensure the table exists. The frontend or a trigger can handle defaults.
-- However, to avoid breaking the UI for existing products which rely on 'type' column (the old one),
-- we will keep the 'type' column as the Source of Truth for logic (Extrusion vs Thermo),
-- and 'product_type_id' as the user-facing classification.
-- Ideally, a trigger should update 'type' when 'product_type_id' changes.
CREATE OR REPLACE FUNCTION public.sync_product_classification() RETURNS TRIGGER AS $$
DECLARE v_classification TEXT;
BEGIN IF NEW.product_type_id IS NOT NULL THEN
SELECT classification INTO v_classification
FROM public.product_types
WHERE id = NEW.product_type_id;
IF v_classification IS NOT NULL THEN NEW.type := v_classification;
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER sync_product_type_trigger BEFORE
INSERT
    OR
UPDATE OF product_type_id ON public.products FOR EACH ROW EXECUTE FUNCTION public.sync_product_classification();