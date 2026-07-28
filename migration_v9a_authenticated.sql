-- migration_v9a_authenticated.sql
-- ADITIVO Y SEGURO EN PRODUCCIÓN: solo AÑADE acceso para el rol 'authenticated'
-- (el personal que inicia sesión con Supabase Auth). NO elimina nada, así que
-- producción sigue funcionando igual con las políticas anon_all actuales.
-- Ejecutar en Supabase → SQL Editor ANTES de probar la preview del CRM con Auth.
--
-- ⚠️  Antes de ejecutar: confirma en Supabase (Table Editor) que estas son TODAS
--     las tablas con datos. Si hay alguna más, añádela aquí; si alguna no existe,
--     quita su línea (si no, CREATE POLICY dará error en esa tabla).

CREATE POLICY "staff_all" ON clients           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_all" ON campaigns         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_all" ON benefit_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_all" ON discovery_coupons FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_all" ON wk_invites        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_all" ON deworm_alerts     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_all" ON deworm_keywords   FOR ALL TO authenticated USING (true) WITH CHECK (true);
