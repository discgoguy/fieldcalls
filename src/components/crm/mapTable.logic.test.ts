import { describe, expect, it } from 'vitest';
import type { CrmDealRow, CrmPipelineStageRow } from '@/api/entities';
import {
  buildMapTableRows,
  normalizeCurrency,
  rowKey,
  summarizeMapTable,
  type MapTableRecord,
} from './mapTable.logic';

const company = (id: string, extra: Partial<MapTableRecord> = {}): MapTableRecord => ({
  id, kind: 'company', name: id, sub: '', status: null, region: null, country: null,
  color: '#2a78d6', href: null, ...extra,
});
const lead = (id: string, extra: Partial<MapTableRecord> = {}): MapTableRecord => ({
  ...company(id, extra), kind: 'lead', color: '#64748b',
});

const deal = (o: Partial<CrmDealRow>): CrmDealRow => ({
  id: 'd', name: 'Deal', status: 'open', amount: 0, currency: 'CAD', ...o,
} as CrmDealRow);

const stage = (id: string, name: string): CrmPipelineStageRow => ({ id, name } as CrmPipelineStageRow);

const build = (
  visible: MapTableRecord[],
  deals: CrmDealRow[],
  dealStatus = 'all',
  stages: CrmPipelineStageRow[] = [],
) => buildMapTableRows({ visible, deals, stages, dealStatus });

describe('rowKey', () => {
  it('builds `${kind}-${id}`, matching the marker key', () => {
    expect(rowKey({ kind: 'company', id: 'c1' })).toBe('company-c1');
    expect(rowKey({ kind: 'lead', id: 'c1' })).toBe('lead-c1');
  });
});

describe('normalizeCurrency', () => {
  it("upper-cases and trims, so 'cad' and 'CAD ' are one currency", () => {
    expect(normalizeCurrency('cad')).toBe('CAD');
    expect(normalizeCurrency('CAD ')).toBe('CAD');
  });

  it('falls back to CAD for null, undefined and blank', () => {
    expect(normalizeCurrency(null)).toBe('CAD');
    expect(normalizeCurrency(undefined)).toBe('CAD');
    expect(normalizeCurrency('   ')).toBe('CAD');
  });
});

describe('buildMapTableRows - matching', () => {
  it("attaches a company's deals by company_id and a lead's by lead_id", () => {
    const rows = build(
      [company('c1'), lead('l1')],
      [
        deal({ id: 'd1', company_id: 'c1', amount: 200 }),
        deal({ id: 'd2', lead_id: 'l1', amount: 100 }),
      ],
    );
    expect(rows.map((r) => [r.key, r.deals.map((d) => d.id)])).toEqual([
      ['company-c1', ['d1']],
      ['lead-l1', ['d2']],
    ]);
  });

  it('lists a converted deal under both its company row and its lead row (both ids set)', () => {
    const rows = build([company('c1'), lead('l1')], [deal({ id: 'd1', company_id: 'c1', lead_id: 'l1', amount: 50 })]);
    expect(rows.every((r) => r.deals.map((d) => d.id).join() === 'd1')).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('gives a record with no linked deals an empty row (dealCount 0, no totals)', () => {
    const [row] = build([company('c1')], []);
    expect(row.deals).toEqual([]);
    expect(row.dealCount).toBe(0);
    expect(row.totals).toEqual([]);
    expect(row.totalValue).toBe(0);
  });

  it("ignores deals belonging to records that aren't visible", () => {
    const [row] = build([company('c1')], [deal({ id: 'd1', company_id: 'other', amount: 900 })]);
    expect(row.dealCount).toBe(0);
  });
});

describe('buildMapTableRows - deal-status narrowing', () => {
  const deals = [
    deal({ id: 'open1', company_id: 'c1', status: 'open', amount: 10 }),
    deal({ id: 'won1', company_id: 'c1', status: 'won', amount: 20 }),
    deal({ id: 'null1', company_id: 'c1', status: null, amount: 30 }),
  ];

  it('lists every linked deal when the deal status is ANY', () => {
    const [row] = build([company('c1')], deals, 'all');
    expect(row.deals.map((d) => d.id).sort()).toEqual(['null1', 'open1', 'won1']);
  });

  it('lists only won deals for a row when the filter is "won"', () => {
    const [row] = build([company('c1')], deals, 'won');
    expect(row.deals.map((d) => d.id)).toEqual(['won1']);
    expect(row.dealCount).toBe(1);
  });

  it('drops null-status deals when a status filter is active but keeps them under ANY', () => {
    expect(build([company('c1')], deals, 'open')[0].deals.map((d) => d.id)).toEqual(['open1']);
    expect(build([company('c1')], deals, 'all')[0].deals.some((d) => d.id === 'null1')).toBe(true);
  });
});

describe('buildMapTableRows - stages', () => {
  it('resolves stage_id to a stage name', () => {
    const [row] = build([company('c1')], [deal({ id: 'd1', company_id: 'c1', stage_id: 's1' })], 'all', [stage('s1', 'Quoting')]);
    expect(row.deals[0].stageName).toBe('Quoting');
  });

  it('leaves stageName null for a missing or unknown stage_id (never leaks a uuid)', () => {
    const rows = build(
      [company('c1')],
      [
        deal({ id: 'd1', company_id: 'c1', stage_id: null, amount: 2 }),
        deal({ id: 'd2', company_id: 'c1', stage_id: 'gone', amount: 1 }),
      ],
      'all',
      [stage('s1', 'Quoting')],
    );
    expect(rows[0].deals.map((d) => d.stageName)).toEqual([null, null]);
  });
});

describe('buildMapTableRows - amounts & currency', () => {
  it('coerces null/blank/string amounts through Number(x) || 0', () => {
    const [row] = build([company('c1')], [
      deal({ id: 'd1', company_id: 'c1', amount: null }),
      deal({ id: 'd2', company_id: 'c1', amount: '' as unknown as number }),
      deal({ id: 'd3', company_id: 'c1', amount: '125.5' as unknown as number }),
    ]);
    expect(row.deals.map((d) => d.amount).sort((a, b) => a - b)).toEqual([0, 0, 125.5]);
    expect(row.totalValue).toBe(125.5);
  });

  it('keeps per-currency subtotals apart instead of blending them', () => {
    const [row] = build([company('c1')], [
      deal({ id: 'd1', company_id: 'c1', amount: 100, currency: 'CAD' }),
      deal({ id: 'd2', company_id: 'c1', amount: 50, currency: 'usd' }),
      deal({ id: 'd3', company_id: 'c1', amount: 25, currency: 'CAD ' }),
    ]);
    expect(row.totals).toEqual([{ currency: 'CAD', amount: 125 }, { currency: 'USD', amount: 50 }]);
  });

  it('orders totals by amount desc', () => {
    const [row] = build([company('c1')], [
      deal({ id: 'd1', company_id: 'c1', amount: 10, currency: 'CAD' }),
      deal({ id: 'd2', company_id: 'c1', amount: 90, currency: 'EUR' }),
    ]);
    expect(row.totals.map((t) => t.currency)).toEqual(['EUR', 'CAD']);
  });

  it('uses the deal amount for leads, not prequote_estimate_value', () => {
    const [row] = build([lead('l1')], [deal({ id: 'd1', lead_id: 'l1', amount: 400, prequote_estimate_value: 9000 })]);
    expect(row.deals[0].amount).toBe(400);
    expect(row.totalValue).toBe(400);
  });
});

describe('buildMapTableRows - ordering', () => {
  it('sorts rows by total value desc', () => {
    const rows = build([company('c1', { name: 'Small' }), company('c2', { name: 'Big' })], [
      deal({ id: 'd1', company_id: 'c1', amount: 10 }),
      deal({ id: 'd2', company_id: 'c2', amount: 1000 }),
    ]);
    expect(rows.map((r) => r.record.name)).toEqual(['Big', 'Small']);
  });

  it('breaks a value tie on name, case-insensitively', () => {
    const rows = build([company('c1', { name: 'beta' }), company('c2', { name: 'Alpha' })], []);
    expect(rows.map((r) => r.record.name)).toEqual(['Alpha', 'beta']);
  });

  it("sorts a row's deals by amount desc, then newest first", () => {
    const [row] = build([company('c1')], [
      deal({ id: 'd1', company_id: 'c1', amount: 100, created_date: '2026-01-01' }),
      deal({ id: 'd2', company_id: 'c1', amount: 500 }),
      deal({ id: 'd3', company_id: 'c1', amount: 100, created_date: '2026-05-01' }),
    ]);
    expect(row.deals.map((d) => d.id)).toEqual(['d2', 'd3', 'd1']);
  });

  it('is deterministic for two rows with the same value and name', () => {
    const records = [company('c2', { name: 'Same' }), company('c1', { name: 'Same' })];
    const keys = build(records, []).map((r) => r.key);
    expect(keys).toEqual(['company-c1', 'company-c2']);
    expect(build([...records].reverse(), []).map((r) => r.key)).toEqual(keys);
  });
});

describe('summarizeMapTable', () => {
  it('counts records and distinct deals', () => {
    const rows = build([company('c1'), lead('l1')], [
      deal({ id: 'd1', company_id: 'c1', amount: 10 }),
      deal({ id: 'd2', company_id: 'c1', amount: 20 }),
      deal({ id: 'd3', lead_id: 'l1', amount: 30 }),
    ]);
    expect(summarizeMapTable(rows)).toMatchObject({ recordCount: 2, dealCount: 3 });
  });

  it('counts a company+lead-linked deal once, not twice', () => {
    const rows = build([company('c1'), lead('l1')], [deal({ id: 'd1', company_id: 'c1', lead_id: 'l1', amount: 40 })]);
    expect(rows.reduce((n, r) => n + r.dealCount, 0)).toBe(2);
    expect(summarizeMapTable(rows)).toEqual({
      recordCount: 2,
      dealCount: 1,
      totals: [{ currency: 'CAD', amount: 40 }],
    });
  });

  it('totals per currency across rows', () => {
    const rows = build([company('c1'), company('c2')], [
      deal({ id: 'd1', company_id: 'c1', amount: 100, currency: 'CAD' }),
      deal({ id: 'd2', company_id: 'c2', amount: 300, currency: 'USD' }),
      deal({ id: 'd3', company_id: 'c2', amount: 50, currency: 'cad' }),
    ]);
    expect(summarizeMapTable(rows).totals).toEqual([
      { currency: 'USD', amount: 300 },
      { currency: 'CAD', amount: 150 },
    ]);
  });

  it('returns zeros and no totals for an empty row list', () => {
    expect(summarizeMapTable([])).toEqual({ recordCount: 0, dealCount: 0, totals: [] });
  });
});
