import { useState, useEffect, type FormEvent } from 'react';
import { CrmCompany } from '@/api/entities';
import type { CrmCompanyRow, InsertRow } from '@/api/entities';
import { getCurrentUserId, makeFieldSetter, geocodeAddress, industryOptions, fetchIndustryOptions, fetchCountryOptions, fetchRegionOptions, composeAddress, trimText } from './crmUtils';
import SuggestInput from './SuggestInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, MapPin } from 'lucide-react';

interface CompanyFormState {
  name: string | null;
  domain: string | null;
  website: string | null;
  industry: string | null;
  phone: string | null;
  address: string | null;    // street line
  city: string | null;
  region: string | null;     // state / province
  postal_code: string | null;
  country: string | null;
  size: string | null;
  notes: string | null;
  latitude: string | null;   // held as text; converted to number on save
  longitude: string | null;
}

interface CompanyFormProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called to open/close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** Edit this company when present; create a new one otherwise. */
  company?: CrmCompanyRow | null;
  /** Called with the saved company after a successful save. */
  onSaved?: (company: CrmCompanyRow) => void;
  /** Industry values already in use, surfaced as suggestions. */
  knownIndustries?: (string | null | undefined)[];
}

const EMPTY: CompanyFormState = { name: '', domain: '', website: '', industry: '', phone: '', address: '', city: '', region: '', postal_code: '', country: '', size: '', notes: '', latitude: '', longitude: '' };

export default function CompanyForm({ open, onOpenChange, company, onSaved, knownIndustries = [] }: CompanyFormProps) {
  const [industries, setIndustries] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [form, setForm] = useState<CompanyFormState>(EMPTY);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [geocoding, setGeocoding] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setError('');
      setForm(company
        ? { ...EMPTY, ...company, latitude: company.latitude?.toString() ?? '', longitude: company.longitude?.toString() ?? '' }
        : EMPTY);
      // Seed suggestions from what we already know, then load every value in use.
      setIndustries(industryOptions([...knownIndustries, company?.industry]));
      fetchIndustryOptions().then((opts) => setIndustries(industryOptions([...opts, ...knownIndustries, company?.industry])));
      setCountries(industryOptions([company?.country]));
      fetchCountryOptions().then((opts) => setCountries(industryOptions([...opts, company?.country])));
      setRegions(industryOptions([company?.region]));
      fetchRegionOptions().then((opts) => setRegions(industryOptions([...opts, company?.region])));
    }
  }, [open, company]);

  const set = makeFieldSetter(form, setForm);

  const doGeocode = async () => {
    setGeocoding(true);
    setError('');
    const hit = await geocodeAddress(composeAddress(form));
    if (hit) setForm((f) => ({ ...f, latitude: String(hit.lat), longitude: String(hit.lng) }));
    else setError('Could not geocode that address. Enter coordinates manually.');
    setGeocoding(false);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!form.name?.trim()) throw new Error('Company name is required.');
      // Coordinates: use manual entry if given, else auto-geocode from the address.
      let latitude = form.latitude ? Number(form.latitude) : null;
      let longitude = form.longitude ? Number(form.longitude) : null;
      if (latitude === null && longitude === null) {
        const hit = await geocodeAddress(composeAddress(form));
        if (hit) { latitude = hit.lat; longitude = hit.lng; }
      }
      const payload: InsertRow<'crm_companies'> = {
        // Free text is trimmed on the way in: an invisible trailing space is a
        // distinct value to the suggestion/filter dropdowns (see trimText).
        name: form.name.trim(),
        domain: trimText(form.domain), website: trimText(form.website),
        industry: trimText(form.industry), phone: trimText(form.phone),
        address: trimText(form.address), city: trimText(form.city),
        region: trimText(form.region), postal_code: trimText(form.postal_code),
        country: trimText(form.country), size: trimText(form.size), notes: form.notes,
        latitude, longitude,
      };
      let saved: CrmCompanyRow;
      if (company?.id) {
        saved = await CrmCompany.update(company.id, payload);
      } else {
        payload.owner_id = await getCurrentUserId();
        saved = await CrmCompany.create(payload);
      }
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to save company.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company?.id ? 'Edit Company' : 'Add Company'}</DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="c-name">Company Name *</Label>
            <Input id="c-name" value={form.name} onChange={set('name')} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="c-website">Website</Label>
              <Input id="c-website" value={form.website} onChange={set('website')} placeholder="https://" />
            </div>
            <div>
              <Label htmlFor="c-domain">Domain</Label>
              <Input id="c-domain" value={form.domain} onChange={set('domain')} placeholder="example.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="c-industry">Industry</Label>
              <SuggestInput id="c-industry" value={form.industry || ''} onChange={(v) => setForm((f) => ({ ...f, industry: v }))} options={industries} placeholder="Type an industry" />
            </div>
            <div>
              <Label htmlFor="c-size">Size</Label>
              <Input id="c-size" value={form.size} onChange={set('size')} placeholder="e.g. 11-50" />
            </div>
          </div>
          <div>
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="c-address">Street address</Label>
              <Input id="c-address" value={form.address} onChange={set('address')} placeholder="123 Main St, Suite 200" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-city">City</Label>
                <Input id="c-city" value={form.city} onChange={set('city')} />
              </div>
              <div>
                <Label htmlFor="c-region">State / Province</Label>
                <SuggestInput id="c-region" value={form.region || ''} onChange={(v) => setForm((f) => ({ ...f, region: v }))} options={regions} placeholder="e.g. NS" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-postal">Postal / ZIP code</Label>
                <Input id="c-postal" value={form.postal_code} onChange={set('postal_code')} />
              </div>
              <div>
                <Label htmlFor="c-country">Country</Label>
                <SuggestInput id="c-country" value={form.country || ''} onChange={(v) => setForm((f) => ({ ...f, country: v }))} options={countries} placeholder="ISO code, e.g. CAN" maxLength={3} uppercase />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Map coordinates</Label>
              <Button type="button" variant="outline" size="sm" onClick={doGeocode} disabled={geocoding || !composeAddress(form).trim()}>
                {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <MapPin className="h-3.5 w-3.5 mr-1.5" />}
                Look up now
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Filled automatically from the address when you save, or look it up now / enter manually to override.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-lat" className="text-xs font-normal text-gray-500">Latitude</Label>
                <Input id="c-lat" value={form.latitude} onChange={set('latitude')} placeholder="e.g. 43.6532" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="c-lng" className="text-xs font-normal text-gray-500">Longitude</Label>
                <Input id="c-lng" value={form.longitude} onChange={set('longitude')} placeholder="e.g. -79.3832" inputMode="decimal" />
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" value={form.notes} onChange={set('notes')} />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : (company?.id ? 'Update Company' : 'Save Company')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
