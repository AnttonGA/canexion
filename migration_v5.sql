-- Migration v5: columna de consentimiento de imágenes para redes sociales
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS photo_consent BOOLEAN DEFAULT false;
