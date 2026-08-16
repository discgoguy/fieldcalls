CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS crm_companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  website TEXT,
  industry TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  country TEXT,
  size TEXT,
  notes TEXT,
  owner_id UUID REFERENCES profiles(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage crm_companies" ON crm_companies;
CREATE POLICY "Staff can manage crm_companies" ON crm_companies FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

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
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

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
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_pipeline_stages_name_key ON crm_pipeline_stages (name);
INSERT INTO crm_pipeline_stages (name, sort_order, is_won, is_lost) VALUES
  ('New',         1, false, false),
  ('Qualified',   2, false, false),
  ('Proposal',    3, false, false),
  ('Negotiation', 4, false, false),
  ('Won',         5, true,  false),
  ('Lost',        6, false, true)
ON CONFLICT (name) DO NOTHING;

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
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

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
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  company_id UUID REFERENCES crm_companies(id),
  primary_contact_id UUID REFERENCES crm_contacts(id),
  stage_id UUID REFERENCES crm_pipeline_stages(id),
  lead_id UUID,
  amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  status TEXT DEFAULT 'open',
  expected_close_date DATE,
  actual_close_date DATE,
  prequote_estimate_value NUMERIC DEFAULT 0,
  margin_value NUMERIC DEFAULT 0,
  oem_or_aftermarket TEXT,
  end_user_name TEXT,
  end_user_country TEXT,
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
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  industry TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  customer_existing BOOLEAN DEFAULT false,
  customer_country TEXT,
  end_user_name TEXT,
  end_user_country TEXT,
  source TEXT,
  source_id UUID REFERENCES crm_sources(id),
  campaign_id UUID REFERENCES crm_campaigns(id),
  status TEXT DEFAULT 'new',

  reached_mql BOOLEAN DEFAULT false,
  mql_date TIMESTAMPTZ,
  reached_sql BOOLEAN DEFAULT false,
  sql_date TIMESTAMPTZ,
  final_state TEXT,
  final_state_date TIMESTAMPTZ,

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
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_lead_id_fkey;
ALTER TABLE crm_deals ADD CONSTRAINT crm_deals_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES crm_leads(id);

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT DEFAULT 'note',
  subject TEXT,
  body TEXT,
  direction TEXT,
  email_to TEXT,
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
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

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
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

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
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_sources_name_key ON crm_sources (lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS crm_campaigns_name_key ON crm_campaigns (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS crm_deal_stage_history_deal_idx ON crm_deal_stage_history (deal_id, created_date);

INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-attachments', 'crm-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff can manage crm-attachments" ON storage.objects;
CREATE POLICY "Staff can manage crm-attachments"
  ON storage.objects FOR ALL
  USING (bucket_id = 'crm-attachments' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician')))
  WITH CHECK (bucket_id = 'crm-attachments' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'technician')));

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

REVOKE ALL ON FUNCTION public.convert_lead(uuid, text, text, text, boolean, text, numeric, timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_lead(uuid, text, text, text, boolean, text, numeric, timestamptz, timestamptz, timestamptz) TO authenticated, service_role;

GRANT ALL ON crm_companies, crm_contacts, crm_pipeline_stages, crm_sources,
  crm_campaigns, crm_deals, crm_leads, crm_activities, crm_deal_stage_history,
  crm_attachments
  TO authenticated, service_role;
