// Pure KPI aggregation for the CRM Overview dashboard, extracted from
// CRMDashboard.tsx so the funnel math is unit-testable without React.
// No DOM / no data fetching - plain data in, plain data out.
//
// Also the single source of truth for the "Ask your CRM" chat route
// (api/crm.ts imports deriveCrmOverview), so the assistant's numbers always
// match the dashboard. Keep this module dependency-free: the import below is
// type-only (erased at build) and deliberately a relative path so the
// serverless bundler can resolve it without Vite's `@` alias.
import type {
  CrmDealRow,
  CrmPipelineStageRow,
  CrmLeadRow,
  CrmDealStageHistoryRow,
  CrmSourceRow,
  Row,
} from '../api/entities';

type QuoteRow = Row<'quotes'>;

/** Whole-number percentage of num/denom; 0 when the denominator is 0. */
export const pct = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 100) : 0);

/**
 * Average days deals spend in each stage, from stage-transition history.
 * A stay in stage S runs from the event that moved the deal INTO S until the
 * deal's next transition; for a deal still open in its latest stage, the stay
 * is counted up to `now`. Closed (won/lost) deals contribute no ongoing time.
 * `now` is injectable so the open-deal branch is deterministic in tests.
 */
export function avgDaysInStage(
  history: CrmDealStageHistoryRow[],
  deals: CrmDealRow[],
  stages: CrmPipelineStageRow[],
  now: Date = new Date(),
) {
  const byDeal: Record<string, CrmDealStageHistoryRow[]> = {};
  history.forEach((h) => { (byDeal[h.deal_id] ||= []).push(h); });
  const durations: Record<string, number[]> = {}; // stage_id -> [days]
  const dealById = Object.fromEntries(deals.map((d) => [d.id, d] as const));

  Object.entries(byDeal).forEach(([dealId, events]) => {
    events.sort((a, b) => new Date(a.created_date ?? 0).getTime() - new Date(b.created_date ?? 0).getTime());
    events.forEach((e, i) => {
      const start = new Date(e.created_date ?? 0);
      const next = events[i + 1];
      let end: Date;
      if (next) end = new Date(next.created_date ?? 0);
      else if (dealById[dealId]?.status === 'open') end = now;
      else return; // closed deal's final stage: no ongoing time
      const days = (end.getTime() - start.getTime()) / 86400000;
      if (days >= 0) (durations[e.to_stage_id] ||= []).push(days);
    });
  });

  return stages
    .filter((s) => !s.is_won && !s.is_lost)
    .map((s) => {
      const list = durations[s.id] || [];
      const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
      return { name: s.name, days: Math.round(avg * 10) / 10, samples: list.length };
    });
}

export interface CrmOverviewInput {
  deals: CrmDealRow[];
  stages: CrmPipelineStageRow[];
  leads: CrmLeadRow[];
  stageHistory: CrmDealStageHistoryRow[];
  sources: CrmSourceRow[];
  quotes: QuoteRow[];
}

/** All CRM Overview KPI aggregations. `now` is injectable for deterministic tests. */
export function deriveCrmOverview(
  { deals, stages, leads, stageHistory, sources, quotes }: CrmOverviewInput,
  now: Date = new Date(),
) {
  const openDeals = deals.filter((d) => d.status === 'open');
  const wonDeals = deals.filter((d) => d.status === 'won');
  const lostDeals = deals.filter((d) => d.status === 'lost');
  const openPipeline = openDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const wonValue = wonDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const lostValue = lostDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const closedCount = wonDeals.length + lostDeals.length;
  const winRate = pct(wonDeals.length, closedCount);
  const avgDealSize = openDeals.length > 0 ? openPipeline / openDeals.length : 0;

  // pipeline value by stage (open deals only, in stage order); bucket once
  const pipelineByStage = stages
    .filter((s) => !s.is_won && !s.is_lost)
    .map((s) => {
      const inStage = openDeals.filter((d) => d.stage_id === s.id);
      return { name: s.name, value: inStage.reduce((sum, d) => sum + (Number(d.amount) || 0), 0), count: inStage.length };
    });
  const leadsByStatus = ['new', 'working', 'qualified', 'disqualified']
    .map((st) => ({ name: st, value: leads.filter((l) => l.status === st).length }))
    .filter((x) => x.value > 0);
  const stageVelocity = avgDaysInStage(stageHistory, deals, stages, now);

  // ---- Lead Management funnel ----
  const mqlCount = leads.filter((l) => l.reached_mql).length;
  const sqlCount = leads.filter((l) => l.reached_sql).length;
  // Opportunities = SQL leads that produced a deal.
  const oppCount = leads.filter((l) => l.reached_sql && l.converted_deal_id).length;
  // Quoted (projected) value = prequote estimates across all opportunities.
  const quotedValue = deals.reduce((s, d) => s + (Number(d.prequote_estimate_value) || 0), 0);

  // New vs Existing customers (from lead flag)
  const existingCount = leads.filter((l) => l.customer_existing).length;
  const newExisting = leads.length
    ? [
        { name: 'New', value: leads.length - existingCount },
        { name: 'Existing', value: existingCount },
      ].filter((x) => x.value > 0)
    : [];

  // Leads by source (%) - bucket null source as "Unassigned"
  const sourceName = Object.fromEntries(sources.map((s) => [s.id, s.name] as const));
  const bySourceCount: Record<string, number> = {};
  leads.forEach((l) => {
    const key = l.source_id ? sourceName[l.source_id] || 'Unknown' : 'Unassigned';
    bySourceCount[key] = (bySourceCount[key] || 0) + 1;
  });
  const leadsBySource = Object.entries(bySourceCount)
    .map(([name, count]) => ({ name, count, pct: pct(count, leads.length) }))
    .sort((a, b) => b.count - a.count);

  // ---- Source Details table: leads, MQL#, SQL#, opps, projected quote value, quotes, bookings ----
  // (leads/opps aren't shown on the dashboard table but feed the chat route's
  // per-source rollup - one accumulator serves both consumers.)
  const quoteTotal = Object.fromEntries(quotes.map((q) => [q.id, Number(q.total_amount) || 0] as const));
  const leadSource = (l: CrmLeadRow) => (l.source_id ? sourceName[l.source_id] || 'Unknown' : 'Unassigned');
  const leadById = Object.fromEntries(leads.map((l) => [l.id, l] as const));
  // deal -> source (via its originating lead)
  const dealSource = (d: CrmDealRow) => {
    const lead = d.lead_id ? leadById[d.lead_id] : null;
    return lead ? leadSource(lead) : null;
  };
  const detailRows: Record<string, { source: string; leads: number; mql: number; sql: number; opps: number; projected: number; quotes: number; bookings: number }> = {};
  const row = (name: string) => (detailRows[name] ||= { source: name, leads: 0, mql: 0, sql: 0, opps: 0, projected: 0, quotes: 0, bookings: 0 });
  leads.forEach((l) => {
    const r = row(leadSource(l));
    r.leads += 1;
    if (l.reached_mql) r.mql += 1;
    if (l.reached_sql) r.sql += 1;
    if (l.reached_sql && l.converted_deal_id) r.opps += 1;
  });
  deals.forEach((d) => {
    const src = dealSource(d);
    if (!src) return; // deal not attributable to a source (no originating lead)
    const r = row(src);
    r.projected += Number(d.prequote_estimate_value) || 0;
    if (d.quote_id) r.quotes += quoteTotal[d.quote_id] || 0;
    if (d.status === 'won') r.bookings += Number(d.amount) || 0;
  });
  const sourceDetails = Object.values(detailRows).sort((a, b) => b.bookings - a.bookings || b.sql - a.sql);

  return {
    openDeals, wonDeals, lostDeals, openPipeline, wonValue, lostValue, winRate, avgDealSize,
    pipelineByStage, leadsByStatus, stageVelocity,
    mqlCount, sqlCount, oppCount, quotedValue, newExisting, leadsBySource, sourceDetails,
  };
}
