import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CrmCompany, CrmContact, CrmDeal } from '@/api/entities';
import type { CrmCompanyRow, CrmContactRow, CrmDealRow } from '@/api/entities';
import { contactName, formatMoney, composeAddress } from '@/components/crm/crmUtils';
import Field from '@/components/crm/Field';
import RecordHeader from '@/components/crm/RecordHeader';
import CompanyForm from '@/components/crm/CompanyForm';
import ContactForm from '@/components/crm/ContactForm';
import DealForm from '@/components/crm/DealForm';
import ActivityTimeline from '@/components/crm/ActivityTimeline';
import AttachmentsPanel from '@/components/crm/AttachmentsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Loader2, Plus, Contact as ContactIcon, TrendingUp } from 'lucide-react';

export default function CompanyDetailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id');
  const [company, setCompany] = useState<CrmCompanyRow | null>(null);
  const [contacts, setContacts] = useState<CrmContactRow[]>([]);
  const [deals, setDeals] = useState<CrmDealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [c, ct, d] = await Promise.all([
        CrmCompany.get(id),
        CrmContact.filter({ company_id: id }, 'first_name'),
        CrmDeal.filter({ company_id: id }, '-created_date'),
      ]);
      setCompany(c);
      setContacts(ct || []);
      setDeals(d || []);
    } catch {
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!company) return <div className="text-center text-gray-500 py-12">Company not found.</div>;

  const coords = company.latitude != null && company.longitude != null ? `${company.latitude}, ${company.longitude}` : null;

  return (
    <div>
      <RecordHeader icon={Building2} title={company.name} subtitle={company.industry} backTo={createPageUrl('Companies')} onEdit={() => setEditOpen(true)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Industry" value={company.industry} />
              <Field label="Website" value={company.website} />
              <Field label="Domain" value={company.domain} />
              <Field label="Phone" value={company.phone} />
              <Field label="Size" value={company.size} />
              <Field label="Address" value={composeAddress({ ...company, country: null }) || null} />
              <Field label="Country" value={company.country} />
              <Field label="Coordinates" value={coords} />
              <Field label="Notes" value={company.notes} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6"><AttachmentsPanel links={{ company_id: id }} /></CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center"><ContactIcon className="h-4 w-4 mr-2" />Contacts</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setContactOpen(true)}><Plus className="h-4 w-4 mr-1" />Add</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {contacts.length === 0 ? <p className="text-sm text-gray-400 italic">No contacts.</p> :
                contacts.map((c) => (
                  <div key={c.id} className="p-2 border rounded-md hover:bg-gray-50 cursor-pointer" onClick={() => navigate(createPageUrl('ContactDetail') + '?id=' + c.id)}>
                    <div className="text-sm font-medium">{contactName(c)}</div>
                    <div className="text-xs text-gray-500">{c.title || c.email}</div>
                  </div>
                ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center"><TrendingUp className="h-4 w-4 mr-2" />Deals</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDealOpen(true)}><Plus className="h-4 w-4 mr-1" />Add</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {deals.length === 0 ? <p className="text-sm text-gray-400 italic">No deals.</p> :
                deals.map((d) => (
                  <div key={d.id} className="p-2 border rounded-md hover:bg-gray-50 cursor-pointer flex justify-between" onClick={() => navigate(createPageUrl('DealDetail') + '?id=' + d.id)}>
                    <span className="text-sm font-medium">{d.name}</span>
                    <span className="text-sm text-green-700">{formatMoney(d.amount, d.currency)}</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
          <CardContent><ActivityTimeline links={{ company_id: id }} /></CardContent>
        </Card>
      </div>

      <CompanyForm open={editOpen} onOpenChange={setEditOpen} company={company} onSaved={load} />
      <ContactForm open={contactOpen} onOpenChange={setContactOpen} defaultCompanyId={id} onSaved={load} />
      <DealForm open={dealOpen} onOpenChange={setDealOpen} defaultCompanyId={id} onSaved={load} />
    </div>
  );
}
