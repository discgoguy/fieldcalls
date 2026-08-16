import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CrmLead, CrmSource, CrmCampaign } from '@/api/entities';
import type { CrmLeadRow, CrmSourceRow, CrmCampaignRow } from '@/api/entities';
import { composeAddress } from '@/components/crm/crmUtils';
import Field from '@/components/crm/Field';
import RecordHeader from '@/components/crm/RecordHeader';
import LeadForm from '@/components/crm/LeadForm';
import ConvertLeadDialog from '@/components/crm/ConvertLeadDialog';
import ActivityTimeline from '@/components/crm/ActivityTimeline';
import AttachmentsPanel from '@/components/crm/AttachmentsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Loader2, ArrowRightCircle, CheckCircle, Building2, Contact as ContactIcon, TrendingUp } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  working: 'bg-amber-100 text-amber-800',
  qualified: 'bg-green-100 text-green-800',
  disqualified: 'bg-gray-200 text-gray-700',
};

// One MQL/SQL milestone row: a check (or dash) plus the date when reached.
function Milestone({ label, reached, date }: { label: string; reached: boolean | null; date: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      {reached
        ? <span className="flex items-center gap-1.5 text-sm text-green-700"><CheckCircle className="h-4 w-4" />{date?.slice(0, 10) || 'Yes'}</span>
        : <span className="text-sm text-gray-300">—</span>}
    </div>
  );
}

export default function LeadDetailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id');
  const [lead, setLead] = useState<CrmLeadRow | null>(null);
  const [sources, setSources] = useState<CrmSourceRow[]>([]);
  const [campaigns, setCampaigns] = useState<CrmCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [l, src, camp] = await Promise.all([
        CrmLead.get(id),
        CrmSource.list('name').catch(() => []),
        CrmCampaign.list('name').catch(() => []),
      ]);
      setLead(l);
      setSources(src || []);
      setCampaigns(camp || []);
    } catch {
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!lead) return <div className="text-center text-gray-500 py-12">Lead not found.</div>;

  const campaignName = campaigns.find((c) => c.id === lead.campaign_id)?.name || null;
  const address = composeAddress({ address: lead.address, city: lead.city, region: lead.region, postal_code: lead.postal_code }) || null;
  const endUser = [lead.end_user_name, lead.end_user_country && `(${lead.end_user_country})`].filter(Boolean).join(' ') || null;
  const coords = lead.latitude != null && lead.longitude != null ? `${lead.latitude}, ${lead.longitude}` : null;
  const converted = !!lead.converted_at;

  return (
    <div>
      <RecordHeader
        icon={UserPlus}
        title={lead.name || lead.company_name || 'Unnamed lead'}
        subtitle={lead.company_name && lead.name ? lead.company_name : undefined}
        badge={lead.status ? <Badge className={STATUS_COLOR[lead.status] || ''}>{lead.status}</Badge> : undefined}
        backTo={createPageUrl('Leads')}
        onEdit={() => setEditOpen(true)}
        actions={!converted ? (
          <Button onClick={() => setConvertOpen(true)}><ArrowRightCircle className="h-4 w-4 mr-2" />Convert</Button>
        ) : undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Customer" value={lead.company_name} />
              <Field label="Industry" value={lead.industry} />
              <Field label="Address" value={address} />
              <Field label="Customer Country" value={lead.customer_country} />
              <Field label="Coordinates" value={coords} />
              <Field label="End User" value={endUser} />
              <Field label="Source" value={lead.source} />
              <Field label="Campaign" value={campaignName} />
              <Field label="Notes" value={lead.notes} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6"><AttachmentsPanel links={{ lead_id: id }} /></CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Funnel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Milestone label="Reached MQL" reached={lead.reached_mql} date={lead.mql_date} />
              <Milestone label="Reached SQL" reached={lead.reached_sql} date={lead.sql_date} />
              <Field label="Final State" value={lead.final_state} />
              <Field label="Final State Date" value={lead.final_state_date?.slice(0, 10) || null} />
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Existing customer</div>
                <div className="text-sm">{lead.customer_existing ? 'Yes' : 'No'}</div>
              </div>
            </CardContent>
          </Card>

          {converted && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center"><CheckCircle className="h-4 w-4 mr-2 text-green-600" />Converted</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {lead.converted_company_id && (
                  <button className="text-sm text-blue-600 flex items-center gap-1.5" onClick={() => navigate(createPageUrl('CompanyDetail') + '?id=' + lead.converted_company_id)}>
                    <Building2 className="h-3.5 w-3.5" />View company
                  </button>
                )}
                {lead.converted_contact_id && (
                  <button className="text-sm text-blue-600 flex items-center gap-1.5" onClick={() => navigate(createPageUrl('ContactDetail') + '?id=' + lead.converted_contact_id)}>
                    <ContactIcon className="h-3.5 w-3.5" />View contact
                  </button>
                )}
                {lead.converted_deal_id && (
                  <button className="text-sm text-blue-600 flex items-center gap-1.5" onClick={() => navigate(createPageUrl('DealDetail') + '?id=' + lead.converted_deal_id)}>
                    <TrendingUp className="h-3.5 w-3.5" />View deal
                  </button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
          <CardContent><ActivityTimeline links={{ lead_id: id }} defaultEmail={lead.email} /></CardContent>
        </Card>
      </div>

      <LeadForm open={editOpen} onOpenChange={setEditOpen} lead={lead} sources={sources} campaigns={campaigns} knownIndustries={[lead.industry]} onSaved={load} />
      <ConvertLeadDialog lead={convertOpen ? lead : null} onClose={() => setConvertOpen(false)} onConverted={load} />
    </div>
  );
}
