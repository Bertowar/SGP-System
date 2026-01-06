-- Migration: create order_status_history table
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) DEFAULT public.get_current_org_id(),
  order_id TEXT NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- Index for performance
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_org_id ON public.order_status_history(organization_id);
-- Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolation for order_status_history" ON public.order_status_history FOR ALL USING (organization_id = public.get_current_org_id());