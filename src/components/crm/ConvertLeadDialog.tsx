import { useState, useEffect, type ChangeEvent } from 'react';
import { supabase } from '@/api/supabaseClient';
import type { CrmLeadRow } from '@/api/entities';
import { leadMilestoneStamps } from './crmUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ConvertForm {
  companyName: string;
  firstName: string;
  lastName: string;
  createDeal: boolean;
  dealName: string;
  dealAmount: string;
}

interface ConvertLeadDialogProps {
  /** The lead to convert; the dialog is open while this is non-null. */
  lead: CrmLeadRow | null;
  /** Called to close the dialog. */
  onClose: () => void;
  /** Called after a successful conversion. */
  onConverted?: () => void;
}

export default function ConvertLeadDialog({ lead, onClose, onConverted }: ConvertLeadDialogProps) {
  const [convert, setConvert] = useState<ConvertForm>({ companyName: '', firstName: '', lastName: '', createDeal: true, dealName: '', dealAmount: '' });
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lead) return;
    const [first, ...rest] = (lead.name || '').trim().split(' ');
    setError('');
    setConvert({
      companyName: lead.company_name || '',
      firstName: first || '',
      lastName: rest.join(' ') || '',
      createDeal: true,
      // Leads can be created with only an email - never bake "null" into the name.
      dealName: `${(lead.company_name || lead.name || 'New').trim() || 'New'} opportunity`,
      dealAmount: '',
    });
  }, [lead]);

  const doConvert = async () => {
    if (!lead) return;
    setConverting(true);
    setError('');
    try {
      const now = new Date().toISOString();
      // Conversion is by definition sales-qualified, so stamp the funnel
      // milestones consistently (treating the conversion as reached MQL + SQL)
      // rather than off the lead's stale flags.
      const stamps = leadMilestoneStamps(lead, { status: 'qualified', reached_mql: true, reached_sql: true }, now);
      const dealAmount = convert.dealAmount === '' ? 0 : Number(convert.dealAmount);

      // Atomic server-side conversion: one transaction, so a partial failure
      // rolls back - no orphaned company/contact and no duplicate on retry.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rpcError } = await (supabase.rpc as any)('convert_lead', {
        p_lead_id: lead.id,
        p_company_name: convert.companyName.trim() || null,
        p_first_name: convert.firstName || null,
        p_last_name: convert.lastName || null,
        p_create_deal: convert.createDeal,
        p_deal_name: convert.dealName || null,
        p_deal_amount: dealAmount,
        p_acknowledged_at: stamps.acknowledged_at ?? null,
        p_assigned_to_sales_at: stamps.assigned_to_sales_at ?? null,
        p_first_contact_at: stamps.first_contact_at ?? null,
      });
      if (rpcError) throw rpcError;
      onClose();
      onConverted?.();
    } catch (err) {
      setError((err as Error).message || 'Failed to convert lead.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open={!!lead} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Convert Lead</DialogTitle></DialogHeader>
        {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-4 pt-2">
          <div><Label>Company name (leave blank to skip)</Label><Input value={convert.companyName} onChange={(e: ChangeEvent<HTMLInputElement>) => setConvert({ ...convert, companyName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>First name</Label><Input value={convert.firstName} onChange={(e: ChangeEvent<HTMLInputElement>) => setConvert({ ...convert, firstName: e.target.value })} /></div>
            <div><Label>Last name</Label><Input value={convert.lastName} onChange={(e: ChangeEvent<HTMLInputElement>) => setConvert({ ...convert, lastName: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={convert.createDeal} onChange={(e) => setConvert({ ...convert, createDeal: e.target.checked })} className="rounded" />
            Also create a deal
          </label>
          {convert.createDeal && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2"><Label>Deal name</Label><Input value={convert.dealName} onChange={(e: ChangeEvent<HTMLInputElement>) => setConvert({ ...convert, dealName: e.target.value })} /></div>
              <div><Label>Amount</Label><Input type="number" min="0" step="0.01" value={convert.dealAmount} onChange={(e: ChangeEvent<HTMLInputElement>) => setConvert({ ...convert, dealAmount: e.target.value })} /></div>
            </div>
          )}
          <Button onClick={doConvert} disabled={converting} className="w-full">
            {converting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Converting...</> : 'Convert Lead'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
