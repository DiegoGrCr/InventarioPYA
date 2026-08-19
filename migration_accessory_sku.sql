-- Agrega SKU a los adhesivos/boquillas, mismo patrón que products/meshes.
-- Queda NULL para los ya existentes hasta que se capture uno desde la app.
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE;
