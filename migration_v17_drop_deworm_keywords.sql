-- migration_v17_drop_deworm_keywords.sql — Limpieza: elimina el sistema viejo de
-- desparasitación por palabras clave. Reemplazado por el catálogo de productos
-- (products type=antiparasitario con protection_days) + compute-deworm.js.
-- El CRM ya no usa esta tabla. Ejecutar en Supabase → SQL Editor.

DROP TABLE IF EXISTS public.deworm_keywords;
