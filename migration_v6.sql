-- migration_v6.sql
-- Convierte los campos legacy pet / species / pet_bday en registros dentro del array pets[]
-- Ejecutar UNA SOLA VEZ en Supabase → SQL Editor
-- Afecta solo a clientes donde pets es nulo o vacío Y tienen datos en el campo pet (legacy)

UPDATE public.clients
SET pets = jsonb_build_array(
  jsonb_build_object(
    'name',    COALESCE(pet,     ''),
    'species', COALESCE(species, ''),
    'pet_bday', CASE WHEN pet_bday IS NOT NULL THEN to_char(pet_bday, 'YYYY-MM-DD') ELSE NULL END
  )
)
WHERE
  (pets IS NULL OR pets = '[]'::jsonb OR jsonb_array_length(pets) = 0)
  AND pet IS NOT NULL
  AND pet <> '';

-- Verificar resultado:
-- SELECT id, name, pet, species, pet_bday, pets FROM public.clients WHERE pet IS NOT NULL AND pet <> '' LIMIT 20;
