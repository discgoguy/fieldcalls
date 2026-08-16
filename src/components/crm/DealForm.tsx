import { useState, useEffect, type FormEvent } from 'react';
import { CrmDeal, CrmCompany, CrmContact, CrmPipelineStage } from '@/api/entities';
import type { CrmCompanyRow, CrmContactRow, CrmDealRow, CrmPipelineStageRow, InsertRow } from '@/api/entities';
import { getCurrentUserId, contactName, logStageChange, statusForStage, SELECT_CLASS, marginPct, makeFieldSetter, industryOptions, fetchCountryOptions } from './crmUtils';
import SuggestInput from './SuggestInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DealFormState {
  name: string | null;
  company_id: string | null;
  primary_contact_id: string | null;
  stage_id: string | null;
  amount: string | number;
  currency: string | null;
  expected_close_date: string | null;
  actual_close_date: string | null;
  prequote_estimate_value: string | number;
  margin_value: string | number;
  oem_or_aftermarket: string | null;
  end_user_name: string | null;
  end_user_country: string | null;
  notes: string | null;
}

const OEM_OPTIONS = ['OEM', 'Aftermarket', 'Both'];

interface DealFormProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called to open/close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** Edit this deal when present; create a new one otherwise. */
  deal?: CrmDealRow | null;
  /** Preselect this company when creating. */
  defaultCompanyId?: string | null;
  /** Preselect this primary contact when creating. */
  defaultContactId?: string | null;
  /** Called with the saved deal after a successful save. */
  onSaved?: (deal: CrmDealRow) => void;
}

const EMPTY: DealFormState = { name: '', company_id: '', primary_contact_id: '', stage_id: '', amount: '', currency: 'CAD', expected_close_date: '', actual_close_date: '', prequote_estimate_value: '', margin_value: '', oem_or_aftermarket: '', end_user_name: '', end_user_country: '', notes: '' };

export default function DealForm({ open, onOpenChange, deal, defaultCompanyId, defaultContactId, onSaved }: DealFormProps) {
  const [form, setForm] = useState<DealFormState>(EMPTY);
  const [companies, setCompanies] = useState<CrmCompanyRow[]>([]);
  const [contacts, setContacts] = useState<CrmContactRow[]>([]);
  const [stages, setStages] = useState<CrmPipelineStageRow[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(deal ? { ...EMPTY, ...deal, amount: deal.amount ?? '', expected_close_date: deal.expected_close_date || '',
                     actual_close_date: deal.actual_close_date || '', prequote_estimate_value: deal.prequote_estimate_value ?? '',
                     margin_value: deal.margin_value ?? '', oem_or_aftermarket: deal.oem_or_aftermarket || '' }
                  : { ...EMPTY, company_id: defaultCompanyId || '', primary_contact_id: defaultContactId || '' });
    // Seed country suggestions from this deal, then load every value in use.
    setCountries(industryOptions([deal?.end_user_country]));
    fetchCountryOptions().then((opts) => setCountries(industryOptions([...opts, deal?.end_user_country])));
    Promise.all([CrmCompany.list('name'), CrmContact.list('first_name'), CrmPipelineStage.list('sort_order')])
      .then(([co, ct, st]) => {
        setCompanies(co || []);
        setContacts(ct || []);
        setStages(st || []);
        // default to first stage for new deals
        if (!deal && st?.length) setForm((f) => ({ ...f, stage_id: f.stage_id || st[0].id }));
      })
      .catch(() => {});
  }, [open, deal, defaultCompanyId, defaultContactId]);

  const set = makeFieldSetter(form, setForm);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!form.name?.trim()) throw new Error('Deal name is required.');
      const stage = stages.find((s) => s.id === form.stage_id);
      const status = statusForStage(stage, deal?.status || 'open');
      const payload: InsertRow<'crm_deals'> = {
        name: form.name,
        company_id: form.company_id || null,
        primary_contact_id: form.primary_contact_id || null,
        stage_id: form.stage_id || null,
        amount: form.amount === '' ? 0 : Number(form.amount),
        currency: form.currency || 'CAD',
        status,
        expected_close_date: form.expected_close_date || null,
        actual_close_date: form.actual_close_date || null,
        prequote_estimate_value: form.prequote_estimate_value === '' ? 0 : Number(form.prequote_estimate_value),
        margin_value: form.margin_value === '' ? 0 : Number(form.margin_value),
        oem_or_aftermarket: form.oem_or_aftermarket || null,
        end_user_name: form.end_user_name || null,
        end_user_country: form.end_user_country || null,
        notes: form.notes,
      };
      let saved: CrmDealRow;
      if (deal?.id) {
        saved = await CrmDeal.update(deal.id, payload);
        await logStageChange(deal.id, deal.stage_id, payload.stage_id);
      } else {
        payload.owner_id = await getCurrentUserId();
        saved = await CrmDeal.create(payload);
        await logStageChange(saved.id, null, saved.stage_id);
      }
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to save deal.');
    } finally {
      setSaving(false);
    }
  };

  const visibleContacts = form.company_id ? contacts.filter((c) => c.company_id === form.company_id) : contacts;

  // Margin % = margin_value / amount (display only; derived, not stored)
  const marginPctDisplay = marginPct(form.amount, form.margin_value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deal?.id ? 'Edit Deal' : 'Add Deal'}</DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="d-name">Deal Name *</Label>
            <Input id="d-name" value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <Label htmlFor="d-company">Company</Label>
            <select id="d-company" className={SELECT_CLASS} value={form.company_id || ''} onChange={set('company_id')}>
              <option value="">(None)</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="d-contact">Primary Contact</Label>
            <select id="d-contact" className={SELECT_CLASS} value={form.primary_contact_id || ''} onChange={set('primary_contact_id')}>
              <option value="">(None)</option>
              {visibleContacts.map((c) => <option key={c.id} value={c.id}>{contactName(c)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="d-stage">Stage</Label>
              <select id="d-stage" className={SELECT_CLASS} value={form.stage_id || ''} onChange={set('stage_id')}>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="d-oem">OEM / Aftermarket</Label>
              <select id="d-oem" className={SELECT_CLASS} value={form.oem_or_aftermarket || ''} onChange={set('oem_or_aftermarket')}>
                <option value="">(None)</option>
                {OEM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="d-close">Expected Close</Label>
              <Input id="d-close" type="date" value={form.expected_close_date || ''} onChange={set('expected_close_date')} />
            </div>
            <div>
              <Label htmlFor="d-actual-close">Actual Close</Label>
              <Input id="d-actual-close" type="date" value={form.actual_close_date || ''} onChange={set('actual_close_date')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="d-amount">Amount (Opportunity Value)</Label>
              <Input id="d-amount" type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} />
            </div>
            <div>
              <Label htmlFor="d-currency">Currency</Label>
              <Input id="d-currency" value={form.currency} onChange={set('currency')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="d-prequote">Prequote Estimate</Label>
              <Input id="d-prequote" type="number" step="0.01" min="0" value={form.prequote_estimate_value} onChange={set('prequote_estimate_value')} />
            </div>
            <div>
              <Label htmlFor="d-margin">Margin Value</Label>
              <Input id="d-margin" type="number" step="0.01" value={form.margin_value} onChange={set('margin_value')} />
            </div>
            <div>
              <Label htmlFor="d-margin-pct">Margin %</Label>
              <Input id="d-margin-pct" value={marginPctDisplay} disabled readOnly />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="d-enduser">End User</Label>
              <Input id="d-enduser" value={form.end_user_name || ''} onChange={set('end_user_name')} />
            </div>
            <div>
              <Label htmlFor="d-enduser-country">End User Country</Label>
              <SuggestInput id="d-enduser-country" value={form.end_user_country || ''} onChange={(v) => setForm((f) => ({ ...f, end_user_country: v }))} options={countries} placeholder="ISO code, e.g. USA" maxLength={3} uppercase />
            </div>
          </div>
          <div>
            <Label htmlFor="d-notes">Notes</Label>
            <Textarea id="d-notes" value={form.notes} onChange={set('notes')} />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : (deal?.id ? 'Update Deal' : 'Save Deal')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
