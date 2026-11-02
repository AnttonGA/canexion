-- migration_v14_message_log.sql — Registro de mensajes/resultados de la lista diaria (Fase 1).
-- Cada acción sobre un aviso de "Hoy" (WhatsApp enviado, resultado marcado) deja una fila.
-- Base para: (1) tope de 2 mensajes/mes por socio, (2) no repetir un aviso ya gestionado,
-- (3) medición. La escribe/lee el personal autenticado desde el CRM. Ejecutar en Supabase.

CREATE TABLE IF NOT EXISTS public.message_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   TEXT NOT NULL,                 -- clients.id (id del CRM)
  aviso_type  TEXT,                           -- deworm | recovery | coupon | birthday | anniversary | new | campaign | invite
  result      TEXT,                           -- enviado | ya_lo_tengo | preparamelo | sin_respuesta | baja
  channel     TEXT DEFAULT 'whatsapp',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msglog_client ON public.message_log (client_id);
CREATE INDEX IF NOT EXISTS idx_msglog_date   ON public.message_log (created_at);

-- El personal autenticado lee y escribe (es su herramienta de trabajo).
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON public.message_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
