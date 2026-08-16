import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CrmDeal, CrmCompany, CrmContact, CrmPipelineStage, CrmDealStageHistory } from '@/api/entities';
import type { CrmDealRow, CrmCompanyRow, CrmContactRow, CrmPipelineStageRow, CrmDealStageHistoryRow } from '@/api/entities';
import { contactName, formatMoney, logStageChange, daysSince, statusForStage, SELECT_CLASS, marginPct } from '@/components/crm/crmUtils';
import Field from '@/components/crm/Field';
import RecordHeader from '@/components/crm/RecordHeader';
import DealForm from '@/components/crm/DealForm';
import ActivityTimeline from '@/components/crm/ActivityTimeline';
import AttachmentsPanel from '@/components/crm/AttachmentsPanel';
import LinkedQuoteCard from '@/components/crm/LinkedQuoteCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from '@/lib/dateUtils';
import { TrendingUp, Loader2, Building2, Contact as ContactIcon, Clock, AlertTriangle } from 'lucide-react';

export default function DealDetailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id');
  const [deal, setDeal] = useState<CrmDealRow | null>(null);
  const [company, setCompany] = useState<CrmCompanyRow | null>(null);
  const [contact, setContact] = useState<CrmContactRow | null>(null);
  const [stages, setStages] = useState<CrmPipelineStageRow[]>([]);
  const [history, setHistory] = useState<CrmDealStageHistoryRow[]>([]);
  const [stageEnteredAt, setStageEnteredAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [stageError, setStageError] = useState('');

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const d = await CrmDeal.get(id);
      setDeal(d);
      const [co, ct, st, hist] = await Promise.all([
        d.company_id ? CrmCompany.get(d.company_id).catch(() => null) : Promise.resolve(null),
        d.primary_contact_id ? CrmContact.get(d.primary_contact_id).catch(() => null) : Promise.resolve(null),
        CrmPipelineStage.list('sort_order'),
        CrmDealStageHistory.filter({ deal_id: id }, 'created_date').catch(() => [] as CrmDealStageHistoryRow[]),
      ]);
      setCompany(co); setContact(ct); setStages(st || []);
      setHistory(hist || []);
      setStageEnteredAt(hist?.length ? hist[hist.length - 1].created_date : d.created_date);
    } catch {
      setDeal(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const changeStage = async (stageId: string) => {
    if (!id || !deal) return;
    const fromStageId = deal.stage_id;
    const stage = stages.find((s) => s.id === stageId);
    const status = statusForStage(stage, deal.status ?? undefined);
    setStageError('');
    setDeal((d) => (d ? { ...d, stage_id: stageId, status } : d));
    setStageEnteredAt(new Date().toISOString());
    setHistory((prev) => [...prev, { id: `local-${Date.now()}`, deal_id: id, from_stage_id: fromStageId, to_stage_id: stageId, created_date: new Date().toISOString() } as CrmDealStageHistoryRow]);
    try {
      await CrmDeal.update(id, { stage_id: stageId, status });
      await logStageChange(id, fromStageId, stageId);
    } catch {
      setStageError('Could not save the stage change. Reverted.');
      load(); // revert optimistic update on failure
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!deal) return <div className="text-center text-gray-500 py-12">Deal not found.</div>;

  const statusColor = deal.status === 'won' ? 'bg-green-100 text-green-800 hover:bg-green-200' : deal.status === 'lost' ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200';

  return (
    <div>
      <RecordHeader
        icon={TrendingUp}
        title={deal.name}
        subtitle={formatMoney(deal.amount, deal.currency)}
        backTo={createPageUrl('Deals')}
        onEdit={() => setEditOpen(true)}
        badge={<Badge className={statusColor}>{deal.status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Stage</div>
                <select className={SELECT_CLASS} value={deal.stage_id || ''} onChange={(e) => changeStage(e.target.value)}>
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {stageError && <Alert variant="destructive" className="mt-2"><AlertTriangle className="h-4 w-4" /><AlertDescription>{stageError}</AlertDescription></Alert>}
                {stageEnteredAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    In this stage for {daysSince(stageEnteredAt)} day{daysSince(stageEnteredAt) === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <Field label="Amount" value={formatMoney(deal.amount, deal.currency)} />
              <Field label="Expected Close" value={deal.expected_close_date} />
              <Field label="Actual Close" value={deal.actual_close_date} />
              {deal.oem_or_aftermarket && <Field label="OEM / Aftermarket" value={deal.oem_or_aftermarket} />}
              {(deal.prequote_estimate_value ?? 0) > 0 && <Field label="Prequote Estimate" value={formatMoney(deal.prequote_estimate_value, deal.currency)} />}
              {(deal.margin_value ?? 0) !== 0 && (
                <Field
                  label="Margin"
                  value={`${formatMoney(deal.margin_value, deal.currency)}${deal.amount ? ` (${marginPct(deal.amount, deal.margin_value)})` : ''}`}
                />
              )}
              <Field label="End User" value={[deal.end_user_name, deal.end_user_country && `(${deal.end_user_country})`].filter(Boolean).join(' ') || null} />
              {company && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Company</div>
                  <button className="text-sm text-blue-600 flex items-center gap-1" onClick={() => navigate(createPageUrl('CompanyDetail') + '?id=' + company.id)}>
                    <Building2 className="h-3.5 w-3.5" />{company.name}
                  </button>
                </div>
              )}
              {contact && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Primary Contact</div>
                  <button className="text-sm text-blue-600 flex items-center gap-1" onClick={() => navigate(createPageUrl('ContactDetail') + '?id=' + contact.id)}>
                    <ContactIcon className="h-3.5 w-3.5" />{contactName(contact)}
                  </button>
                </div>
              )}
              <Field label="Notes" value={deal.notes} />
            </CardContent>
          </Card>
          {history.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center"><Clock className="h-4 w-4 mr-2" />Stage History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map((h, i) => {
                    const stageName = stages.find((s) => s.id === h.to_stage_id)?.name || 'Unknown stage';
                    const next = history[i + 1];
                    const isLast = !next;
                    const start = new Date(h.created_date ?? 0);
                    // duration in stage: until the next transition, or until now while the deal is open
                    const end = next ? new Date(next.created_date ?? 0) : (deal.status === 'open' ? new Date() : null);
                    const days = end ? Math.max(0, (end.getTime() - start.getTime()) / 86400000) : null;
                    const duration = days == null ? null : days < 1 ? '<1d' : `${Math.round(days)}d`;
                    return (
                      <div key={h.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isLast ? 'bg-blue-500' : 'bg-gray-300'}`} />
                          <span className={isLast ? 'font-medium text-gray-900' : 'text-gray-600'}>{stageName}</span>
                          {isLast && deal.status === 'open' && <span className="text-xs text-blue-500">current</span>}
                        </div>
                        <div className="text-xs text-gray-400">
                          {format(start, 'MMM d')}{duration && <> • {duration}</>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          <LinkedQuoteCard deal={deal} onChange={load} />
          <Card>
            <CardContent className="pt-6"><AttachmentsPanel links={{ deal_id: id }} /></CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
          <CardContent><ActivityTimeline links={{ deal_id: id }} /></CardContent>
        </Card>
      </div>

      <DealForm open={editOpen} onOpenChange={setEditOpen} deal={deal} onSaved={load} />
    </div>
  );
}
