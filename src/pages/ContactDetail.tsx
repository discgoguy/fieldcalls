import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CrmContact, CrmCompany, CrmDeal } from '@/api/entities';
import type { CrmContactRow, CrmCompanyRow, CrmDealRow } from '@/api/entities';
import { contactName, formatMoney } from '@/components/crm/crmUtils';
import Field from '@/components/crm/Field';
import RecordHeader from '@/components/crm/RecordHeader';
import ContactForm from '@/components/crm/ContactForm';
import DealForm from '@/components/crm/DealForm';
import ActivityTimeline from '@/components/crm/ActivityTimeline';
import AttachmentsPanel from '@/components/crm/AttachmentsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Contact as ContactIcon, Loader2, Plus, TrendingUp, Building2 } from 'lucide-react';

export default function ContactDetailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id');
  const [contact, setContact] = useState<CrmContactRow | null>(null);
  const [company, setCompany] = useState<CrmCompanyRow | null>(null);
  const [deals, setDeals] = useState<CrmDealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const c = await CrmContact.get(id);
      setContact(c);
      const [co, d] = await Promise.all([
        c.company_id ? CrmCompany.get(c.company_id).catch(() => null) : Promise.resolve(null),
        CrmDeal.filter({ primary_contact_id: id }, '-created_date'),
      ]);
      setCompany(co);
      setDeals(d || []);
    } catch {
      setContact(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!contact) return <div className="text-center text-gray-500 py-12">Contact not found.</div>;

  return (
    <div>
      <RecordHeader icon={ContactIcon} title={contactName(contact)} subtitle={contact.title} backTo={createPageUrl('Contacts')} onEdit={() => setEditOpen(true)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Email" value={contact.email} />
              <Field label="Phone" value={contact.phone} />
              <Field label="Title" value={contact.title} />
              {company && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Company</div>
                  <button className="text-sm text-blue-600 flex items-center gap-1" onClick={() => navigate(createPageUrl('CompanyDetail') + '?id=' + company.id)}>
                    <Building2 className="h-3.5 w-3.5" />{company.name}
                  </button>
                </div>
              )}
              <Field label="Notes" value={contact.notes} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6"><AttachmentsPanel links={{ contact_id: id }} /></CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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
          <CardContent><ActivityTimeline links={{ contact_id: id }} defaultEmail={contact.email} /></CardContent>
        </Card>
      </div>

      <ContactForm open={editOpen} onOpenChange={setEditOpen} contact={contact} onSaved={load} />
      <DealForm open={dealOpen} onOpenChange={setDealOpen} defaultCompanyId={contact.company_id} defaultContactId={id} onSaved={load} />
    </div>
  );
}
