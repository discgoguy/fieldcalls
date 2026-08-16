-- Move the CRM row-level security from ('admin','technician') to ('admin','sales').
-- The CRM section is a sales surface: nav + the RequirePageAccess route guard gate
-- it to admin/sales, but until now the RLS still granted technician (and NOT sales)
-- access to the crm_* data — so a `sales` user passed the client guard and was then
-- rejected by Postgres. This makes the DB boundary match the UI: admin + sales in,
-- technician out.
--
-- Covers all 10 crm_* tables plus the crm-attachments storage policy.

DROP POLICY IF EXISTS "Staff can manage crm_companies" ON crm_companies;
CREATE POLICY "Staff can manage crm_companies" ON crm_companies FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm_contacts" ON crm_contacts;
CREATE POLICY "Staff can manage crm_contacts" ON crm_contacts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm_pipeline_stages" ON crm_pipeline_stages;
CREATE POLICY "Staff can manage crm_pipeline_stages" ON crm_pipeline_stages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm_sources" ON crm_sources;
CREATE POLICY "Staff can manage crm_sources" ON crm_sources FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm_campaigns" ON crm_campaigns;
CREATE POLICY "Staff can manage crm_campaigns" ON crm_campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm_deals" ON crm_deals;
CREATE POLICY "Staff can manage crm_deals" ON crm_deals FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm_leads" ON crm_leads;
CREATE POLICY "Staff can manage crm_leads" ON crm_leads FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm_activities" ON crm_activities;
CREATE POLICY "Staff can manage crm_activities" ON crm_activities FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm_deal_stage_history" ON crm_deal_stage_history;
CREATE POLICY "Staff can manage crm_deal_stage_history" ON crm_deal_stage_history FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm_attachments" ON crm_attachments;
CREATE POLICY "Staff can manage crm_attachments" ON crm_attachments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

DROP POLICY IF EXISTS "Staff can manage crm-attachments" ON storage.objects;
CREATE POLICY "Staff can manage crm-attachments"
  ON storage.objects FOR ALL
  USING (bucket_id = 'crm-attachments' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales')))
  WITH CHECK (bucket_id = 'crm-attachments' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales')));
