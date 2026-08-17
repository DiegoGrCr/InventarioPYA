-- Nueva sección de catálogo "Mallas", con los mismos campos que un Piso
-- (marca, medida, SKU, piezas/caja, m²/caja, precio/m², acabado, color,
-- stock por bodega, imagen, descripción) salvo `material` (cerámica/
-- porcelana no aplica a una malla). Tabla separada, mismo patrón que
-- bano_products y accessories: no toca ni arriesga products/Pisos.

CREATE TABLE meshes (
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

CREATE INDEX idx_meshes_brand ON meshes(brand_id);
CREATE INDEX idx_meshes_size ON meshes(size_id);
CREATE INDEX idx_meshes_active ON meshes(is_active);

-- Stock por bodega, mismo patrón que product_bodega_stock/accessory_bodega_stock.
-- meshes.stock se mantiene como el TOTAL, recalculado por la app.
CREATE TABLE mesh_bodega_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mesh_id UUID NOT NULL REFERENCES meshes(id) ON DELETE CASCADE,
  bodega TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mesh_id, bodega)
);

CREATE INDEX idx_mesh_bodega_stock_mesh ON mesh_bodega_stock(mesh_id);

ALTER TABLE meshes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesh_bodega_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on meshes" ON meshes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on mesh_bodega_stock" ON mesh_bodega_stock FOR ALL USING (true) WITH CHECK (true);

-- Reutiliza la función update_updated_at_column() creada junto con products/accessories.
CREATE TRIGGER update_meshes_updated_at
    BEFORE UPDATE ON meshes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
