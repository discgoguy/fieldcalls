import { useState, useEffect, type FormEvent } from 'react';
import { CrmContact, CrmCompany } from '@/api/entities';
import type { CrmCompanyRow, CrmContactRow, InsertRow } from '@/api/entities';
import { getCurrentUserId, SELECT_CLASS, makeFieldSetter } from './crmUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ContactFormState {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  notes: string | null;
}

interface ContactFormProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called to open/close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** Edit this contact when present; create a new one otherwise. */
  contact?: CrmContactRow | null;
  /** Preselect this company when creating. */
  defaultCompanyId?: string | null;
  /** Called with the saved contact after a successful save. */
  onSaved?: (contact: CrmContactRow) => void;
}

const EMPTY: ContactFormState = { first_name: '', last_name: '', email: '', phone: '', title: '', company_id: '', notes: '' };

export default function ContactForm({ open, onOpenChange, contact, defaultCompanyId, onSaved }: ContactFormProps) {
  const [form, setForm] = useState<ContactFormState>(EMPTY);
  const [companies, setCompanies] = useState<CrmCompanyRow[]>([]);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(contact ? { ...EMPTY, ...contact } : { ...EMPTY, company_id: defaultCompanyId || '' });
    CrmCompany.list('name').then((d) => setCompanies(d || [])).catch(() => {});
  }, [open, contact, defaultCompanyId]);

  const set = makeFieldSetter(form, setForm);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!form.first_name?.trim() && !form.last_name?.trim() && !form.email?.trim()) {
        throw new Error('Enter at least a name or an email.');
      }
      const payload: InsertRow<'crm_contacts'> = {
        first_name: form.first_name, last_name: form.last_name, email: form.email,
        phone: form.phone, title: form.title, company_id: form.company_id || null, notes: form.notes,
      };
      let saved: CrmContactRow;
      if (contact?.id) {
        saved = await CrmContact.update(contact.id, payload);
      } else {
        payload.owner_id = await getCurrentUserId();
        saved = await CrmContact.create(payload);
      }
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to save contact.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact?.id ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ct-first">First Name</Label>
              <Input id="ct-first" value={form.first_name} onChange={set('first_name')} />
            </div>
            <div>
              <Label htmlFor="ct-last">Last Name</Label>
              <Input id="ct-last" value={form.last_name} onChange={set('last_name')} />
            </div>
          </div>
          <div>
            <Label htmlFor="ct-email">Email</Label>
            <Input id="ct-email" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ct-phone">Phone</Label>
              <Input id="ct-phone" value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <Label htmlFor="ct-title">Title</Label>
              <Input id="ct-title" value={form.title} onChange={set('title')} />
            </div>
          </div>
          <div>
            <Label htmlFor="ct-company">Company</Label>
            <select id="ct-company" className={SELECT_CLASS} value={form.company_id || ''} onChange={set('company_id')}>
              <option value="">(None)</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="ct-notes">Notes</Label>
            <Textarea id="ct-notes" value={form.notes} onChange={set('notes')} />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : (contact?.id ? 'Update Contact' : 'Save Contact')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
