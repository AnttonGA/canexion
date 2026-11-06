-- migration_v20_settings.sql — Ajustes del CRM (clave/valor), compartidos por el equipo.
-- Primer uso: interruptores por fase (qué tipos de aviso están activos en "Hoy").
-- Más adelante: umbrales, antelaciones, tope mensual, etc. Ejecutar en Supabase.

CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
