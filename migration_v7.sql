-- migration_v7.sql
-- Añade la columna wk_client_id (TEXT) a la tabla clients
-- Necesaria para que register.js y syncFromWakyma() puedan guardar el ID de Wakyma
-- Ejecutar UNA SOLA VEZ en Supabase → SQL Editor

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS wk_client_id TEXT DEFAULT NULL;

-- Índice opcional para búsquedas rápidas por wk_client_id
CREATE INDEX IF NOT EXISTS idx_clients_wk_client_id
  ON public.clients (wk_client_id)
  WHERE wk_client_id IS NOT NULL;

-- Verificar resultado:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'clients' AND column_name = 'wk_client_id';
