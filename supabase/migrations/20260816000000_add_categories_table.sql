-- The `categories` table was referenced by the Category entity, Parts pricing
-- logic, and database.types.ts but was never created in schema.sql (documented
-- gotcha in the source repo). Creating it so parts pricing + the Categories page
-- work out of the box.
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  nonsa_markup_percentage NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view categories" ON categories;
CREATE POLICY "Authenticated users can view categories" ON categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage categories" ON categories;
CREATE POLICY "Staff can manage categories" ON categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
GRANT ALL ON categories TO authenticated, service_role;
