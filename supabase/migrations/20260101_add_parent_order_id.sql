-- Adiciona suporte a OPs filhas (MRP Multi-nível)
ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS parent_order_id TEXT,
    -- Referência à OP Pai (Auto-relacionamento)
ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;
-- 0=Top, 1=Child, etc.
-- Index para performance em queries recursivas
CREATE INDEX IF NOT EXISTS idx_op_parent ON public.production_orders(parent_order_id);
-- Opcional: FK constraint se o ID for compatível (Assumindo TEXT baseado no histórico)
-- Se production_orders.id for UUID, e parent_order_id for TEXT, o cast pode falhar se tentarmos criar FK direta.
-- Mas como definimos ID como UUID-string no client, TEXT deve funcionar.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_production_orders_parent'
) THEN
ALTER TABLE public.production_orders
ADD CONSTRAINT fk_production_orders_parent FOREIGN KEY (parent_order_id) REFERENCES public.production_orders(id) ON DELETE CASCADE;
END IF;
END $$;