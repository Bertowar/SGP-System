-- Safe Product Types Fix
-- 1. Table (Safe)
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
-- 2. RLS Enable (Safe)
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
-- 3. Policy (Idempotent)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'product_types'
        AND policyname = 'Tenant Isolation'
) THEN CREATE POLICY "Tenant Isolation" ON public.product_types USING (organization_id = public.get_current_org_id()) WITH CHECK (organization_id = public.get_current_org_id());
END IF;
END $$;
-- 4. Column in Products (Safe)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS product_type_id UUID REFERENCES public.product_types(id);
-- 5. Helper Function (Safe)
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
-- 6. Trigger (Safe: Drop and Recreate)
DROP TRIGGER IF EXISTS sync_product_type_trigger ON public.products;
CREATE TRIGGER sync_product_type_trigger BEFORE
INSERT
    OR
UPDATE OF product_type_id ON public.products FOR EACH ROW EXECUTE FUNCTION public.sync_product_classification();