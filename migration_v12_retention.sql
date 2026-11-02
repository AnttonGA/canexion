-- migration_v12_retention.sql — Estados de socio (Fase 0 / Fase 1, plan 2027)
-- Añade a clients el estado de retención (activo|riesgo|inactivo|sin_datos) y las
-- fechas/intervalo que lo sustentan. Lo calcula a diario sync-stats-background.js
-- (con service_role) a partir de las ventas de Wakyma. Ejecutar en Supabase → SQL Editor.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS retention_status    TEXT;          -- activo | riesgo | inactivo | sin_datos
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS retention_status_at TIMESTAMPTZ;   -- cuándo se calculó por última vez
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_activity       DATE;          -- última compra/visita (cualquier categoría)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS buy_interval_days   INTEGER;       -- intervalo habitual de compra en tienda (mediana), null si <2 compras

CREATE INDEX IF NOT EXISTS idx_clients_retention ON public.clients (retention_status);

-- No hacen falta políticas nuevas: clients ya tiene RLS del blindaje (el personal
-- autenticado lee/escribe; la función de sync usa service_role e ignora RLS).
