import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { CrmSource, CrmCampaign } from '@/api/entities';
import type { CrmSourceRow, CrmCampaignRow } from '@/api/entities';
import { formatMoney, SELECT_CLASS } from '@/components/crm/crmUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Megaphone, Radio, Loader2, AlertTriangle, Pencil, Trash2 } from 'lucide-react';

interface SourceForm { name: string; source_type: string; total_cost: string | number; }
interface CampaignForm { name: string; source_id: string; start_date: string; end_date: string; }

const EMPTY_SOURCE: SourceForm = { name: '', source_type: '', total_cost: '' };
const EMPTY_CAMPAIGN: CampaignForm = { name: '', source_id: '', start_date: '', end_date: '' };

export default function SourcesCampaignsPage() {
  const [sources, setSources] = useState<CrmSourceRow[]>([]);
  const [campaigns, setCampaigns] = useState<CrmCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // source dialog
  const [srcOpen, setSrcOpen] = useState(false);
  const [srcEditing, setSrcEditing] = useState<CrmSourceRow | null>(null);
  const [srcForm, setSrcForm] = useState<SourceForm>(EMPTY_SOURCE);

  // campaign dialog
  const [campOpen, setCampOpen] = useState(false);
  const [campEditing, setCampEditing] = useState<CrmCampaignRow | null>(null);
  const [campForm, setCampForm] = useState<CampaignForm>(EMPTY_CAMPAIGN);

  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [src, camp] = await Promise.all([CrmSource.list('name'), CrmCampaign.list('name')]);
      setSources(src || []);
      setCampaigns(camp || []);
    } catch {
      setError('Failed to load sources and campaigns.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const sourceName = (id: string | null | undefined) => sources.find((s) => s.id === id)?.name || '—';

  // ---- sources ----
  const openNewSource = () => { setSrcEditing(null); setSrcForm(EMPTY_SOURCE); setError(''); setSrcOpen(true); };
  const openEditSource = (s: CrmSourceRow) => {
    setSrcEditing(s);
    setSrcForm({ name: s.name, source_type: s.source_type || '', total_cost: s.total_cost ?? '' });
    setError(''); setSrcOpen(true);
  };
  const saveSource = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (!srcForm.name.trim()) throw new Error('Source name is required.');
      const payload = { name: srcForm.name.trim(), source_type: srcForm.source_type || null, total_cost: srcForm.total_cost === '' ? 0 : Number(srcForm.total_cost) };
      if (srcEditing) await CrmSource.update(srcEditing.id, payload);
      else await CrmSource.create(payload);
      setSrcOpen(false);
      load();
    } catch (err) {
      setError((err as Error).message || 'Failed to save source.');
    } finally {
      setSaving(false);
    }
  };
  const deleteSource = async (s: CrmSourceRow) => {
    if (!window.confirm(`Delete source "${s.name}"? This can't be undone.`)) return;
    setError('');
    try {
      await CrmSource.delete(s.id);
      load();
    } catch {
      setError(`Can't delete "${s.name}": it's still linked to leads or campaigns.`);
    }
  };

  // ---- campaigns ----
  const openNewCampaign = () => { setCampEditing(null); setCampForm(EMPTY_CAMPAIGN); setError(''); setCampOpen(true); };
  const openEditCampaign = (c: CrmCampaignRow) => {
    setCampEditing(c);
    setCampForm({ name: c.name, source_id: c.source_id || '', start_date: c.start_date || '', end_date: c.end_date || '' });
    setError(''); setCampOpen(true);
  };
  const saveCampaign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (!campForm.name.trim()) throw new Error('Campaign name is required.');
      const payload = { name: campForm.name.trim(), source_id: campForm.source_id || null, start_date: campForm.start_date || null, end_date: campForm.end_date || null };
      if (campEditing) await CrmCampaign.update(campEditing.id, payload);
      else await CrmCampaign.create(payload);
      setCampOpen(false);
      load();
    } catch (err) {
      setError((err as Error).message || 'Failed to save campaign.');
    } finally {
      setSaving(false);
    }
  };
  const deleteCampaign = async (c: CrmCampaignRow) => {
    if (!window.confirm(`Delete campaign "${c.name}"? This can't be undone.`)) return;
    setError('');
    try {
      await CrmCampaign.delete(c.id);
      load();
    } catch {
      setError(`Can't delete "${c.name}": it's still linked to leads.`);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Sources */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center"><Radio className="mr-2 h-5 w-5" />Sources</CardTitle>
              <CardDescription>Where leads come from. Cost is tracked at the source level for the funnel model.</CardDescription>
            </div>
            <Button onClick={openNewSource} className="shrink-0 px-3 sm:px-4" aria-label="Add Source" title="Add Source"><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Add Source</span></Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.length > 0 ? sources.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.source_type || <span className="text-gray-400">—</span>}</TableCell>
                  <TableCell className="text-right">{formatMoney(s.total_cost)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditSource(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteSource(s)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan="4" className="text-center text-gray-500">No sources yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Campaigns */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center"><Megaphone className="mr-2 h-5 w-5" />Campaigns</CardTitle>
              <CardDescription>Marketing campaigns, each rolling up to a source.</CardDescription>
            </div>
            <Button onClick={openNewCampaign} className="shrink-0 px-3 sm:px-4" aria-label="Add Campaign" title="Add Campaign"><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Add Campaign</span></Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length > 0 ? campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{sourceName(c.source_id)}</TableCell>
                  <TableCell>{c.start_date || <span className="text-gray-400">—</span>}</TableCell>
                  <TableCell>{c.end_date || <span className="text-gray-400">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditCampaign(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteCampaign(c)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan="5" className="text-center text-gray-500">No campaigns yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Source dialog */}
      <Dialog open={srcOpen} onOpenChange={setSrcOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{srcEditing ? 'Edit Source' : 'Add Source'}</DialogTitle></DialogHeader>
          {error && srcOpen && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={saveSource} className="space-y-4 pt-2">
            <div><Label>Name *</Label><Input value={srcForm.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setSrcForm({ ...srcForm, name: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label><Input value={srcForm.source_type} onChange={(e: ChangeEvent<HTMLInputElement>) => setSrcForm({ ...srcForm, source_type: e.target.value })} placeholder="e.g. Web, Event, Referral" /></div>
              <div><Label>Total Cost</Label><Input type="number" step="0.01" min="0" value={srcForm.total_cost} onChange={(e: ChangeEvent<HTMLInputElement>) => setSrcForm({ ...srcForm, total_cost: e.target.value })} /></div>
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : (srcEditing ? 'Update Source' : 'Save Source')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Campaign dialog */}
      <Dialog open={campOpen} onOpenChange={setCampOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{campEditing ? 'Edit Campaign' : 'Add Campaign'}</DialogTitle></DialogHeader>
          {error && campOpen && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={saveCampaign} className="space-y-4 pt-2">
            <div><Label>Name *</Label><Input value={campForm.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setCampForm({ ...campForm, name: e.target.value })} required /></div>
            <div>
              <Label>Source</Label>
              <select className={SELECT_CLASS} value={campForm.source_id} onChange={(e) => setCampForm({ ...campForm, source_id: e.target.value })}>
                <option value="">(None)</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date</Label><Input type="date" value={campForm.start_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setCampForm({ ...campForm, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={campForm.end_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setCampForm({ ...campForm, end_date: e.target.value })} /></div>
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : (campEditing ? 'Update Campaign' : 'Save Campaign')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
