import { useState, type ChangeEvent, type FormEvent } from 'react';
import { CrmActivity } from '@/api/entities';
import type { InsertRow } from '@/api/entities';
import { invokeApi } from '@/api/supabaseClient';
import { getCurrentUserId, isValidEmail } from './crmUtils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { StickyNote, Phone, Users, CheckSquare, Mail, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ActivityLinks = Partial<Pick<InsertRow<'crm_activities'>, 'contact_id' | 'deal_id' | 'company_id' | 'lead_id'>>;

interface ActivityComposerProps {
  /** The record to attach the activity to, as a relating id, e.g. { deal_id: id }. */
  links?: ActivityLinks;
  /** Prefill the email "To" field (e.g. the contact's address). */
  defaultEmail?: string | null;
  /** Called after an activity is logged. */
  onLogged?: () => void;
}

// The "Email" activity type is hidden unless VITE_CRM_EMAIL is explicitly set to
// 'true' (mirrors VITE_CRM_CHAT). Off by default, so the CRM sends no email this
// release; the send path (api/crm.ts sendEmail) stays in the build behind the flag.
const CRM_EMAIL_ENABLED = import.meta.env.VITE_CRM_EMAIL === 'true';

const TYPES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'note', label: 'Note', icon: StickyNote },
  ...(CRM_EMAIL_ENABLED ? [{ key: 'email', label: 'Email', icon: Mail }] : []),
  { key: 'call', label: 'Call', icon: Phone },
  { key: 'meeting', label: 'Meeting', icon: Users },
  { key: 'task', label: 'Task', icon: CheckSquare },
];

/**
 * Compose a new activity. `links` carries the relating id(s), e.g. { contact_id } or { deal_id }.
 * The "Email" type sends via the sendCrmEmail serverless route (Resend when configured,
 * log-only otherwise) and records the message on the timeline; other types log directly.
 */
export default function ActivityComposer({ links = {}, defaultEmail, onLogged }: ActivityComposerProps) {
  const [type, setType] = useState<string>('note');
  const [to, setTo] = useState<string>(defaultEmail || '');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const isEmail = type === 'email';
  const hasContent = subject.trim() !== '' || body.trim() !== '';
  const canSubmit = hasContent && (!isEmail || isValidEmail(to));

  const reset = () => {
    setSubject(''); setBody(''); setDueDate(''); setType('note'); setTo(defaultEmail || ''); setError('');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const uid = await getCurrentUserId();
      if (isEmail) {
        // Log the email on the timeline via the entity factory (RLS), then send
        // best-effort - the send needs the server-only Resend secret, but a missing
        // provider (local dev) must not lose the logged message.
        await CrmActivity.create({
          type: 'email',
          direction: 'outbound',
          email_to: to.trim(),
          subject: subject.trim() || null,
          body: body.trim() || null,
          completed: false,
          owner_id: uid,
          created_by: uid,
          ...links,
        });
        let sent = false;
        try {
          const r = await invokeApi('crm', { action: 'sendEmail', to: to.trim(), subject: subject.trim(), body: body.trim() });
          sent = r?.sent === true;
        } catch { /* no serverless runtime / provider - the activity is still logged */ }
        reset();
        onLogged?.();
        if (!sent) setError('Logged on the timeline. Email was not sent (provider not configured).');
        return;
      }
      await CrmActivity.create({
        type,
        subject: subject.trim() || null,
        body: body.trim() || null,
        // datetime-local has no timezone; convert to ISO so TIMESTAMPTZ stores the
        // user's intended local time instead of interpreting it as UTC
        due_date: type === 'task' && dueDate ? new Date(dueDate).toISOString() : null,
        completed: false,
        owner_id: uid,
        created_by: uid,
        ...links,
      });
      reset();
      onLogged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-white">
      <div className="flex flex-wrap gap-1">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = type === t.key;
          return (
            <button
              type="button"
              key={t.key}
              onClick={() => { setType(t.key); setError(''); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>
      {isEmail && (
        <Input type="email" placeholder="To (email address)" value={to} onChange={(e: ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} />
      )}
      <Input placeholder="Subject" value={subject} onChange={(e: ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)} />
      <Textarea placeholder={isEmail ? 'Write your message...' : 'Add details...'} value={body} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} rows={isEmail ? 4 : 2} />
      {type === 'task' && (
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-600">Due</label>
          <Input type="datetime-local" value={dueDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)} className="w-auto" />
        </div>
      )}
      {error && <p className="text-xs text-amber-600">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={saving || !canSubmit}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isEmail ? 'Sending...' : 'Logging...'}</> : (isEmail ? 'Send Email' : 'Log Activity')}
        </Button>
      </div>
    </form>
  );
}
