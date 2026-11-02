-- migration_v15_templates.sql — Plantillas de mensajes editables (Fase 1).
-- Guarda el texto de cada tipo de aviso por idioma. El CRM usa estos textos si existen;
-- si no, cae a los textos por defecto del código. Variables: {nombre} {producto} {mascota}
-- {cupon} {fecha} {anios}. La edita el personal desde "Hoy → Plantillas". Ejecutar en Supabase.

CREATE TABLE IF NOT EXISTS public.templates (
  type        TEXT NOT NULL,                 -- deworm | recovery | expiry | anniversary | birthday | new
  language    TEXT NOT NULL,                 -- es | eu
  text        TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (type, language)
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON public.templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
