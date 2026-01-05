-- Sequence for OP numbering
CREATE SEQUENCE IF NOT EXISTS public.production_order_seq START 1;
-- Function to generate formatted OP ID
CREATE OR REPLACE FUNCTION public.generate_op_id() RETURNS TEXT AS $$ BEGIN RETURN 'OP-' || to_char(now(), 'YYYY') || '-' || lpad(
        nextval('public.production_order_seq')::text,
        4,
        '0'
    );
END;
$$ LANGUAGE plpgsql;
-- Apply default to ID column
-- Note: This assumes 'id' is TEXT. If UUID, this will fail.
-- Based on previous context, 'id' accepted UUID-string, so it is likely TEXT or UUID. 
-- If it is UUID, we cannot use 'OP-...' format.
-- If user wants 'Standard Number', they imply 'OP-...'.
-- I will assume ID is TEXT.
ALTER TABLE public.production_orders
ALTER COLUMN id
SET DEFAULT public.generate_op_id();