-- migration_v18_consent.sql — Consentimiento separado servicio/comercial (Fase 0, RGPD).
-- Separa el permiso para AVISOS DE SERVICIO (recordatorios de desparasitación, reposición,
-- salud de la mascota) del permiso COMERCIAL (campañas, promociones = marketing_consent).
-- Los avisos de servicio requieren service_consent; los comerciales, marketing_consent.
-- Socios existentes: service_consent = true por defecto (son miembros, aceptaron la
-- política de privacidad al darse de alta). El texto legal exacto lo confirma Alberto.
-- Ejecutar en Supabase → SQL Editor.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS service_consent      BOOLEAN DEFAULT true; -- avisos de servicio
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS service_consent_at   TIMESTAMPTZ;          -- cuándo lo dio
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ;          -- cuándo dio el comercial
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS how_found            TEXT;                 -- "cómo nos conociste"
