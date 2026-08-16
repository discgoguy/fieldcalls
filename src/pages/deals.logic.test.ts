import { describe, it, expect } from 'vitest';
import { groupDealsByStage, stageTotal, latestStageEntryByDeal } from './deals.logic';
import type { CrmDealRow, CrmPipelineStageRow, CrmDealStageHistoryRow } from '@/api/entities';

const deal = (o: Partial<CrmDealRow>) => o as CrmDealRow;
const stage = (o: Partial<CrmPipelineStageRow>) => o as CrmPipelineStageRow;
const hist = (o: Partial<CrmDealStageHistoryRow>) => o as CrmDealStageHistoryRow;

describe('groupDealsByStage', () => {
  const stages = [stage({ id: 's1', name: 'New' }), stage({ id: 's2', name: 'Won' })];

  it('buckets each deal into its stage; empty stages get an empty array', () => {
    const deals = [deal({ id: 'd1', stage_id: 's1' }), deal({ id: 'd2', stage_id: 's2' }), deal({ id: 'd3', stage_id: 's1' })];
    const map = groupDealsByStage(stages, deals);
    expect(map.s1.map((d) => d.id)).toEqual(['d1', 'd3']);
    expect(map.s2.map((d) => d.id)).toEqual(['d2']);
  });

  it('drops a deal with missing or unknown stage_id into the FIRST stage (never lost)', () => {
    const deals = [deal({ id: 'd1', stage_id: null }), deal({ id: 'd2', stage_id: 'ghost' })];
    const map = groupDealsByStage(stages, deals);
    expect(map.s1.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(map.s2).toEqual([]);
  });

  it('with no stages, produces an empty map (deals have nowhere to go)', () => {
    expect(groupDealsByStage([], [deal({ id: 'd1', stage_id: 's1' })])).toEqual({});
  });
});

describe('stageTotal', () => {
  it('sums amounts, coercing strings and ignoring null/garbage', () => {
    expect(stageTotal([deal({ amount: 100 }), deal({ amount: '50' as unknown as number }), deal({ amount: null }), deal({})])).toBe(150);
  });
  it('is 0 for an empty column', () => {
    expect(stageTotal([])).toBe(0);
  });
});

describe('latestStageEntryByDeal', () => {
  it('keeps the latest entry per deal (ascending input → last write wins) and skips undated rows', () => {
    const history = [
      hist({ deal_id: 'a', created_date: '2026-01-01T00:00:00Z' }),
      hist({ deal_id: 'a', created_date: '2026-01-05T00:00:00Z' }), // later → wins
      hist({ deal_id: 'b', created_date: '2026-01-02T00:00:00Z' }),
      hist({ deal_id: 'c', created_date: null }),                    // undated → skipped
    ];
    expect(latestStageEntryByDeal(history)).toEqual({
      a: '2026-01-05T00:00:00Z',
      b: '2026-01-02T00:00:00Z',
    });
  });

  it('is empty for empty history', () => {
    expect(latestStageEntryByDeal([])).toEqual({});
  });
});
