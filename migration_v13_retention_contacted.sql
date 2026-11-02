-- migration_v13_retention_contacted.sql — Marca de "contactado" para recuperación.
-- Cuando se envía el WhatsApp de recuperación a un socio inactivo, se guarda la fecha
-- aquí para que no reaparezca en "Hoy" durante 30 días. sync-stats NO la toca.
-- Ejecutar en Supabase → SQL Editor.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS retention_contacted_at TIMESTAMPTZ;
