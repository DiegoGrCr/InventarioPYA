-- Permite marcar pisos que se venden por pieza individual en vez de por caja.
-- Para sale_unit = 'pieza': pieces_per_box no aplica, y sqm_per_box /
-- price_per_box representan los m² y el precio de UNA pieza.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_unit TEXT NOT NULL DEFAULT 'caja'
  CHECK (sale_unit IN ('caja', 'pieza'));
