-- ============================================================
-- FAMILIA CANEXION — Migration v2
-- Ejecuta este script en el SQL Editor de Supabase
-- (Database → SQL Editor → New query → pegar → Run)
-- ============================================================

-- Código postal del cliente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_code TEXT DEFAULT '';

-- Array de mascotas (JSONB)
-- Estructura: [{"name":"Luna","species":"Perro","breed":"Labrador","pet_bday":"2020-03-15"}, ...]
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pets JSONB DEFAULT '[]';

-- Contador de destinatarios en campañas
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS recipient_count INTEGER DEFAULT 0;

-- Las columnas antiguas (pet, species, pet_bday) se mantienen por retrocompatibilidad.
-- El código nuevo usará 'pets' (JSONB array).
-- La columna 'svc' sigue siendo TEXT pero almacenará un JSON array: '["clinica","tienda"]'
