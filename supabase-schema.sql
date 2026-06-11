-- =============================================
-- SCHEMA: Sistema de Inventario de Pisos
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: brands (Marcas)
-- =============================================
CREATE TABLE brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_imported BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial brands
INSERT INTO brands (name, is_imported) VALUES 
  ('Daltile', false),
  ('Porcelanite', false),
  ('Cesantoni', false),
  ('Interceramic', false),
  ('Tecnopiso', false),
  ('Vitromex', false),
  ('Importado', true);

-- =============================================
-- TABLE: sizes (Medidas)
-- =============================================
CREATE TABLE sizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  label TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial sizes
INSERT INTO sizes (width, height, label) VALUES 
  (20, 20, '20x20'),
  (37, 37, '37x37'),
  (40, 40, '40x40'),
  (20, 60, '20x60'),
  (30, 60, '30x60'),
  (60, 60, '60x60'),
  (20, 120, '20x120'),
  (60, 120, '60x120');

-- =============================================
-- TABLE: products (Pisos)
-- =============================================
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  material TEXT NOT NULL CHECK (material IN ('ceramica', 'porcelana')),
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  size_id UUID REFERENCES sizes(id) ON DELETE SET NULL,
  sku TEXT UNIQUE,
  image_url TEXT,
  finish TEXT,
  color TEXT,
  stock INTEGER DEFAULT 0,
  -- Unidad en la que se vende y se controla el stock. Para 'pieza',
  -- pieces_per_box no aplica y sqm_per_box/price_per_box representan
  -- m² y precio de UNA pieza (ej. azulejos grandes vendidos sueltos).
  sale_unit TEXT NOT NULL DEFAULT 'caja' CHECK (sale_unit IN ('caja', 'pieza')),
  pieces_per_box INTEGER,
  sqm_per_box NUMERIC(5,2),
  price_per_box NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_size ON products(size_id);
CREATE INDEX idx_products_material ON products(material);
CREATE INDEX idx_products_active ON products(is_active);

-- =============================================
-- TABLE: accessories (Adhesivos y Boquillas)
-- =============================================
CREATE TABLE accessories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('adhesivo', 'boquilla')),
  brand TEXT,
  weight TEXT,
  color TEXT,
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  price NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_accessories_category ON accessories(category);
CREATE INDEX idx_accessories_active ON accessories(is_active);

-- =============================================
-- FUNCTION: auto-update updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accessories_updated_at
    BEFORE UPDATE ON accessories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- RLS POLICIES (Public access, no auth)
-- =============================================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;

-- Allow all operations for everyone (no auth)
CREATE POLICY "Allow all on brands" ON brands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sizes" ON sizes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on accessories" ON accessories FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- STORAGE: Create bucket for product images
-- =============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to product images
CREATE POLICY "Public read access" ON storage.objects 
  FOR SELECT USING (bucket_id = 'product-images');

-- Allow public insert access to product images
CREATE POLICY "Public insert access" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'product-images');

-- Allow public update access to product images
CREATE POLICY "Public update access" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'product-images');

-- Allow public delete access to product images
CREATE POLICY "Public delete access" ON storage.objects 
  FOR DELETE USING (bucket_id = 'product-images');
