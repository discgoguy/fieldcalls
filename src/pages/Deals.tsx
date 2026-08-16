import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { CrmDeal, CrmCompany, CrmPipelineStage, CrmDealStageHistory } from '@/api/entities';
import type { CrmDealRow, CrmPipelineStageRow, CrmDealStageHistoryRow } from '@/api/entities';
import { formatMoney, logStageChange, daysSince, statusForStage } from '@/components/crm/crmUtils';
import { groupDealsByStage, stageTotal, latestStageEntryByDeal } from './deals.logic';
import DealCard from '@/components/crm/DealCard';
import DealForm from '@/components/crm/DealForm';
import FilterSelect from '@/components/crm/FilterSelect';
import { dealColumns } from '@/components/crm/exportColumns';
import { exportCsv, csvFilename } from '@/lib/csv';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners, useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, TrendingUp, Loader2, Search, Download } from 'lucide-react';

const DEAL_STATUSES = ['open', 'won', 'lost'];

// Search + filters live in the URL (via useUrlFilters) so they survive a detail-page
// round-trip and browser Back. `status` is clamped so a bad ?status= can't hide every
// deal. Module-level for stable identity.
const FILTER_SPECS = {
  q: { default: '' },
  company: { default: 'all' },
  status: { default: 'all', allowed: ['all', ...DEAL_STATUSES] },
} as const;

interface ColumnProps {
  /** The pipeline stage this column represents. */
  stage: CrmPipelineStageRow;
  /** Deals in this stage. */
  deals: CrmDealRow[];
  /** company_id → company name, for card labels. */
  companies: Record<string, string>;
  /** deal_id → ISO timestamp the deal entered its stage, for the rot badge. */
  stageEnteredAt: Record<string, string>;
  /** Called when a card is opened. */
  onOpen: (deal: CrmDealRow) => void;
}

function Column({ stage, deals, companies, stageEnteredAt, onOpen }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}` });
  const total = stageTotal(deals);
  const accent = stage.is_won ? 'border-t-green-500' : stage.is_lost ? 'border-t-red-400' : 'border-t-blue-500';

  return (
    <div className="flex flex-col">
      <div className={`bg-white rounded-t-lg border border-b-0 border-t-4 ${accent} px-3 py-2`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-gray-800">{stage.name}</span>
          <span className="text-xs text-gray-400">{deals.length}</span>
        </div>
        <div className="text-xs text-gray-500">{formatMoney(total)}</div>
      </div>
      {/* Capped height with internal scroll: the board wraps at 3-up, so without a
          cap a busy stage in the first row grew tall enough to push the second row of
          stages off-screen. Every column is now the same bounded height regardless of
          how many deals it holds. min-h keeps an empty column a usable drop target. */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] max-h-[420px] overflow-y-auto bg-gray-50 border border-t-0 rounded-b-lg p-2 space-y-2 ${isOver ? 'bg-blue-50' : ''}`}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} companyName={companies[d.company_id ?? '']} daysInStage={daysSince(stageEnteredAt[d.id] || d.created_date)} onOpen={onOpen} />
          ))}
        </SortableContext>
        {deals.length === 0 && <p className="text-xs text-gray-300 text-center py-4">Drop deals here</p>}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<CrmPipelineStageRow[]>([]);
  const [deals, setDeals] = useState<CrmDealRow[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [stageEnteredAt, setStageEnteredAt] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { values, setFilter } = useUrlFilters(FILTER_SPECS);
  const { q: search, company: companyFilter, status: statusFilter } = values;
  const setSearch = (v: string) => setFilter('q', v);
  const setCompanyFilter = (v: string) => setFilter('company', v);
  const setStatusFilter = (v: string) => setFilter('status', v);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = async () => {
    setLoading(true);
    try {
      const [st, d, co, hist] = await Promise.all([
        CrmPipelineStage.list('sort_order'),
        CrmDeal.list('-created_date'),
        CrmCompany.list('name'),
        CrmDealStageHistory.list('created_date', 10000).catch(() => [] as CrmDealStageHistoryRow[]), // history is optional; never blank the board
      ]);
      setStages(st || []);
      setDeals(d || []);
      setCompanies(Object.fromEntries((co || []).map((c) => [c.id, c.name])));
      // history is sorted ascending, so the last write per deal wins = latest transition
      setStageEnteredAt(latestStageEntryByDeal(hist || []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredDeals = useMemo(() => {
    const q = search.toLowerCase();
    return deals.filter((d) =>
      (!q || d.name?.toLowerCase().includes(q) || (!!d.company_id && (companies[d.company_id] || '').toLowerCase().includes(q)))
      && (companyFilter === 'all' || d.company_id === companyFilter)
      && (statusFilter === 'all' || d.status === statusFilter)
    );
  }, [deals, companies, search, companyFilter, statusFilter]);

  const dealsByStage = useMemo(() => groupDealsByStage(stages, filteredDeals), [stages, filteredDeals]);

  const companyOpts = Array.from(new Set(deals.map((d) => d.company_id).filter((id): id is string => !!id)))
    .map((id) => ({ value: id, label: companies[id] || 'Unknown' }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const exportRows = () => {
    const stageName = Object.fromEntries(stages.map((s) => [s.id, s.name]));
    exportCsv(csvFilename('crm-deals'), dealColumns(companies, stageName), filteredDeals);
  };

  const findStageOfDeal = (dealId: string) => deals.find((d) => d.id === dealId)?.stage_id;

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const dealId = String(active.id);
    const overId = String(over.id);
    const targetStageId = overId.startsWith('stage:') ? overId.slice(6) : findStageOfDeal(overId);
    const sourceStageId = findStageOfDeal(dealId);
    if (!targetStageId || targetStageId === sourceStageId) return;

    const stage = stages.find((s) => s.id === targetStageId);
    // Fall back to the deal's current status if the target stage isn't loaded,
    // so a stale/empty `stages` list can't silently reopen a won/lost deal.
    const current = deals.find((d) => d.id === dealId);
    const status = statusForStage(stage, current?.status ?? undefined);

    // optimistic update
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: targetStageId, status } : d)));
    setStageEnteredAt((prev) => ({ ...prev, [dealId]: new Date().toISOString() }));
    try {
      await CrmDeal.update(dealId, { stage_id: targetStageId, status });
      await logStageChange(dealId, sourceStageId, targetStageId);
    } catch {
      load(); // revert on failure
    }
  };

  const activeDeal = deals.find((d) => d.id === activeId);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold flex items-center"><TrendingUp className="mr-2" />Deals</h1>
          <p className="text-sm text-gray-500">Drag deals across your pipeline.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" className="hidden sm:inline-flex" onClick={exportRows} disabled={filteredDeals.length === 0}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
          <Button onClick={() => setFormOpen(true)} className="px-3 sm:px-4" aria-label="Add Deal" title="Add Deal"><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Add Deal</span></Button>
        </div>
      </div>

      {!loading && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search deals..." className="pl-8 h-9 w-56" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
          </div>
          <FilterSelect label="Company" value={companyFilter} options={companyOpts} onChange={setCompanyFilter} />
          <FilterSelect label="Status" value={statusFilter} options={DEAL_STATUSES.map((s) => ({ value: s, label: s }))} onChange={setStatusFilter} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }: DragStartEvent) => setActiveId(String(active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 items-start">
            {stages.map((s) => (
              <Column key={s.id} stage={s} deals={dealsByStage[s.id] || []} companies={companies} stageEnteredAt={stageEnteredAt} onOpen={(d) => navigate(createPageUrl('DealDetail') + '?id=' + d.id)} />
            ))}
          </div>
          <DragOverlay>
            {activeDeal ? <DealCard deal={activeDeal} companyName={companies[activeDeal.company_id ?? '']} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <DealForm open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
    </div>
  );
}
