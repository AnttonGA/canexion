-- migration_v19_reconcile.sql — Reconciliación aviso → compra (Fase 1/medición).
-- El job reconcile.js cruza cada aviso de message_log con las compras del socio en los
-- 14 días siguientes (desde sales_lines) y marca aquí el resultado. Base para los KPIs
-- "compra a 14 días" y "socios recuperados" del panel de medición. Ejecutar en Supabase.

ALTER TABLE public.message_log ADD COLUMN IF NOT EXISTS purchased_14d BOOLEAN;     -- compró en los 14 días tras el aviso
ALTER TABLE public.message_log ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ; -- cuándo se cerró la ventana (null = pendiente)

CREATE INDEX IF NOT EXISTS idx_msglog_reconciled ON public.message_log (reconciled_at);
