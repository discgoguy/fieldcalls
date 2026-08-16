import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CrmDeal, CrmPipelineStage, CrmLead, CrmActivity, CrmDealStageHistory, CrmSource, CrmCampaign, CrmCompany, Quote } from '@/api/entities';
import type { CrmDealRow, CrmPipelineStageRow, CrmLeadRow, CrmDealStageHistoryRow, CrmSourceRow, CrmCompanyRow, Row } from '@/api/entities';
import { formatMoney, formatMoneyWhole } from '@/components/crm/crmUtils';
import { pct, deriveCrmOverview } from './crmDashboard.logic';
import CrmChat from '@/components/crm/CrmChat';
import CrmMap from '@/components/crm/CrmMap';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { LayoutDashboard, TrendingUp, TrendingDown, Trophy, CircleDollarSign, CheckSquare, Percent, Calculator, Users, Loader2, Filter, GitBranch, PackageCheck, Map as MapIcon, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildCrmExport } from './crmExport.logic';
import { useUrlFilters } from '@/lib/useUrlFilters';

type QuoteRow = Row<'quotes'>;

// Active tab in the URL (via useUrlFilters) so browser Back restores it instead of
// snapping to Sales Funnel and hiding the map. `allowed` clamps a bad ?tab= to funnel.
const DASHBOARD_FILTERS = {
  tab: { default: 'funnel', allowed: ['funnel', 'leads', 'map'] },
} as const;

// Feature flag: the "Ask your CRM" AI chat is hidden unless VITE_CRM_CHAT is
// explicitly set to 'true' (e.g. in .env.local). Defaults off so the chat stays
// hidden in every environment until we choose to enable it. The component and the
// api/crm.ts route stay in the build - this only gates the render.
const CRM_CHAT_ENABLED = import.meta.env.VITE_CRM_CHAT === 'true';

// Chart theme (light mode) - hues from the validated dataviz palette; recessive
// chrome. Single-series bars use one sequential blue; pies use the fixed
// categorical order. Re-run scripts/validate_palette.js before changing hues.
const CHART_BLUE = '#2a78d6';        // sequential / single-series magnitude
const CHART_GRID = '#e1e0d9';        // hairline gridlines
const CHART_AXIS = '#c3c2b7';        // baseline / axis line
const CHART_TICK = { fill: '#898781', fontSize: 12 } as const;  // muted tick labels
// Lead status = categorical identity, validated order (CVD ΔE 13.3): new→working→qualified→disqualified.
const LEAD_COLORS: Record<string, string> = { new: '#2a78d6', working: '#eda100', qualified: '#008300', disqualified: '#e34948' };
const NEW_EXISTING_COLORS = ['#2a78d6', '#1baf7a'];
// Recent-deals row tint by deal status: blue=open, green=won, red=lost.
const DEAL_ROW_CLASS: Record<string, string> = {
  open: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  won: 'bg-green-50 border-green-200 hover:bg-green-100',
  lost: 'bg-red-50 border-red-200 hover:bg-red-100',
};
// How many of the newest deals the "Recent deals" card lists. The card scrolls, so
// this is about how far back is useful, not about what fits.
const RECENT_DEALS_LIMIT = 20;

interface KpiProps {
  /** Icon shown in the card's corner. */
  icon: LucideIcon;
  /** Metric label. */
  label: string;
  /** The figure. */
  value: ReactNode;
  /** Optional smaller line under the value. */
  sub?: ReactNode;
  /** Tailwind classes tinting the icon circle. */
  accent: string;
}

function Kpi({ icon: Icon, label, value, sub, accent }: KpiProps) {
  return (
    <Card>
      <CardContent className="relative pt-6">
        {/* The icon is absolutely positioned in the corner, so it contributes no
            layout height (as its own flex row it left a gap above the value) and
            takes no width from the figure. It's hidden below `sm`, where the card is
            narrowest and the number matters more than the decoration.
            Do NOT make the icon and the value flex siblings again: the text then
            needs `min-w-0` or it overflows on top of the icon, and the icon needs
            `shrink-0` or its circle is squashed into an oval. */}
        <div
          className={`absolute right-4 top-4 hidden h-7 w-7 items-center justify-center rounded-full sm:flex ${accent}`}
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        {/* pr only where the icon exists, so the label never runs under it. */}
        <div className="text-xs uppercase tracking-wide text-gray-500 sm:pr-9">{label}</div>
        {/* Sized to hold a 10-digit currency figure ($1,234,567,890) at the narrowest
            card width. `break-words` is a safety net: normally inert, but it wraps
            rather than overflowing if a value ever exceeds even that. */}
        <div className="mt-1 break-words text-xl font-semibold tabular-nums text-gray-900 2xl:text-2xl">{value}</div>
        {sub != null && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function CRMDashboardPage() {
  const navigate = useNavigate();
  const { values, setFilter } = useUrlFilters(DASHBOARD_FILTERS);
  const activeTab = values.tab;
  const [deals, setDeals] = useState<CrmDealRow[]>([]);
  const [stages, setStages] = useState<CrmPipelineStageRow[]>([]);
  const [leads, setLeads] = useState<CrmLeadRow[]>([]);
  const [companies, setCompanies] = useState<CrmCompanyRow[]>([]);
  const [sources, setSources] = useState<CrmSourceRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [openTasks, setOpenTasks] = useState(0);
  const [stageHistory, setStageHistory] = useState<CrmDealStageHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Export the CRM data as a zip of CSVs mapped to the Lead Management & Sales
  // Funnel Power BI model. Reuses the already-loaded full lists (leads/deals/etc.
  // are unfiltered) and fetches campaigns fresh; jszip is lazy-imported on click.
  async function handleExportAll() {
    if (exporting) return;
    setExporting(true);
    try {
      const [{ default: JSZip }, campaigns] = await Promise.all([
        import('jszip'),
        CrmCampaign.list('name').catch(() => []),
      ]);
      const files = buildCrmExport({ sources, campaigns, leads, deals, stages, companies });
      const zip = new JSZip();
      for (const file of files) zip.file(file.name, file.content);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fieldcalls-crm-funnel_${new Date().toISOString().slice(0, 10)}.zip`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CRM export failed:', error);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [d, s, l, t, h, src, q, co] = await Promise.all([
          CrmDeal.list('-created_date'),
          CrmPipelineStage.list('sort_order'),
          CrmLead.list('-created_date'),
          CrmActivity.filter({ type: 'task' }),
          CrmDealStageHistory.list('created_date', 10000).catch(() => []),
          CrmSource.list('name').catch(() => []),
          Quote.list('-created_date').catch(() => []),
          CrmCompany.list('name').catch(() => []),
        ]);
        setDeals(d || []);
        setStages(s || []);
        setLeads(l || []);
        setOpenTasks((t || []).filter((x) => !x.completed).length);
        setStageHistory(h || []);
        setSources(src || []);
        setQuotes(q || []);
        setCompanies(co || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // All KPI aggregations recomputed only when the underlying data changes,
  // not on every render (the stage-history pass alone is over up to 10k rows).
  const derived = useMemo(
    () => deriveCrmOverview({ deals, stages, leads, stageHistory, sources, quotes }),
    [deals, stages, leads, stageHistory, sources, quotes],
  );

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  const {
    openDeals, openPipeline, wonValue, lostValue, winRate, avgDealSize,
    pipelineByStage, leadsByStatus, stageVelocity,
    mqlCount, sqlCount, oppCount, quotedValue, newExisting, leadsBySource, sourceDetails,
  } = derived;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold flex items-center"><LayoutDashboard className="mr-2" />Dashboard</h1>
          <p className="text-sm text-gray-500">Lead management and sales funnel at a glance.</p>
        </div>
        <Button
          variant="outline"
          className="hidden shrink-0 sm:inline-flex"
          onClick={handleExportAll}
          disabled={exporting}
          title="Download the CRM data as a zip of CSVs mapped to the Power BI sales-funnel model"
        >
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {exporting ? 'Exporting…' : 'Export all'}
        </Button>
      </div>

      {CRM_CHAT_ENABLED && <CrmChat />}

      {/* Sales Funnel leads (and is the default tab). NOTE: the TabsContent blocks
          below are still in their original order - tab order is defined here. */}
      <Tabs value={activeTab} onValueChange={(v: string) => setFilter('tab', v)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel"><TrendingUp className="mr-1.5 h-4 w-4" />Sales Funnel</TabsTrigger>
          <TabsTrigger value="leads"><Filter className="mr-1.5 h-4 w-4" />Lead Management</TabsTrigger>
          <TabsTrigger value="map"><MapIcon className="mr-1.5 h-4 w-4" />Map</TabsTrigger>
        </TabsList>

      {/* ===================== LEAD MANAGEMENT ===================== */}
      <TabsContent value="leads" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Kpi icon={Filter} label="MQLs created" value={mqlCount} accent="bg-blue-100 text-blue-600" />
          <Kpi icon={GitBranch} label="MQLs converted to SQL" value={sqlCount} sub={`${pct(sqlCount, mqlCount)}% of MQLs`} accent="bg-indigo-100 text-indigo-600" />
          <Kpi icon={Trophy} label="SQLs converted to Opp" value={oppCount} sub={`${pct(oppCount, sqlCount)}% of SQLs`} accent="bg-emerald-100 text-emerald-600" />
          <Kpi icon={CircleDollarSign} label="Deal value" value={formatMoneyWhole(quotedValue)} sub="Projected estimate across deals" accent="bg-green-100 text-green-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">New vs existing customers</CardTitle><CardDescription className="text-xs">Leads, split on whether the customer already existed</CardDescription></CardHeader>
            <CardContent>
              {newExisting.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={newExisting} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.name} ${pct(e.value, leads.length)}%`}>
                      {newExisting.map((e, i) => <Cell key={e.name} fill={NEW_EXISTING_COLORS[i % NEW_EXISTING_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-12">No leads yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Leads by source</CardTitle><CardDescription className="text-xs">Leads, by originating source</CardDescription></CardHeader>
            <CardContent>
              {leadsBySource.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={leadsBySource} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                    <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: CHART_AXIS }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={false} width={100} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip cursor={{ fill: 'rgba(42,120,214,0.06)' }} formatter={(v: any, _n: any, { payload }: any) => [`${v}% (${payload.count} lead${payload.count === 1 ? '' : 's'})`, 'Share']} />
                    <Bar dataKey="pct" fill={CHART_BLUE} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-12">No leads yet.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Source details</CardTitle><CardDescription className="text-xs">Leads and deals, rolled up per source</CardDescription></CardHeader>
          <CardContent>
            {sourceDetails.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-4 font-medium">Source</th>
                      <th className="py-2 px-4 font-medium text-right">MQL #</th>
                      <th className="py-2 px-4 font-medium text-right">SQL #</th>
                      <th className="py-2 px-4 font-medium text-right">Projected deal value</th>
                      <th className="py-2 px-4 font-medium text-right">Quotes</th>
                      <th className="py-2 pl-4 font-medium text-right">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceDetails.map((r) => (
                      <tr key={r.source} className="border-b last:border-0">
                        <td className="py-2 pr-4">{r.source}</td>
                        <td className="py-2 px-4 text-right">{r.mql}</td>
                        <td className="py-2 px-4 text-right">{r.sql}</td>
                        <td className="py-2 px-4 text-right">{formatMoney(r.projected)}</td>
                        <td className="py-2 px-4 text-right">{formatMoney(r.quotes)}</td>
                        <td className="py-2 pl-4 text-right font-medium">{formatMoney(r.bookings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-8">No leads or deals to attribute yet.</p>}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ===================== SALES FUNNEL ===================== */}
      <TabsContent value="funnel" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Kpi icon={CircleDollarSign} label="Open deal value" value={formatMoneyWhole(openPipeline)} sub={`${openDeals.length} open deal${openDeals.length === 1 ? '' : 's'}`} accent="bg-blue-100 text-blue-600" />
          <Kpi icon={PackageCheck} label="Booked value" value={formatMoneyWhole(wonValue)} accent="bg-green-100 text-green-600" />
          <Kpi icon={TrendingDown} label="Lost order value" value={formatMoneyWhole(lostValue)} accent="bg-red-100 text-red-600" />
          <Kpi icon={Percent} label="Win rate" value={`${winRate}%`} accent="bg-emerald-100 text-emerald-600" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Kpi icon={Calculator} label="Avg deal size" value={formatMoneyWhole(avgDealSize)} accent="bg-violet-100 text-violet-600" />
          <Kpi icon={TrendingUp} label="Open deals" value={openDeals.length} accent="bg-indigo-100 text-indigo-600" />
          <Kpi icon={CheckSquare} label="Open tasks" value={openTasks} accent="bg-amber-100 text-amber-600" />
          <Kpi icon={Users} label="Total leads" value={leads.length} accent="bg-cyan-100 text-cyan-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Pipeline value by stage</CardTitle><CardDescription className="text-xs">Open deals, excluding won and lost stages</CardDescription></CardHeader>
            <CardContent>
              {pipelineByStage.some((x) => x.value > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pipelineByStage}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                    <XAxis dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: CHART_AXIS }} />
                    <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip cursor={{ fill: 'rgba(42,120,214,0.06)' }} formatter={(v: any) => formatMoney(v)} />
                    <Bar dataKey="value" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-12">No open deals yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Leads by status</CardTitle><CardDescription className="text-xs">Leads, by current status</CardDescription></CardHeader>
            <CardContent>
              {leadsByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={leadsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {leadsByStatus.map((e) => <Cell key={e.name} fill={LEAD_COLORS[e.name] || '#9ca3af'} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-12">No leads yet.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avg days in stage</CardTitle>
            <CardDescription className="text-xs">Deals, from recorded stage changes</CardDescription>
          </CardHeader>
          <CardContent>
            {stageVelocity.some((x) => x.samples > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stageVelocity}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: CHART_AXIS }} />
                  <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} unit="d" />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip cursor={{ fill: 'rgba(42,120,214,0.06)' }} formatter={(v: any, _n: any, { payload }: any) => [`${v} days (${payload.samples} deal${payload.samples === 1 ? '' : 's'})`, 'Avg time in stage']} />
                  <Bar dataKey="days" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 text-center py-8">No stage transitions recorded yet. Move a deal on the pipeline board to start tracking.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent deals</CardTitle><CardDescription className="text-xs">Deals, newest first</CardDescription></CardHeader>
          <CardContent>
            {/* Two columns from `sm` up: a full-width row leaves a large gap between
                the deal name and the right-aligned status/amount.

                Capped + scrolling rather than tall: 20 deals is 10 rows on desktop and
                20 on a phone, which would otherwise run well past the fold and bury
                whatever follows. Same 420px cap as the Deals board's stage columns. */}
            <div className="max-h-[420px] overflow-y-auto overscroll-contain pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {deals.slice(0, RECENT_DEALS_LIMIT).map((d) => (
                  <div key={d.id} className={`flex items-center justify-between gap-3 p-2 border rounded-md cursor-pointer ${DEAL_ROW_CLASS[d.status ?? ''] || 'hover:bg-gray-50'}`} onClick={() => navigate(createPageUrl('DealDetail') + '?id=' + d.id)}>
                    {/* min-w-0 + truncate so a long name can't push the amount out of the narrower column */}
                    <span className="text-sm font-medium min-w-0 truncate" title={d.name}>{d.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs capitalize text-gray-500">{d.status}</span>
                      <span className="text-sm font-medium text-gray-800">{formatMoney(d.amount, d.currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {deals.length === 0 && <p className="text-sm text-gray-400">No deals yet.</p>}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ===================== MAP ===================== */}
      <TabsContent value="map" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Where customers &amp; leads are</CardTitle><CardDescription className="text-xs">Companies and leads that have coordinates</CardDescription></CardHeader>
          <CardContent>
            <CrmMap companies={companies} leads={leads} deals={deals} sources={sources} stages={stages} />
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}
