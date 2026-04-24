-- Migration v4: columna de consentimiento de marketing
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false;
