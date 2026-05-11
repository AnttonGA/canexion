-- ============================================================
-- FAMILIA CANEXION — Supabase Schema v1
-- Ejecuta este script completo en el SQL Editor de Supabase
-- (Database → SQL Editor → New query → pegar → Run)
-- ============================================================

-- CLIENTES
CREATE TABLE IF NOT EXISTS clients (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT DEFAULT '',
  since      TEXT DEFAULT '',
  pet        TEXT DEFAULT '',
  species    TEXT DEFAULT '',
  pet_bday   TEXT DEFAULT '',
  svc        TEXT DEFAULT 'clinica',
  notes      TEXT DEFAULT '',
  benefits   JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CAMPAÑAS
CREATE TABLE IF NOT EXISTS campaigns (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  discount    TEXT DEFAULT '',
  expiry      TEXT DEFAULT '',
  conditions  JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- PLANTILLAS DE BENEFICIOS DE BIENVENIDA
-- dot_type: 'active' = punto verde (canjeable), 'always' = punto dorado (permanente)
CREATE TABLE IF NOT EXISTS benefit_templates (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  dot_type        TEXT DEFAULT 'active',
  show_in_welcome BOOLEAN DEFAULT TRUE,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- CUPONES DE DESCUBRIMIENTO (uno por tipo de servicio)
CREATE TABLE IF NOT EXISTS discovery_coupons (
  id          BIGSERIAL PRIMARY KEY,
  svc         TEXT NOT NULL UNIQUE,
  name        TEXT DEFAULT '',
  description TEXT DEFAULT '',
  discount    TEXT DEFAULT '',
  active      BOOLEAN DEFAULT TRUE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
-- La seguridad se gestiona a nivel de app (contraseña en el CRM).
-- La clave anon tiene acceso total para que el formulario público
-- pueda leer beneficios e insertar clientes sin autenticación.

ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON clients           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON campaigns         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON benefit_templates FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON discovery_coupons FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── BENEFICIOS DE BIENVENIDA POR DEFECTO ───────────────────
-- Puedes editarlos desde la pestaña "Beneficios" del CRM.

INSERT INTO benefit_templates (name, description, dot_type, show_in_welcome, order_index) VALUES
  ('Regalo de bienvenida',              'Snack o muestra física en tienda',               'active', true, 1),
  ('15% primera compra en tienda',      'Válido en toda la tienda',                       'active', true, 2),
  ('Planes de salud exclusivos',        'Acceso a planes solo disponibles para miembros', 'always', true, 3),
  ('Sorteo trimestral',                 'Participación exclusiva para miembros',           'always', true, 4),
  ('Acceso anticipado a novedades',     'Primero en conocer ofertas y productos',          'always', true, 5),
  ('Sorpresa cumpleaños de la mascota', 'Detalle especial la semana del cumpleaños',       'always', true, 6);

-- ── CUPONES DE DESCUBRIMIENTO POR DEFECTO ──────────────────
-- Puedes editarlos desde la pestaña "Beneficios" → "Cupones de descubrimiento".

INSERT INTO discovery_coupons (svc, name, description, discount, active) VALUES
  ('clinica',        'Bono descubrimiento 15% — tienda',     'Primer uso en tienda o pienso',       '15%', true),
  ('tienda',         'Bono descubrimiento 15% — clínica',    'Primera consulta veterinaria',         '15%', true),
  ('peluqueria',     'Bono descubrimiento 15% — clínica',    'Primera consulta veterinaria',         '15%', true),
  ('clinica_tienda', 'Bono descubrimiento 15% — peluquería', 'Primera sesión de peluquería canina',  '15%', true),
  ('todos',          '',                                      '',                                     '',    false);
