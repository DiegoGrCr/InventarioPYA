-- Nueva sección de catálogo "Cenefas", con los mismos campos que un Piso/
-- Malla (marca, medida, SKU, piezas/caja, m²/caja, precio/m², acabado,
-- color, stock por bodega, imagen, descripción) salvo `material` (cerámica/
-- porcelana no aplica a una cenefa). Tabla separada, mismo patrón que
-- meshes/bano_products/accessories: no toca ni arriesga products/Pisos.

CREATE TABLE cenefas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  size_id UUID REFERENCES sizes(id) ON DELETE SET NULL,
  sku TEXT UNIQUE,
  image_url TEXT,
  finish TEXT,
  color TEXT,
  stock INTEGER DEFAULT 0,
  sale_unit TEXT NOT NULL DEFAULT 'caja' CHECK (sale_unit IN ('caja', 'pieza')),
  pieces_per_box INTEGER,
  sqm_per_box NUMERIC(5,2),
  price_per_sqm NUMERIC(10,2),
  price_per_box NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cenefas_brand ON cenefas(brand_id);
CREATE INDEX idx_cenefas_size ON cenefas(size_id);
CREATE INDEX idx_cenefas_active ON cenefas(is_active);

-- Stock por bodega, mismo patrón que product_bodega_stock/mesh_bodega_stock.
-- cenefas.stock se mantiene como el TOTAL, recalculado por la app.
CREATE TABLE cenefa_bodega_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cenefa_id UUID NOT NULL REFERENCES cenefas(id) ON DELETE CASCADE,
  bodega TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cenefa_id, bodega)
);

CREATE INDEX idx_cenefa_bodega_stock_cenefa ON cenefa_bodega_stock(cenefa_id);

ALTER TABLE cenefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cenefa_bodega_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on cenefas" ON cenefas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on cenefa_bodega_stock" ON cenefa_bodega_stock FOR ALL USING (true) WITH CHECK (true);

-- Reutiliza la función update_updated_at_column() creada junto con products/accessories.
CREATE TRIGGER update_cenefas_updated_at
    BEFORE UPDATE ON cenefas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
