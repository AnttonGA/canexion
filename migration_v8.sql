-- migration_v8.sql
-- Añade dirección y preferencia de idioma a la tabla clients
-- Ejecutar UNA SOLA VEZ en Supabase → SQL Editor

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address  TEXT    DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS language TEXT    DEFAULT 'es';

-- Verificar:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'clients' AND column_name IN ('address','language');
