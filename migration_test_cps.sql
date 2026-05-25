-- DATOS DE PRUEBA: asignar CPs de Gipuzkoa a clientes sin código postal
-- ⚠️  Solo para testing del mapa — no ejecutar en producción con datos reales
-- Ejecutar en Supabase SQL Editor

UPDATE public.clients
SET postal_code = CASE ((RANDOM() * 13)::int)
  WHEN 0  THEN '20001'  -- Donostia-San Sebastián centro
  WHEN 1  THEN '20011'  -- Donostia-San Sebastián Amara
  WHEN 2  THEN '20100'  -- Errenteria
  WHEN 3  THEN '20120'  -- Hernani
  WHEN 4  THEN '20140'  -- Andoain
  WHEN 5  THEN '20160'  -- Lasarte-Oria
  WHEN 6  THEN '20200'  -- Beasain
  WHEN 7  THEN '20250'  -- Arrasate / Mondragón
  WHEN 8  THEN '20270'  -- Bergara
  WHEN 9  THEN '20280'  -- Hondarribia
  WHEN 10 THEN '20300'  -- Irun
  WHEN 11 THEN '20400'  -- Tolosa
  WHEN 12 THEN '20600'  -- Eibar
  ELSE         '20800'  -- Zarautz
END
WHERE postal_code IS NULL OR TRIM(postal_code) = '';
