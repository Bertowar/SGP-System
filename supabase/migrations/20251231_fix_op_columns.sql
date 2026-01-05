-- Adiciona colunas que faltam na tabela de Ordens de Produção (Cabeçalho)
ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS bom_id TEXT,
    -- ID do BOM snapshot (ou link)
ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.product_routes(id),
    ADD COLUMN IF NOT EXISTS sales_order_id UUID,
    ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';
-- Atualiza restrição de Status se necessário
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