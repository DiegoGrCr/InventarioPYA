-- Permite que un piso tenga cantidades distintas en distintas bodegas.
-- La columna vieja products.bodegas (solo etiquetas, sin cantidad) se deja
-- intacta sin usar, por si se necesita revertir. products.stock se sigue
-- usando como el TOTAL, mantenido automáticamente por la app (suma de todas
-- las filas de esta tabla para ese producto).

CREATE TABLE product_bodega_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bodega TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, bodega)
);

CREATE INDEX idx_product_bodega_stock_product ON product_bodega_stock(product_id);

ALTER TABLE product_bodega_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on product_bodega_stock" ON product_bodega_stock FOR ALL USING (true) WITH CHECK (true);

-- Migra los productos que hoy tienen exactamente 1 bodega asignada:
-- su única bodega + el stock total que ya tenían.
INSERT INTO product_bodega_stock (product_id, bodega, stock)
SELECT id, bodegas[1], stock FROM products
WHERE array_length(bodegas, 1) = 1 AND is_active = true;
