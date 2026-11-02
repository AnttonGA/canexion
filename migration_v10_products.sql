-- migration_v10_products.sql — Catálogo de productos (Fase 0, plan 2027)
-- Mapea cada artículo de Wakyma con sus atributos, para los avisos de
-- desparasitación y reposición. La clave wk_service_id es el id del producto en
-- Wakyma, que coincide con el service.id que aparece en las líneas de venta.
-- Ejecutar en Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS public.products (
  wk_service_id   TEXT PRIMARY KEY,
  name            TEXT NOT NULL DEFAULT '',
  type            TEXT DEFAULT 'otro',   -- pienso | antiparasitario | arena | otro
  species         TEXT DEFAULT '',       -- perro | gato | ambos | ''
  sack_kg         NUMERIC,               -- kg del saco (pienso/arena)
  protection_days INTEGER,               -- días de protección por unidad (antiparasitario)
  units_per_pack  INTEGER,               -- unidades por envase (antiparasitario)
  active          BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Solo el personal autenticado accede (mismo patrón que el resto tras el blindaje).
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
