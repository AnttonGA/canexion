-- migration_v9b_lockdown.sql
-- CIERRE FINAL — AFECTA A PRODUCCIÓN. Ejecutar el ÚLTIMO, SOLO cuando:
--   1) migration_v9a ya está aplicado,
--   2) la preview del CRM (con Auth) está validada,
--   3) el código nuevo (Auth + service_role) ya está desplegado en producción.
-- Quita el acceso total de la clave pública (anon) y lo deja en SOLO-LECTURA de
-- las 2 tablas que necesita el formulario público de alta.

-- 1) Asegurar RLS activo en todas las tablas
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE wk_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deworm_alerts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deworm_keywords   ENABLE ROW LEVEL SECURITY;

-- 2) Eliminar las políticas permisivas para anon (acceso total con la clave pública)
DROP POLICY IF EXISTS "anon_all"          ON clients;
DROP POLICY IF EXISTS "anon_all"          ON campaigns;
DROP POLICY IF EXISTS "anon_all"          ON benefit_templates;
DROP POLICY IF EXISTS "anon_all"          ON discovery_coupons;
DROP POLICY IF EXISTS "wk_invites_select" ON wk_invites;
DROP POLICY IF EXISTS "wk_invites_insert" ON wk_invites;
DROP POLICY IF EXISTS "wk_invites_update" ON wk_invites;
-- Si deworm_alerts / deworm_keywords tuvieran políticas para anon, elimínalas también:
-- DROP POLICY IF EXISTS "<nombre_politica>" ON deworm_alerts;
-- DROP POLICY IF EXISTS "<nombre_politica>" ON deworm_keywords;

-- 3) Acceso público mínimo: SOLO lectura de las 2 tablas del formulario de alta
CREATE POLICY "public_read_benefits" ON benefit_templates FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_coupons"  ON discovery_coupons FOR SELECT TO anon USING (true);

-- 4) Verificación (opcional): con la clave anon, esto debe devolver 0 filas / error:
--    SELECT * FROM clients LIMIT 1;
