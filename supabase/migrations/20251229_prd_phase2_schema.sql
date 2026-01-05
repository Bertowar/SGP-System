-- PRD Phase 2: Automation & Unfolding Schema Changes
-- 1. Update production_orders table
ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS bom_id UUID,
    -- Snapshot or reference
ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.product_routes(id),
    ADD COLUMN IF NOT EXISTS sales_order_id UUID,
    -- Integration point
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';
-- Ensure status column covers PRD states
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_status_check;
ALTER TABLE public.production_orders
ADD CONSTRAINT production_orders_status_check CHECK (
        status IN (
            'DRAFT',
            'PLANNED',
            'CONFIRMED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED'
        )
    );
-- 2. Create material_reservations table (RF5)
CREATE TABLE IF NOT EXISTS public.material_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT get_current_org_id(),
    production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.raw_materials(id),
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONSUMED', 'RELEASED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- RLS for material_reservations
ALTER TABLE public.material_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolation for material_reservations" ON public.material_reservations FOR ALL USING (organization_id = get_current_org_id());
-- 3. Create production_order_steps (Work Orders - RF4)
-- This represents the "Work Order" for a specific machine/step
CREATE TABLE IF NOT EXISTS public.production_order_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT get_current_org_id(),
    production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
    step_id UUID REFERENCES public.route_steps(id),
    -- Link to original route step definition
    machine_id UUID REFERENCES public.machines(id),
    -- Specific machine allocated
    operator_id BIGINT REFERENCES public.operators(id),
    -- Operator assigned
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        status IN (
            'PENDING',
            'READY',
            'IN_PROGRESS',
            'PAUSED',
            'COMPLETED',
            'CANCELLED'
        )
    ),
    qty_planned NUMERIC(15, 4) NOT NULL DEFAULT 0,
    qty_produced NUMERIC(15, 4) DEFAULT 0,
    qty_rejected NUMERIC(15, 4) DEFAULT 0,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- RLS for production_order_steps
ALTER TABLE public.production_order_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolation for production_order_steps" ON public.production_order_steps FOR ALL USING (organization_id = get_current_org_id());
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reservations_op ON public.material_reservations(production_order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_material ON public.material_reservations(material_id);
CREATE INDEX IF NOT EXISTS idx_steps_op ON public.production_order_steps(production_order_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON public.production_order_steps(status);