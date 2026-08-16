import { describe, it, expect } from 'vitest';
import { pct, avgDaysInStage, deriveCrmOverview } from './crmDashboard.logic';
import type {
  CrmDealRow,
  CrmPipelineStageRow,
  CrmLeadRow,
  CrmDealStageHistoryRow,
  CrmSourceRow,
  Row,
} from '@/api/entities';

// Test fixtures are intentionally partial - the aggregation only reads a handful
// of columns per row, so we cast minimal objects to the wide generated Row types.
const deal = (o: Partial<CrmDealRow>) => o as CrmDealRow;
const stage = (o: Partial<CrmPipelineStageRow>) => o as CrmPipelineStageRow;
const lead = (o: Partial<CrmLeadRow>) => o as CrmLeadRow;
const hist = (o: Partial<CrmDealStageHistoryRow>) => o as CrmDealStageHistoryRow;
const source = (o: Partial<CrmSourceRow>) => o as CrmSourceRow;
const quote = (o: Partial<Row<'quotes'>>) => o as Row<'quotes'>;

describe('pct', () => {
  it('rounds to a whole percent', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(1, 2)).toBe(50);
  });
  it('is 0 when the denominator is 0 (no divide-by-zero)', () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(0, 0)).toBe(0);
  });
});

describe('deriveCrmOverview - deal value KPIs', () => {
  const stages = [
    stage({ id: 's1', name: 'New', sort_order: 1, is_won: false, is_lost: false }),
    stage({ id: 'sw', name: 'Won', sort_order: 2, is_won: true, is_lost: false }),
    stage({ id: 'sl', name: 'Lost', sort_order: 3, is_won: false, is_lost: true }),
  ];
  const deals = [
    deal({ id: 'd1', status: 'won', amount: 500, stage_id: 'sw', prequote_estimate_value: 1000, lead_id: 'L1', quote_id: 'q1' }),
    deal({ id: 'd2', status: 'open', amount: 300, stage_id: 's1', prequote_estimate_value: 0, lead_id: null }),
    deal({ id: 'd3', status: 'lost', amount: 200, stage_id: 'sl', prequote_estimate_value: 0, lead_id: null }),
  ];
  const leads = [
    lead({ id: 'L1', status: 'qualified', reached_mql: true, reached_sql: true, converted_deal_id: 'd1', customer_existing: true, source_id: 'src1' }),
    lead({ id: 'L2', status: 'new', reached_mql: true, reached_sql: false, converted_deal_id: null, customer_existing: false, source_id: null }),
  ];
  const sources = [source({ id: 'src1', name: 'Website' })];
  const quotes = [quote({ id: 'q1', total_amount: 800 })];
  const r = deriveCrmOverview({ deals, stages, leads, stageHistory: [], sources, quotes });

  it('splits pipeline / won / lost values', () => {
    expect(r.openPipeline).toBe(300);
    expect(r.wonValue).toBe(500);
    expect(r.lostValue).toBe(200);
  });
  it('win rate = won / (won + lost), ignoring open deals', () => {
    expect(r.winRate).toBe(50); // 1 won, 1 lost
  });
  it('avg deal size is over OPEN deals only', () => {
    expect(r.avgDealSize).toBe(300);
  });
  it('quoted value sums prequote estimates across all deals', () => {
    expect(r.quotedValue).toBe(1000);
  });
  it('pipeline-by-stage excludes won/lost stages and buckets open deals', () => {
    expect(r.pipelineByStage).toEqual([{ name: 'New', value: 300, count: 1 }]);
  });
});

describe('deriveCrmOverview - lead funnel', () => {
  const leads = [
    lead({ id: 'L1', status: 'qualified', reached_mql: true, reached_sql: true, converted_deal_id: 'd1', customer_existing: true }),
    lead({ id: 'L2', status: 'new', reached_mql: true, reached_sql: true, converted_deal_id: null, customer_existing: false }),
    lead({ id: 'L3', status: 'working', reached_mql: true, reached_sql: false, converted_deal_id: null, customer_existing: false }),
    lead({ id: 'L4', status: 'new', reached_mql: false, reached_sql: false, converted_deal_id: null, customer_existing: false }),
  ];
  const r = deriveCrmOverview({ deals: [], stages: [], leads, stageHistory: [], sources: [], quotes: [] });

  it('counts MQL, SQL and Opp (SQL leads that produced a deal)', () => {
    expect(r.mqlCount).toBe(3);       // L1,L2,L3
    expect(r.sqlCount).toBe(2);       // L1,L2
    expect(r.oppCount).toBe(1);       // only L1 has a converted_deal_id
  });
  it('new vs existing drops zero buckets', () => {
    // 1 existing (L1), 3 new
    expect(r.newExisting).toEqual([{ name: 'New', value: 3 }, { name: 'Existing', value: 1 }]);
  });
  it('leads-by-status omits statuses with no leads', () => {
    expect(r.leadsByStatus).toEqual([
      { name: 'new', value: 2 },
      { name: 'working', value: 1 },
      { name: 'qualified', value: 1 },
    ]);
  });
});

describe('deriveCrmOverview - leads by source', () => {
  const sources = [source({ id: 'src1', name: 'Website' }), source({ id: 'src2', name: 'Referral' })];
  const leads = [
    lead({ id: 'L1', source_id: 'src1' }),
    lead({ id: 'L2', source_id: 'src1' }),
    lead({ id: 'L3', source_id: 'src2' }),
    lead({ id: 'L4', source_id: null }), // -> Unassigned
  ];
  const r = deriveCrmOverview({ deals: [], stages: [], leads, stageHistory: [], sources, quotes: [] });

  it('groups by source name, buckets null as Unassigned, sorts by count desc, with %', () => {
    expect(r.leadsBySource).toEqual([
      { name: 'Website', count: 2, pct: 50 },
      { name: 'Referral', count: 1, pct: 25 },
      { name: 'Unassigned', count: 1, pct: 25 },
    ]);
  });
});

describe('deriveCrmOverview - source details table', () => {
  const sources = [source({ id: 'src1', name: 'Website' })];
  const leads = [
    lead({ id: 'L1', source_id: 'src1', reached_mql: true, reached_sql: true }),
    lead({ id: 'L2', source_id: null, reached_mql: true, reached_sql: false }), // Unassigned
  ];
  const deals = [
    deal({ id: 'd1', status: 'won', amount: 500, prequote_estimate_value: 1000, lead_id: 'L1', quote_id: 'q1' }),
    deal({ id: 'd2', status: 'open', amount: 300, prequote_estimate_value: 400, lead_id: null }), // no source -> excluded
  ];
  const quotes = [quote({ id: 'q1', total_amount: 800 })];
  const r = deriveCrmOverview({ deals, stages: [], leads, stageHistory: [], sources, quotes });

  it('attributes leads/MQL/SQL/opps/projected/quotes/bookings per source, sorted by bookings desc', () => {
    expect(r.sourceDetails).toEqual([
      // L1 reached SQL but has no converted_deal_id, so it counts as SQL, not opp
      { source: 'Website', leads: 1, mql: 1, sql: 1, opps: 0, projected: 1000, quotes: 800, bookings: 500 },
      { source: 'Unassigned', leads: 1, mql: 1, sql: 0, opps: 0, projected: 0, quotes: 0, bookings: 0 },
    ]);
  });

  it('does not attribute deals with no originating lead to any source', () => {
    // d2 (lead_id null, amount 300) must not appear in any row's projected/bookings
    const total = r.sourceDetails.reduce((s, row) => s + row.projected, 0);
    expect(total).toBe(1000); // only d1's prequote, not d2's 400
  });
});

describe('avgDaysInStage', () => {
  const stages = [
    stage({ id: 's1', name: 'New', sort_order: 1, is_won: false, is_lost: false }),
    stage({ id: 's2', name: 'Qualified', sort_order: 2, is_won: false, is_lost: false }),
    stage({ id: 'sw', name: 'Won', sort_order: 3, is_won: true, is_lost: false }),
  ];
  const now = new Date('2026-01-06T00:00:00Z'); // fixed "now" so the open-deal branch is deterministic
  const deals = [
    deal({ id: 'd1', status: 'open' }),
    deal({ id: 'd2', status: 'won' }),
  ];
  const history = [
    // d1 (open): New on day 0, Qualified on day 2 -> New = 2d, Qualified = (now - day2) = 3d
    hist({ deal_id: 'd1', to_stage_id: 's1', created_date: '2026-01-01T00:00:00Z' }),
    hist({ deal_id: 'd1', to_stage_id: 's2', created_date: '2026-01-03T00:00:00Z' }),
    // d2 (won): Qualified on day 0, Won on day 1 -> Qualified = 1d; Won stay has no ongoing time
    hist({ deal_id: 'd2', to_stage_id: 's2', created_date: '2026-01-01T00:00:00Z' }),
    hist({ deal_id: 'd2', to_stage_id: 'sw', created_date: '2026-01-02T00:00:00Z' }),
  ];

  it('averages time per stage, counts open deals up to `now`, and excludes won/lost stages', () => {
    const result = avgDaysInStage(history, deals, stages, now);
    expect(result).toEqual([
      { name: 'New', days: 2, samples: 1 },        // d1 only
      { name: 'Qualified', days: 2, samples: 2 },  // d1: 3d (to now) + d2: 1d -> avg 2
    ]);
  });

  it('a closed deal contributes no ongoing time to its final stage', () => {
    // d2's Won stay is dropped (no next event, deal not open) - and Won is filtered anyway.
    const result = avgDaysInStage(history, deals, stages, now);
    expect(result.find((s) => s.name === 'Won')).toBeUndefined();
  });
});
