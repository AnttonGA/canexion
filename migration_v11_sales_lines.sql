-- migration_v11_sales_lines.sql — Caché de líneas de venta de socios (Fase 0, plan 2027)
-- Guarda en Supabase las líneas de venta de Wakyma de los SOCIOS (clientes con
-- wk_client_id). Base para reposición, desparasitación, estados de socio y medición.
-- La rellena la función sync-sales.js (con service_role). Ejecutar en Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS public.sales_lines (
  line_id       TEXT PRIMARY KEY,   -- id de la línea en Wakyma (details[].id)
  wk_sale_id    TEXT NOT NULL,      -- id de la venta
  wk_service_id TEXT,               -- id del producto (= products.wk_service_id)
  product_name  TEXT DEFAULT '',
  quantity      NUMERIC,
  total_price   NUMERIC,
  sale_date     DATE,
  wk_client_id  TEXT,               -- socio (siempre informado en esta caché)
  wk_pet_id     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_client  ON public.sales_lines (wk_client_id);
CREATE INDEX IF NOT EXISTS idx_sl_service ON public.sales_lines (wk_service_id);
CREATE INDEX IF NOT EXISTS idx_sl_date    ON public.sales_lines (sale_date);

-- El personal autenticado puede LEER (para los cálculos del CRM). La escritura la
-- hace la función de sync con service_role (ignora RLS), así que no necesita política.
ALTER TABLE public.sales_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read" ON public.sales_lines FOR SELECT TO authenticated USING (true);
