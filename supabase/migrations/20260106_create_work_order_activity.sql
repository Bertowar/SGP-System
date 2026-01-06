-- Migration: create work_order_activity table (link to production_order_steps)
CREATE TABLE IF NOT EXISTS public.work_order_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) DEFAULT public.get_current_org_id(),
    work_order_id UUID NOT NULL REFERENCES public.production_order_steps(id) ON DELETE CASCADE,
    operation_id UUID,
    -- Link to route_steps.id if needed
    operator_id BIGINT REFERENCES public.operators(id),
    produced_qty NUMERIC(15, 4) NOT NULL DEFAULT 0,
    rejected_qty NUMERIC(15, 4) NOT NULL DEFAULT 0,
    material_used JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- Index for performance
CREATE INDEX IF NOT EXISTS idx_work_order_activity_wo_id ON public.work_order_activity(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_activity_org_id ON public.work_order_activity(organization_id);
-- Enable RLS
ALTER TABLE public.work_order_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolation for work_order_activity" ON public.work_order_activity FOR ALL USING (organization_id = public.get_current_org_id());