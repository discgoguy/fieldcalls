/**
 * Column specs for the CRM list pages' "Export CSV" buttons - one per entity.
 *
 * These live here rather than inline in each page so they're plain data (not
 * buried in a render body), unit-testable (`exportColumns.test.ts`), and free of
 * the per-row type annotations an inline array literal forces. The pages stay
 * thin: they own the filtering, then hand the visible rows to `exportCsv`.
 *
 * Entities whose readable form needs a name lookup (contact → company, deal →
 * company/stage) are exposed as **factories** taking the id→name maps the page
 * already holds - same shape as `opportunityColumns` in `crmExport.logic.ts`.
 * Missing/unknown ids resolve to an empty cell rather than leaking a raw UUID.
 *
 * Not to be confused with `src/pages/crmExport.logic.ts`, which maps the CRM onto
 * the Power BI semantic model. This module is only the list-view exports.
 */
import type {
  CrmCompanyRow,
  CrmContactRow,
  CrmDealRow,
  CrmLeadRow,
} from '@/api/entities';
import type { CsvColumn } from '@/lib/csv';

/** id → display-name map, as the list pages keep in state. */
export type NameMap = Record<string, string>;

/** Resolve an optional foreign id through a name map; '' when absent/unknown. */
function nameOf(map: NameMap, id: string | null | undefined): string {
  return id ? map[id] || '' : '';
}

/** Booleans read better as Yes/No than true/false in a spreadsheet. */
function yesNo(value: boolean | string | null | undefined): string {
  return value ? 'Yes' : 'No';
}

export const COMPANY_COLUMNS: CsvColumn<CrmCompanyRow>[] = [
  { header: 'Name', value: (c) => c.name },
  { header: 'Industry', value: (c) => c.industry },
  { header: 'Domain', value: (c) => c.domain },
  { header: 'Website', value: (c) => c.website },
  { header: 'Phone', value: (c) => c.phone },
  { header: 'Size', value: (c) => c.size },
  { header: 'Address', value: (c) => c.address },
  { header: 'City', value: (c) => c.city },
  { header: 'Region', value: (c) => c.region },
  { header: 'Postal Code', value: (c) => c.postal_code },
  { header: 'Country', value: (c) => c.country },
  { header: 'Notes', value: (c) => c.notes },
];

export const LEAD_COLUMNS: CsvColumn<CrmLeadRow>[] = [
  { header: 'Name', value: (l) => l.name },
  { header: 'Company', value: (l) => l.company_name },
  { header: 'Email', value: (l) => l.email },
  { header: 'Phone', value: (l) => l.phone },
  { header: 'Industry', value: (l) => l.industry },
  { header: 'Source', value: (l) => l.source },
  { header: 'Status', value: (l) => l.status },
  { header: 'MQL', value: (l) => yesNo(l.reached_mql) },
  { header: 'SQL', value: (l) => yesNo(l.reached_sql) },
  { header: 'Customer Country', value: (l) => l.customer_country },
  { header: 'End User', value: (l) => l.end_user_name },
  { header: 'End User Country', value: (l) => l.end_user_country },
  { header: 'Converted', value: (l) => yesNo(l.converted_at) },
  { header: 'Notes', value: (l) => l.notes },
];

/** Contacts resolve their company id through the page's name map. */
export function contactColumns(companyName: NameMap): CsvColumn<CrmContactRow>[] {
  return [
    { header: 'First Name', value: (c) => c.first_name },
    { header: 'Last Name', value: (c) => c.last_name },
    { header: 'Title', value: (c) => c.title },
    { header: 'Company', value: (c) => nameOf(companyName, c.company_id) },
    { header: 'Email', value: (c) => c.email },
    { header: 'Phone', value: (c) => c.phone },
    { header: 'Notes', value: (c) => c.notes },
  ];
}

/** Deals resolve both company and pipeline-stage ids through name maps. */
export function dealColumns(
  companyName: NameMap,
  stageName: NameMap,
): CsvColumn<CrmDealRow>[] {
  return [
    { header: 'Name', value: (d) => d.name },
    { header: 'Company', value: (d) => nameOf(companyName, d.company_id) },
    { header: 'Stage', value: (d) => nameOf(stageName, d.stage_id) },
    { header: 'Status', value: (d) => d.status },
    { header: 'Amount', value: (d) => d.amount },
    { header: 'Currency', value: (d) => d.currency },
    { header: 'Expected Close', value: (d) => d.expected_close_date },
    { header: 'Actual Close', value: (d) => d.actual_close_date },
    { header: 'Prequote Estimate', value: (d) => d.prequote_estimate_value },
    { header: 'Margin', value: (d) => d.margin_value },
    { header: 'OEM/Aftermarket', value: (d) => d.oem_or_aftermarket },
    { header: 'End User', value: (d) => d.end_user_name },
    { header: 'End User Country', value: (d) => d.end_user_country },
    { header: 'Notes', value: (d) => d.notes },
  ];
}
