// Pure derivation for the map's table explorer, extracted from CrmMap.tsx so the
// row/deal matching, the deal-status narrowing and the currency rules are
// unit-testable without React or Leaflet.
import { ANY } from './mapFilters';
import type { CrmDealRow, CrmPipelineStageRow } from '@/api/entities';

/**
 * The subset of a plotted map point the table needs. Declared structurally (rather
 * than importing MapPoint) so this module stays free of the component; CrmMap's
 * MapPoint is a superset and assigns to it directly.
 */
export interface MapTableRecord {
  id: string;
  kind: 'company' | 'lead';
  name: string;
  sub: string;
  status: string | null;
  region: string | null;
  country: string | null;
  color: string;
  href: string | null;
}

/** One deal as the table renders it. `stageName` is null when unknown/missing. */
export interface MapTableDeal {
  id: string;
  name: string;
  status: string | null;
  stageName: string | null;
  amount: number;
  currency: string;
  createdDate: string | null;
}

/** Per-currency subtotal. Never summed across currencies for display. */
export interface CurrencyTotal {
  currency: string;
  amount: number;
}

export interface MapTableRow {
  /** Stable React key, matches the marker key: `${kind}-${id}`. */
  key: string;
  record: MapTableRecord;
  /** This record's deals, already narrowed by the applied deal-status filter. */
  deals: MapTableDeal[];
  dealCount: number;
  /**
   * Raw cross-currency sum. SORT KEY ONLY - never render it. Display goes through
   * `totals`, which keeps currencies apart.
   */
  totalValue: number;
  /** Per-currency subtotals, descending by amount. Empty when the row has no deals. */
  totals: CurrencyTotal[];
}

export interface MapTableSummary {
  recordCount: number;
  /** Distinct deal ids across all rows - a deal linked to both a plotted company and its plotted lead counts once. */
  dealCount: number;
  totals: CurrencyTotal[];
}

/** `${kind}-${id}` - the same key the map uses for its markers. */
export function rowKey(record: Pick<MapTableRecord, 'kind' | 'id'>): string {
  return `${record.kind}-${record.id}`;
}

/**
 * Normalize crm_deals.currency for grouping: trimmed + upper-cased, blank/null ->
 * 'CAD' (the column default). It's free text, so 'cad' and 'CAD ' must not split a
 * total into two visually identical lines.
 */
export function normalizeCurrency(currency: string | null | undefined): string {
  return (currency || '').trim().toUpperCase() || 'CAD';
}

/** Group deal amounts by currency, biggest subtotal first. */
function currencyTotals(deals: MapTableDeal[]): CurrencyTotal[] {
  const by = new Map<string, number>();
  for (const d of deals) by.set(d.currency, (by.get(d.currency) ?? 0) + d.amount);
  return Array.from(by, ([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount || a.currency.localeCompare(b.currency));
}

/**
 * One row per visible record, with that record's deals attached.
 *
 * Matching: a company row takes deals where `company_id === record.id`; a lead row
 * takes deals where `lead_id === record.id`. Deliberately NOT de-duped across rows -
 * `convert_lead` writes both ids on one deal, so a converted deal legitimately shows
 * under its company AND its lead. `summarizeMapTable` de-dupes for the headline.
 *
 * `dealStatus` is the APPLIED deal-status filter (pass `applied.dealStatus`, never
 * raw state). `ANY` lists every linked deal; any other value keeps only deals whose
 * `status` matches exactly - so an expanded row shows "the deals included in the
 * search criteria" and nothing else. A null-status deal is therefore only listed
 * under `ANY`.
 */
export function buildMapTableRows(input: {
  visible: MapTableRecord[];
  deals: CrmDealRow[];
  stages: CrmPipelineStageRow[];
  dealStatus: string;
}): MapTableRow[] {
  const { visible, deals, stages, dealStatus } = input;
  const stageName = new Map(stages.map((s) => [s.id, s.name]));

  // Index once, then O(1) per row - the dashboard loads every deal, so a scan per
  // visible record would be quadratic. The status filter is applied here, before
  // indexing, so a narrowed row can only ever see matching deals.
  const byCompany = new Map<string, CrmDealRow[]>();
  const byLead = new Map<string, CrmDealRow[]>();
  const push = (m: Map<string, CrmDealRow[]>, id: string, d: CrmDealRow) => {
    const list = m.get(id);
    if (list) list.push(d);
    else m.set(id, [d]);
  };
  for (const d of deals) {
    if (dealStatus !== ANY && d.status !== dealStatus) continue;
    if (d.company_id) push(byCompany, d.company_id, d);
    if (d.lead_id) push(byLead, d.lead_id, d);
  }

  // The deal's own `amount` - not `prequote_estimate_value`, which the lead marker
  // uses for sizing. The table lists actual deal rows, and every other per-deal
  // surface shows formatMoney(amount, currency).
  const toDeal = (d: CrmDealRow): MapTableDeal => ({
    id: d.id,
    name: d.name,
    status: d.status ?? null,
    stageName: d.stage_id ? (stageName.get(d.stage_id) ?? null) : null,
    amount: Number(d.amount) || 0,
    currency: normalizeCurrency(d.currency),
    createdDate: d.created_date ?? null,
  });

  const rows = visible.map((record) => {
    const source = (record.kind === 'company' ? byCompany.get(record.id) : byLead.get(record.id)) ?? [];
    // Biggest first, mirroring the row ordering, so the total is explained at a glance.
    const rowDeals = source.map(toDeal).sort((a, b) => (
      b.amount - a.amount
      || (b.createdDate ?? '').localeCompare(a.createdDate ?? '')
      || a.id.localeCompare(b.id)
    ));
    return {
      key: rowKey(record),
      record,
      deals: rowDeals,
      dealCount: rowDeals.length,
      totalValue: rowDeals.reduce((s, d) => s + d.amount, 0),
      totals: currencyTotals(rowDeals),
    };
  });

  // Sorted by the row total (what the table shows), not the marker's value: with a
  // deal-status filter the two differ - filter to Won and the marker value is still
  // open pipeline. Name then key break ties, so the order is fully deterministic.
  return rows.sort((a, b) => (
    b.totalValue - a.totalValue
    || a.record.name.localeCompare(b.record.name, undefined, { sensitivity: 'base' })
    || a.key.localeCompare(b.key)
  ));
}

/**
 * Headline counts for the table caption. Deals are de-duped by id first, so a deal
 * carrying both a company_id and a lead_id (a converted lead) counts once even
 * though it is listed under both rows.
 */
export function summarizeMapTable(rows: MapTableRow[]): MapTableSummary {
  const distinct = new Map<string, MapTableDeal>();
  for (const row of rows) for (const d of row.deals) if (!distinct.has(d.id)) distinct.set(d.id, d);
  return {
    recordCount: rows.length,
    dealCount: distinct.size,
    totals: currencyTotals([...distinct.values()]),
  };
}
