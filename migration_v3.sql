-- Migration v3: tabla de invitaciones Wakyma
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.wk_invites (
  id               BIGSERIAL PRIMARY KEY,
  wk_reminder_id   TEXT NOT NULL UNIQUE,
  wk_client_id     TEXT NOT NULL,
  wk_pet_id        TEXT,
  client_name      TEXT DEFAULT '',
  client_phone     TEXT DEFAULT '',
  appointment_date DATE,
  status           TEXT DEFAULT 'pending', -- pending | registered | declined
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: acceso público (mismo patrón que el resto de tablas)
ALTER TABLE public.wk_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wk_invites_select" ON public.wk_invites
  FOR SELECT USING (true);

CREATE POLICY "wk_invites_insert" ON public.wk_invites
  FOR INSERT WITH CHECK (true);

CREATE POLICY "wk_invites_update" ON public.wk_invites
  FOR UPDATE USING (true);
