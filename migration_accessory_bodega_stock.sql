-- Permite que un adhesivo/boquilla tenga cantidades distintas en distintas
-- bodegas (mismo patrón que product_bodega_stock para Pisos). Las columnas
-- viejas accessories.bodegas (solo etiquetas, sin cantidad) y accessories.stock
-- se dejan intactas sin usar activamente, por si se necesita revertir.
-- accessories.stock se sigue usando como el TOTAL, mantenido automáticamente
-- por la app (suma de todas las filas de esta tabla para ese accesorio).

CREATE TABLE accessory_bodega_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  accessory_id UUID NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
  bodega TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(accessory_id, bodega)
);

CREATE INDEX idx_accessory_bodega_stock_accessory ON accessory_bodega_stock(accessory_id);

ALTER TABLE accessory_bodega_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on accessory_bodega_stock" ON accessory_bodega_stock FOR ALL USING (true) WITH CHECK (true);

-- Sin INSERT de migración: a diferencia de Pisos, la mayoría de los adhesivos
-- ya existentes están marcados en varias bodegas a la vez con un solo total
-- repartido, así que no hay forma de derivar la cantidad real por bodega de
-- los datos actuales. La tabla queda vacía — captúrala manualmente desde el
-- formulario de "Editar" de cada adhesivo una vez corrida esta migración.
