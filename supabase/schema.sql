-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('admin', 'technician', 'sales', 'customer')),
  department TEXT,
  is_customer BOOLEAN GENERATED ALWAYS AS (role = 'customer') STORED,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper: check the current user's admin status WITHOUT triggering profiles RLS.
-- SECURITY DEFINER (owner bypasses RLS) prevents the infinite recursion that
-- occurs when a profiles policy queries the profiles table directly.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON settings;
CREATE POLICY "Authenticated users can read settings" ON settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage settings" ON settings;
CREATE POLICY "Admins can manage settings" ON settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
CREATE POLICY "Authenticated users can view customers" ON customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage customers" ON customers;
CREATE POLICY "Staff can manage customers" ON customers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- MACHINE TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS machine_types (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE machine_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view machine_types" ON machine_types;
CREATE POLICY "Authenticated users can view machine_types" ON machine_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage machine_types" ON machine_types;
CREATE POLICY "Admins can manage machine_types" ON machine_types FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- MACHINES
-- ============================================================
CREATE TABLE IF NOT EXISTS machines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  serial_number TEXT,
  customer_id UUID REFERENCES customers(id),
  machine_type_id UUID REFERENCES machine_types(id),
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view machines" ON machines;
CREATE POLICY "Authenticated users can view machines" ON machines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage machines" ON machines;
CREATE POLICY "Staff can manage machines" ON machines FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- TECHNICIANS
-- ============================================================
CREATE TABLE IF NOT EXISTS technicians (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  user_id UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view technicians" ON technicians;
CREATE POLICY "Authenticated users can view technicians" ON technicians FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage technicians" ON technicians;
CREATE POLICY "Admins can manage technicians" ON technicians FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
CREATE POLICY "Authenticated users can view suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage suppliers" ON suppliers;
CREATE POLICY "Staff can manage suppliers" ON suppliers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- PARTS
-- ============================================================
CREATE TABLE IF NOT EXISTS parts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  part_name TEXT NOT NULL,
  part_number TEXT,
  description TEXT,
  quantity_in_inventory NUMERIC DEFAULT 0,
  minimum_stock NUMERIC DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  category TEXT,
  supplier_id UUID REFERENCES suppliers(id),
  is_assembly BOOLEAN DEFAULT false,
  is_pack BOOLEAN DEFAULT false,
  pack_size NUMERIC CHECK (pack_size >= 1),
  cost_per_pack NUMERIC,
  location TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view parts" ON parts;
CREATE POLICY "Authenticated users can view parts" ON parts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage parts" ON parts;
CREATE POLICY "Staff can manage parts" ON parts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- ASSEMBLY COMPONENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS assembly_components (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assembly_part_id UUID REFERENCES parts(id) ON DELETE CASCADE,
  component_part_id UUID REFERENCES parts(id),
  quantity_required NUMERIC NOT NULL DEFAULT 1,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE assembly_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view assembly_components" ON assembly_components;
CREATE POLICY "Authenticated users can view assembly_components" ON assembly_components FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage assembly_components" ON assembly_components;
CREATE POLICY "Staff can manage assembly_components" ON assembly_components FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Pending', 'Resolved', 'Closed')),
  urgency TEXT DEFAULT 'Normal' CHECK (urgency IN ('Low', 'Normal', 'High', 'Critical')),
  ticket_type TEXT,
  customer_id UUID REFERENCES customers(id),
  technician_id UUID REFERENCES technicians(id),
  machine_id UUID REFERENCES machines(id),
  last_reply_role TEXT,
  attachments JSONB DEFAULT '[]',
  created_by UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view all tickets" ON tickets;
CREATE POLICY "Staff can view all tickets" ON tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
DROP POLICY IF EXISTS "Customers can view own tickets" ON tickets;
CREATE POLICY "Customers can view own tickets" ON tickets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN customers c ON c.email = p.email
    WHERE p.id = auth.uid() AND c.id = tickets.customer_id
  )
);
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;
CREATE POLICY "Authenticated users can create tickets" ON tickets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Staff can update tickets" ON tickets;
CREATE POLICY "Staff can update tickets" ON tickets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
DROP POLICY IF EXISTS "Customers can update own tickets" ON tickets;
CREATE POLICY "Customers can update own tickets" ON tickets FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN customers c ON c.email = p.email
    WHERE p.id = auth.uid() AND c.id = tickets.customer_id
  )
);

-- ============================================================
-- TICKET NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_role TEXT CHECK (author_role IN ('technician', 'customer', 'system')),
  author_name TEXT,
  is_internal BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  created_by UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ticket_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view all ticket_notes" ON ticket_notes;
CREATE POLICY "Staff can view all ticket_notes" ON ticket_notes FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
DROP POLICY IF EXISTS "Customers can view non-internal notes on own tickets" ON ticket_notes;
CREATE POLICY "Customers can view non-internal notes on own tickets" ON ticket_notes FOR SELECT USING (
  is_internal = false AND
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN customers c ON c.id = t.customer_id
    JOIN profiles p ON p.email = c.email
    WHERE t.id = ticket_notes.ticket_id AND p.id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Authenticated users can create notes" ON ticket_notes;
CREATE POLICY "Authenticated users can create notes" ON ticket_notes FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- QUOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id),
  status TEXT DEFAULT 'Draft',
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  notes TEXT,
  valid_until DATE,
  converted_to_ticket_id UUID REFERENCES tickets(id),
  created_by UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage quotes" ON quotes;
CREATE POLICY "Staff can manage quotes" ON quotes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- QUOTE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  part_id UUID REFERENCES parts(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage quote_items" ON quote_items;
CREATE POLICY "Staff can manage quote_items" ON quote_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Received', 'Complete', 'Cancelled')),
  order_date DATE DEFAULT CURRENT_DATE,
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  payment_type TEXT,
  shipping_method TEXT,
  approved_by_user_name TEXT,
  notes TEXT,
  date_completed TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage purchase_orders" ON purchase_orders;
CREATE POLICY "Staff can manage purchase_orders" ON purchase_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- PURCHASE ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts(id),
  description TEXT,
  quantity_ordered NUMERIC DEFAULT 1,
  quantity_received NUMERIC DEFAULT 0,
  received BOOLEAN DEFAULT FALSE,
  received_date DATE,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage purchase_order_items" ON purchase_order_items;
CREATE POLICY "Staff can manage purchase_order_items" ON purchase_order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- MAINTENANCE TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  machine_type_id UUID REFERENCES machine_types(id),
  items JSONB DEFAULT '[]',
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE maintenance_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view maintenance_templates" ON maintenance_templates;
CREATE POLICY "Authenticated users can view maintenance_templates" ON maintenance_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage maintenance_templates" ON maintenance_templates;
CREATE POLICY "Staff can manage maintenance_templates" ON maintenance_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- MAINTENANCE CHECKLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_checklists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  machine_id UUID REFERENCES machines(id),
  technician_id UUID REFERENCES technicians(id),
  template_id UUID REFERENCES maintenance_templates(id),
  status TEXT DEFAULT 'Pending',
  scheduled_date DATE,
  completed_date DATE,
  notes TEXT,
  checklist_number TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE maintenance_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage maintenance_checklists" ON maintenance_checklists;
CREATE POLICY "Staff can manage maintenance_checklists" ON maintenance_checklists FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- MAINTENANCE CHECKLIST ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_checklist_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  checklist_id UUID REFERENCES maintenance_checklists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  notes TEXT,
  part_id UUID REFERENCES parts(id),
  quantity_used NUMERIC,
  sort_order INTEGER DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE maintenance_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage maintenance_checklist_items" ON maintenance_checklist_items;
CREATE POLICY "Staff can manage maintenance_checklist_items" ON maintenance_checklist_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- KNOWLEDGE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view knowledge_categories" ON knowledge_categories;
CREATE POLICY "Authenticated users can view knowledge_categories" ON knowledge_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage knowledge_categories" ON knowledge_categories;
CREATE POLICY "Admins can manage knowledge_categories" ON knowledge_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- KNOWLEDGE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT DEFAULT 'document' CHECK (item_type IN ('document', 'video', 'link')),
  file_url TEXT,
  tags TEXT[],
  is_published BOOLEAN DEFAULT true,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view published knowledge_items" ON knowledge_items;
CREATE POLICY "Authenticated users can view published knowledge_items" ON knowledge_items FOR SELECT TO authenticated USING (is_published = true);
DROP POLICY IF EXISTS "Staff can manage knowledge_items" ON knowledge_items;
CREATE POLICY "Staff can manage knowledge_items" ON knowledge_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT,
  amount NUMERIC DEFAULT 0,
  description TEXT,
  customer_id UUID REFERENCES customers(id),
  ticket_id UUID REFERENCES tickets(id),
  created_by UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage transactions" ON transactions;
CREATE POLICY "Staff can manage transactions" ON transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- BORROWED PARTS
-- ============================================================
CREATE TABLE IF NOT EXISTS borrowed_parts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  part_id UUID REFERENCES parts(id),
  customer_id UUID REFERENCES customers(id),
  quantity NUMERIC DEFAULT 1,
  borrowed_date DATE DEFAULT CURRENT_DATE,
  return_date DATE,
  returned BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE borrowed_parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage borrowed_parts" ON borrowed_parts;
CREATE POLICY "Staff can manage borrowed_parts" ON borrowed_parts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- CUSTOMER INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  part_id UUID REFERENCES parts(id),
  machine_id UUID REFERENCES machines(id),
  quantity NUMERIC DEFAULT 0,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customer_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage customer_inventory" ON customer_inventory;
CREATE POLICY "Staff can manage customer_inventory" ON customer_inventory FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- ============================================================
-- SUPABASE STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;
CREATE POLICY "Anyone can view attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

-- Private CRM bucket: confidential deal/company/contact files. Unlike the public
-- `attachments` bucket above (legacy quotes/tickets, world-readable by design),
-- this one is private and staff-only — the client reads files through short-lived
-- signed URLs (see AttachmentsPanel), matching the staff-only crm_attachments rows.
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-attachments', 'crm-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff can manage crm-attachments" ON storage.objects;
CREATE POLICY "Staff can manage crm-attachments"
  ON storage.objects FOR ALL
  USING (bucket_id = 'crm-attachments' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales')))
  WITH CHECK (bucket_id = 'crm-attachments' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales')));

-- ============================================================
-- CRM
-- ============================================================
-- CRM is built as its own set of crm_* tables, independent of the existing
-- `customers` table. crm_companies.customer_id is a nullable link kept for a
-- future migration/merge with `customers`.

-- ---- CRM COMPANIES (accounts) ----
CREATE TABLE IF NOT EXISTS crm_companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  website TEXT,
  industry TEXT,
  phone TEXT,
  address TEXT,                                  -- street line (structured parts below)
  city TEXT,
  region TEXT,                                   -- state / province
  postal_code TEXT,
  latitude DOUBLE PRECISION,                     -- geocoded coords for the CRM map
  longitude DOUBLE PRECISION,
  country TEXT,                                 -- ISO 3166-1 alpha-3 (customer country)
  size TEXT,
  notes TEXT,
  owner_id UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_companies" ON crm_companies;
CREATE POLICY "Staff can manage crm_companies" ON crm_companies FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- ---- CRM CONTACTS (people) ----
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES crm_companies(id),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  owner_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_contacts" ON crm_contacts;
CREATE POLICY "Staff can manage crm_contacts" ON crm_contacts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- ---- CRM PIPELINE STAGES (data-driven, seeded with defaults) ----
CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_pipeline_stages" ON crm_pipeline_stages;
CREATE POLICY "Staff can manage crm_pipeline_stages" ON crm_pipeline_stages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- Seed default stages (name is unique-ish for idempotency via a unique index)
CREATE UNIQUE INDEX IF NOT EXISTS crm_pipeline_stages_name_key ON crm_pipeline_stages (name);
INSERT INTO crm_pipeline_stages (name, sort_order, is_won, is_lost) VALUES
  ('New',         1, false, false),
  ('Qualified',   2, false, false),
  ('Proposal',    3, false, false),
  ('Negotiation', 4, false, false),
  ('Won',         5, true,  false),
  ('Lost',        6, false, true)
ON CONFLICT (name) DO NOTHING;

-- ---- CRM SOURCES (marketing source dimension; cost tracked at this level) ----
CREATE TABLE IF NOT EXISTS crm_sources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT,
  total_cost NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_sources" ON crm_sources;
CREATE POLICY "Staff can manage crm_sources" ON crm_sources FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- ---- CRM CAMPAIGNS (campaign dimension; rolls up to a source) ----
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  source_id UUID REFERENCES crm_sources(id),
  start_date DATE,
  end_date DATE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_campaigns" ON crm_campaigns;
CREATE POLICY "Staff can manage crm_campaigns" ON crm_campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- ---- CRM DEALS (opportunities) ----
-- lead_id FK is added via ALTER after crm_leads is defined (circular reference).
CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  company_id UUID REFERENCES crm_companies(id),
  primary_contact_id UUID REFERENCES crm_contacts(id),
  stage_id UUID REFERENCES crm_pipeline_stages(id),
  lead_id UUID,                                 -- Opportunity.Lead Key (FK added below)
  amount NUMERIC DEFAULT 0,                      -- Opportunity Value
  currency TEXT DEFAULT 'CAD',
  status TEXT DEFAULT 'open',
  expected_close_date DATE,                      -- Projected Close Date
  actual_close_date DATE,                        -- Actual Close Date (Combined = COALESCE(actual, expected))
  prequote_estimate_value NUMERIC DEFAULT 0,     -- Prequote Estimate Value
  margin_value NUMERIC DEFAULT 0,                -- Margin Value (Margin % = margin_value / amount)
  oem_or_aftermarket TEXT,                       -- OEM | Aftermarket | Both
  end_user_name TEXT,                            -- End User Name
  end_user_country TEXT,                         -- End User Country (ISO A3)
  owner_id UUID REFERENCES profiles(id),
  quote_id TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT crm_deals_oem_or_aftermarket_check
    CHECK (oem_or_aftermarket IS NULL OR oem_or_aftermarket IN ('OEM', 'Aftermarket', 'Both'))
);
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_deals" ON crm_deals;
CREATE POLICY "Staff can manage crm_deals" ON crm_deals FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- ---- CRM LEADS (unqualified prospects) ----
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,                            -- Customer Name
  industry TEXT,                                 -- backed by hardcoded INDUSTRIES list (free text)
  address TEXT,                                  -- street line (structured parts below)
  city TEXT,
  region TEXT,                                   -- state / province
  postal_code TEXT,
  latitude DOUBLE PRECISION,                     -- geocoded coords for the CRM map
  longitude DOUBLE PRECISION,
  customer_existing BOOLEAN DEFAULT false,       -- Customer Existing
  customer_country TEXT,                         -- Customer Country (ISO A3)
  end_user_name TEXT,                            -- End User
  end_user_country TEXT,                         -- End User Country (ISO A3)
  source TEXT,                                   -- legacy free-text; superseded by source_id
  source_id UUID REFERENCES crm_sources(id),     -- Source Key
  campaign_id UUID REFERENCES crm_campaigns(id), -- Campaign ID
  status TEXT DEFAULT 'new',                      -- Current Status
  -- Funnel milestones
  reached_mql BOOLEAN DEFAULT false,             -- Reached MQL
  mql_date TIMESTAMPTZ,                          -- MQL Date
  reached_sql BOOLEAN DEFAULT false,             -- Reached SQL
  sql_date TIMESTAMPTZ,                          -- SQL Date
  final_state TEXT,                              -- Final State (qualification|dq|nurture)
  final_state_date TIMESTAMPTZ,                  -- Final State Date
  -- Process milestone timestamps; the "Duration in Days" measures are day-diffs
  -- between these, computed in the BI layer (see migration for the exact map).
  data_loaded_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  assigned_to_sales_at TIMESTAMPTZ,
  first_contact_at TIMESTAMPTZ,
  owner_id UUID REFERENCES profiles(id),
  notes TEXT,
  converted_contact_id UUID REFERENCES crm_contacts(id),
  converted_company_id UUID REFERENCES crm_companies(id),
  converted_deal_id UUID REFERENCES crm_deals(id),
  converted_at TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_leads" ON crm_leads;
CREATE POLICY "Staff can manage crm_leads" ON crm_leads FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- Deferred FK: crm_deals.lead_id -> crm_leads.id (crm_deals is defined above crm_leads)
ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_lead_id_fkey;
ALTER TABLE crm_deals ADD CONSTRAINT crm_deals_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES crm_leads(id);

-- ---- CRM ACTIVITIES (timeline: notes, calls, meetings, tasks, emails) ----
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT DEFAULT 'note',
  subject TEXT,
  body TEXT,
  direction TEXT,                                -- email: 'outbound' | 'inbound'
  email_to TEXT,                                 -- email: recipient address
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  company_id UUID REFERENCES crm_companies(id),
  contact_id UUID REFERENCES crm_contacts(id),
  deal_id UUID REFERENCES crm_deals(id),
  lead_id UUID REFERENCES crm_leads(id),
  owner_id UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_activities" ON crm_activities;
CREATE POLICY "Staff can manage crm_activities" ON crm_activities FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- ---- CRM DEAL STAGE HISTORY (time-in-stage tracking) ----
-- One row per stage transition; from_stage_id NULL = deal created into to_stage_id.
CREATE TABLE IF NOT EXISTS crm_deal_stage_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE NOT NULL,
  from_stage_id UUID REFERENCES crm_pipeline_stages(id),
  to_stage_id UUID REFERENCES crm_pipeline_stages(id) NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_deal_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_deal_stage_history" ON crm_deal_stage_history;
CREATE POLICY "Staff can manage crm_deal_stage_history" ON crm_deal_stage_history FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- ---- CRM ATTACHMENTS (files; source upload now, sharepoint later) ----
CREATE TABLE IF NOT EXISTS crm_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  file_name TEXT,
  storage_path TEXT,
  file_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  source TEXT DEFAULT 'upload',
  external_id TEXT,
  company_id UUID REFERENCES crm_companies(id),
  contact_id UUID REFERENCES crm_contacts(id),
  deal_id UUID REFERENCES crm_deals(id),
  lead_id UUID REFERENCES crm_leads(id),
  uploaded_by UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_attachments" ON crm_attachments;
CREATE POLICY "Staff can manage crm_attachments" ON crm_attachments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- ---- CRM indexes ----
-- Dimension names are unique (case/whitespace-insensitive) so ensureSource/
-- ensureCampaign can't create duplicates that fragment attribution/spend.
CREATE UNIQUE INDEX IF NOT EXISTS crm_sources_name_key ON crm_sources (lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS crm_campaigns_name_key ON crm_campaigns (lower(btrim(name)));
-- Time-in-stage read path.
CREATE INDEX IF NOT EXISTS crm_deal_stage_history_deal_idx ON crm_deal_stage_history (deal_id, created_date);

-- ---- convert_lead(): atomic lead -> company/contact/deal conversion ----
-- One transaction so a partial failure can't orphan records or duplicate on
-- retry. SECURITY INVOKER: the caller's staff RLS still applies. Milestone
-- timestamps are computed client-side and passed in (single source of truth).
CREATE OR REPLACE FUNCTION public.convert_lead(
  p_lead_id uuid,
  p_company_name text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_create_deal boolean DEFAULT false,
  p_deal_name text DEFAULT NULL,
  p_deal_amount numeric DEFAULT 0,
  p_acknowledged_at timestamptz DEFAULT NULL,
  p_assigned_to_sales_at timestamptz DEFAULT NULL,
  p_first_contact_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lead crm_leads%ROWTYPE;
  v_company_id uuid;
  v_contact_id uuid;
  v_deal_id uuid;
  v_stage crm_pipeline_stages%ROWTYPE;
BEGIN
  SELECT * INTO v_lead FROM crm_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % not found', p_lead_id;
  END IF;

  IF p_company_name IS NOT NULL AND btrim(p_company_name) <> '' THEN
    INSERT INTO crm_companies (name, owner_id)
    VALUES (btrim(p_company_name), v_uid)
    RETURNING id INTO v_company_id;
  END IF;

  INSERT INTO crm_contacts (first_name, last_name, email, phone, company_id, owner_id)
  VALUES (p_first_name, p_last_name, v_lead.email, v_lead.phone, v_company_id, v_uid)
  RETURNING id INTO v_contact_id;

  IF p_create_deal THEN
    SELECT * INTO v_stage FROM crm_pipeline_stages ORDER BY sort_order LIMIT 1;
    INSERT INTO crm_deals (name, company_id, primary_contact_id, stage_id, lead_id, amount, status, owner_id)
    VALUES (
      COALESCE(NULLIF(btrim(p_deal_name), ''), 'New deal'),
      v_company_id, v_contact_id, v_stage.id, p_lead_id, COALESCE(p_deal_amount, 0),
      CASE WHEN v_stage.is_won THEN 'won' WHEN v_stage.is_lost THEN 'lost' ELSE 'open' END,
      v_uid
    )
    RETURNING id INTO v_deal_id;

    IF v_stage.id IS NOT NULL THEN
      INSERT INTO crm_deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by)
      VALUES (v_deal_id, NULL, v_stage.id, v_uid);
    END IF;
  END IF;

  UPDATE crm_leads SET
    status = 'qualified',
    converted_company_id = v_company_id,
    converted_contact_id = v_contact_id,
    converted_deal_id = v_deal_id,
    converted_at = now(),
    acknowledged_at = COALESCE(acknowledged_at, p_acknowledged_at),
    assigned_to_sales_at = COALESCE(assigned_to_sales_at, p_assigned_to_sales_at),
    first_contact_at = COALESCE(first_contact_at, p_first_contact_at),
    updated_date = now()
  WHERE id = p_lead_id;

  RETURN jsonb_build_object('company_id', v_company_id, 'contact_id', v_contact_id, 'deal_id', v_deal_id);
END;
$$;
-- EXECUTE defaults to PUBLIC; revoke it so only staff (authenticated) can convert.
REVOKE ALL ON FUNCTION public.convert_lead(uuid, text, text, text, boolean, text, numeric, timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_lead(uuid, text, text, text, boolean, text, numeric, timestamptz, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================================
-- CATEGORIES
-- Referenced by the Category entity, Parts pricing logic (below), and
-- database.types.ts, but historically missing from this file (see conventions.md).
-- ============================================================
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

-- ============================================================
-- PART PRICING (cost / sales_price / nonsa_price), computed in the DB so it
-- can't drift from the app's forms, bulk import, or direct edits, and cascades
-- automatically when the global USD/CAD exchange rate or a category's NonSA
-- markup changes. Mirrors the formulas in src/pages/Parts.jsx.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_part_pricing()
RETURNS TRIGGER AS $$
DECLARE
  v_is_usd       boolean;
  v_exchange_rate numeric;
  v_nonsa_markup numeric;
BEGIN
  SELECT is_usd INTO v_is_usd
  FROM suppliers
  WHERE name = NEW.supplier
  LIMIT 1;

  SELECT value::numeric INTO v_exchange_rate
  FROM settings
  WHERE key = 'usd_cad_exchange_rate'
  LIMIT 1;
  v_exchange_rate := COALESCE(v_exchange_rate, 1);

  IF NOT COALESCE(NEW.is_assembly, false) THEN

    IF COALESCE(NEW.is_pack, false) THEN
      IF NEW.cost_per_pack IS NOT NULL AND NEW.pack_size IS NOT NULL AND NEW.pack_size > 0 THEN
        NEW.cost := round(
          (CASE WHEN v_is_usd THEN (NEW.cost_per_pack * v_exchange_rate) ELSE NEW.cost_per_pack END
           / NEW.pack_size)::numeric, 4);
      END IF;
    ELSE
      IF v_is_usd AND NEW.cost_usd IS NOT NULL THEN
        NEW.cost := round((NEW.cost_usd * v_exchange_rate)::numeric, 4);
      END IF;
    END IF;

    IF NEW.cost IS NOT NULL AND NEW.markup_percentage IS NOT NULL THEN
      NEW.sales_price := round((NEW.cost * (1 + NEW.markup_percentage / 100))::numeric, 2);
    END IF;

  END IF;

  IF NEW.sales_price IS NOT NULL THEN
    SELECT nonsa_markup_percentage INTO v_nonsa_markup
    FROM categories
    WHERE name = NEW.category
    LIMIT 1;

    NEW.nonsa_price := round((NEW.sales_price * (1 + COALESCE(v_nonsa_markup, 0) / 100))::numeric, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_part_pricing ON parts;
CREATE TRIGGER trg_calculate_part_pricing
  BEFORE INSERT OR UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_part_pricing();

CREATE OR REPLACE FUNCTION cascade_exchange_rate_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.key = 'usd_cad_exchange_rate' AND (OLD.value IS DISTINCT FROM NEW.value) THEN
    UPDATE parts
    SET cost = cost
    WHERE is_assembly IS NOT TRUE
      AND supplier IN (SELECT name FROM suppliers WHERE is_usd = true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_exchange_rate ON settings;
CREATE TRIGGER trg_cascade_exchange_rate
  AFTER UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION cascade_exchange_rate_change();

CREATE OR REPLACE FUNCTION cascade_category_markup_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.nonsa_markup_percentage IS DISTINCT FROM NEW.nonsa_markup_percentage THEN
    UPDATE parts
    SET cost = cost
    WHERE category = NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_category_markup ON categories;
CREATE TRIGGER trg_cascade_category_markup
  AFTER UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION cascade_category_markup_change();

CREATE OR REPLACE FUNCTION cascade_supplier_currency_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_usd IS DISTINCT FROM NEW.is_usd THEN
    UPDATE parts
    SET cost = cost
    WHERE supplier = NEW.name
      AND is_assembly IS NOT TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_supplier_currency ON suppliers;
CREATE TRIGGER trg_cascade_supplier_currency
  AFTER UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION cascade_supplier_currency_change();

-- ============================================================
-- API ROLE GRANTS
-- Table privileges for Supabase's API roles. Row-level access is still
-- governed by the RLS policies above. DML is granted only to `authenticated`
-- (staff/portal users, further gated by RLS) and `service_role` (bypasses RLS).
-- The `anon` (pre-login) role deliberately gets NO table/sequence/function
-- access, so a table that ever forgets ENABLE ROW LEVEL SECURITY fails closed
-- to unauthenticated callers instead of open. Auth itself uses GoTrue, not
-- PostgREST table access, so login is unaffected.
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated, service_role;
