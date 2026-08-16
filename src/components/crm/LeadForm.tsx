import { useState, useEffect, type FormEvent } from 'react';
import { CrmLead } from '@/api/entities';
import type { CrmLeadRow, CrmSourceRow, CrmCampaignRow } from '@/api/entities';
import {
  getCurrentUserId, ensureSource, ensureCampaign, leadMilestoneStamps, SELECT_CLASS,
  makeFieldSetter, geocodeAddress, industryOptions, fetchIndustryOptions, fetchCountryOptions, fetchRegionOptions, composeAddress, trimText,
} from './crmUtils';
import SuggestInput from './SuggestInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, MapPin } from 'lucide-react';

export const LEAD_STATUSES = ['new', 'working', 'qualified', 'disqualified'];
const FINAL_STATES = ['qualification', 'dq', 'nurture'];

interface LeadFormState {
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  industry: string | null;
  address: string | null;     // street line
  city: string | null;
  region: string | null;      // state / province
  postal_code: string | null;
  latitude: string | null;    // held as text; converted to number on save
  longitude: string | null;
  customer_existing: boolean;
  customer_country: string | null;
  end_user_name: string | null;
  end_user_country: string | null;
  source: string | null;        // source name (resolved to source_id on save)
  campaign: string | null;      // campaign name (resolved to campaign_id on save)
  status: string | null;
  reached_mql: boolean;
  mql_date: string | null;
  reached_sql: boolean;
  sql_date: string | null;
  final_state: string | null;
  final_state_date: string | null;
  notes: string | null;
}

const EMPTY: LeadFormState = {
  name: '', email: '', phone: '', company_name: '', industry: '', address: '', city: '', region: '', postal_code: '', latitude: '', longitude: '',
  customer_existing: false, customer_country: '', end_user_name: '', end_user_country: '',
  source: '', campaign: '', status: 'new',
  reached_mql: false, mql_date: '', reached_sql: false, sql_date: '',
  final_state: '', final_state_date: '', notes: '',
};

interface LeadFormProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called to open/close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** Edit this lead when present; create a new one otherwise. */
  lead?: CrmLeadRow | null;
  /** Lead-source options for the Source select. */
  sources: CrmSourceRow[];
  /** Campaign options for the Campaign select. */
  campaigns: CrmCampaignRow[];
  /** Industry values already in use, surfaced as suggestions. */
  knownIndustries?: (string | null | undefined)[];
  /** Called after a successful save. */
  onSaved?: () => void;
}

export default function LeadForm({ open, onOpenChange, lead, sources, campaigns, knownIndustries = [], onSaved }: LeadFormProps) {
  const [form, setForm] = useState<LeadFormState>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [industries, setIndustries] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);

  const campaignName = (id: string | null | undefined) => campaigns.find((c) => c.id === id)?.name || '';

  useEffect(() => {
    if (!open) return;
    setError('');
    // Seed suggestions from what we already know, then load every value in use.
    setIndustries(industryOptions([...knownIndustries, lead?.industry]));
    fetchIndustryOptions().then((opts) => setIndustries(industryOptions([...opts, ...knownIndustries, lead?.industry])));
    setCountries(industryOptions([lead?.customer_country, lead?.end_user_country]));
    fetchCountryOptions().then((opts) => setCountries(industryOptions([...opts, lead?.customer_country, lead?.end_user_country])));
    setRegions(industryOptions([lead?.region]));
    fetchRegionOptions().then((opts) => setRegions(industryOptions([...opts, lead?.region])));
    setForm(lead
      ? {
          ...EMPTY, ...lead,
          latitude: lead.latitude?.toString() ?? '',
          longitude: lead.longitude?.toString() ?? '',
          customer_existing: !!lead.customer_existing,
          reached_mql: !!lead.reached_mql,
          reached_sql: !!lead.reached_sql,
          campaign: campaignName(lead.campaign_id),
          mql_date: lead.mql_date ? lead.mql_date.slice(0, 10) : '',
          sql_date: lead.sql_date ? lead.sql_date.slice(0, 10) : '',
          final_state_date: lead.final_state_date ? lead.final_state_date.slice(0, 10) : '',
        }
      : EMPTY);
  }, [open, lead]);

  const setF = makeFieldSetter(form, setForm);

  // Compose the lead's structured address (country = customer_country) for geocoding.
  const leadAddress = () => composeAddress({
    address: form.address, city: form.city, region: form.region,
    postal_code: form.postal_code, country: form.customer_country,
  });

  const doGeocode = async () => {
    setGeocoding(true);
    setError('');
    const hit = await geocodeAddress(leadAddress());
    if (hit) setForm((f) => ({ ...f, latitude: String(hit.lat), longitude: String(hit.lng) }));
    else setError('Could not geocode that address. Enter coordinates manually.');
    setGeocoding(false);
  };

  const saveLead = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!form.name?.trim() && !form.email?.trim()) throw new Error('Enter a name or email.');
      const source_id = await ensureSource(form.source);
      const campaign_id = await ensureCampaign(form.campaign, source_id);
      // Coordinates: manual entry wins, else auto-geocode from the address on save.
      let latitude = form.latitude ? Number(form.latitude) : null;
      let longitude = form.longitude ? Number(form.longitude) : null;
      if (latitude === null && longitude === null) {
        const hit = await geocodeAddress(leadAddress());
        if (hit) { latitude = hit.lat; longitude = hit.lng; }
      }
      const payload: Partial<CrmLeadRow> = {
        // Free text is trimmed on the way in: an invisible trailing space is a
        // distinct value to the suggestion/filter dropdowns (see trimText).
        name: trimText(form.name), email: trimText(form.email), phone: trimText(form.phone),
        company_name: trimText(form.company_name),
        industry: trimText(form.industry),
        address: trimText(form.address), city: trimText(form.city), region: trimText(form.region),
        postal_code: trimText(form.postal_code),
        latitude, longitude,
        customer_existing: form.customer_existing,
        customer_country: trimText(form.customer_country),
        end_user_name: trimText(form.end_user_name),
        end_user_country: trimText(form.end_user_country),
        source: form.source || null, source_id, campaign_id,
        status: form.status,
        reached_mql: form.reached_mql, mql_date: form.mql_date || null,
        reached_sql: form.reached_sql, sql_date: form.sql_date || null,
        final_state: form.final_state || null, final_state_date: form.final_state_date || null,
        notes: form.notes,
      };
      const now = new Date().toISOString();
      // Auto-stamp funnel process timestamps (durations feed the BI model).
      Object.assign(payload, leadMilestoneStamps(lead, form, now));
      if (lead) await CrmLead.update(lead.id, payload);
      else {
        payload.owner_id = await getCurrentUserId();
        payload.data_loaded_at = now;   // lead entered the CRM
        await CrmLead.create(payload);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError((err as Error).message || 'Failed to save lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{lead ? 'Edit Lead' : 'Add Lead'}</DialogTitle></DialogHeader>
        {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {/* -mx-1 px-1: give the scroll container horizontal room so focused
            inputs' focus ring isn't clipped by overflow, without shifting field
            alignment (overflow-y-auto also clips overflow-x). */}
        <form onSubmit={saveLead} className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto -mx-1 px-1">
          <div><Label>Name</Label><Input value={form.name} onChange={setF('name')} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={setF('email')} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={setF('phone')} /></div>
          </div>

          {/* Customer / end user */}
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Customer</Label><Input value={form.company_name} onChange={setF('company_name')} /></div>
            <div><Label>Customer Country</Label><SuggestInput value={form.customer_country || ''} onChange={(v) => setForm((f) => ({ ...f, customer_country: v }))} options={countries} placeholder="ISO, e.g. CAN" maxLength={3} uppercase /></div>
          </div>
          <div>
            <Label>Industry</Label>
            <SuggestInput value={form.industry || ''} onChange={(v) => setForm((f) => ({ ...f, industry: v }))} options={industries} placeholder="Type an industry" />
          </div>
          {/* Address (country = Customer Country above) */}
          <div className="space-y-4">
            <div><Label>Street address</Label><Input value={form.address} onChange={setF('address')} placeholder="123 Main St" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>City</Label><Input value={form.city} onChange={setF('city')} /></div>
              <div><Label>State / Province</Label><SuggestInput value={form.region || ''} onChange={(v) => setForm((f) => ({ ...f, region: v }))} options={regions} placeholder="e.g. NS" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Postal / ZIP code</Label><Input value={form.postal_code} onChange={setF('postal_code')} /></div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Map coordinates</Label>
              <Button type="button" variant="outline" size="sm" onClick={doGeocode} disabled={geocoding || !leadAddress().trim()}>
                {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <MapPin className="h-3.5 w-3.5 mr-1.5" />}
                Look up now
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Filled automatically from the address when you save, or look it up now / enter manually to override.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-normal text-gray-500">Latitude</Label>
                <Input value={form.latitude || ''} onChange={setF('latitude')} placeholder="e.g. 43.6532" inputMode="decimal" />
              </div>
              <div>
                <Label className="text-xs font-normal text-gray-500">Longitude</Label>
                <Input value={form.longitude || ''} onChange={setF('longitude')} placeholder="e.g. -79.3832" inputMode="decimal" />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.customer_existing} onChange={(e) => setForm({ ...form, customer_existing: e.target.checked })} className="rounded" />
            Existing customer
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>End User</Label><Input value={form.end_user_name} onChange={setF('end_user_name')} /></div>
            <div><Label>End User Country</Label><SuggestInput value={form.end_user_country || ''} onChange={(v) => setForm((f) => ({ ...f, end_user_country: v }))} options={countries} placeholder="ISO, e.g. USA" maxLength={3} uppercase /></div>
          </div>

          {/* Attribution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Source</Label>
              <SuggestInput value={form.source || ''} onChange={(v) => setForm((f) => ({ ...f, source: v }))} options={sources.map((s) => s.name)} placeholder="Pick or type a new one" />
            </div>
            <div>
              <Label>Campaign</Label>
              <SuggestInput value={form.campaign || ''} onChange={(v) => setForm((f) => ({ ...f, campaign: v }))} options={campaigns.map((c) => c.name)} placeholder="Pick or type a new one" />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <select className={SELECT_CLASS} value={form.status as string} onChange={setF('status')}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>

          {/* Funnel milestones */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm mb-1">
                <input type="checkbox" checked={form.reached_mql} onChange={(e) => setForm({ ...form, reached_mql: e.target.checked })} className="rounded" />
                Reached MQL
              </label>
              <Input type="date" value={form.mql_date || ''} onChange={setF('mql_date')} disabled={!form.reached_mql} />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm mb-1">
                <input type="checkbox" checked={form.reached_sql} onChange={(e) => setForm({ ...form, reached_sql: e.target.checked })} className="rounded" />
                Reached SQL
              </label>
              <Input type="date" value={form.sql_date || ''} onChange={setF('sql_date')} disabled={!form.reached_sql} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Final State</Label>
              <select className={SELECT_CLASS} value={form.final_state || ''} onChange={setF('final_state')}>
                <option value="">(None)</option>
                {FINAL_STATES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div><Label>Final State Date</Label><Input type="date" value={form.final_state_date || ''} onChange={setF('final_state_date')} /></div>
          </div>

          <div><Label>Notes</Label><Textarea value={form.notes} onChange={setF('notes')} /></div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : (lead ? 'Update Lead' : 'Save Lead')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
