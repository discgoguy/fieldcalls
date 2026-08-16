/**
 * Builds the CRM "Export all" dataset - a zip of CSVs mapped to the **Lead
 * Management & Sales Funnel** Power BI semantic model (Source / Campaign / Lead /
 * Opportunity / BU / Geography / AOP). Pure/serializable (no DOM, no zip) so it's
 * unit-tested; the component handles zipping + download.
 *
 * Scope assumption: this is the export for a **single business unit, "FieldCalls"**,
 * so `BU` is one row and every Lead/Opportunity's `BU Lvl2 Key` points at it.
 *
 * Model tables intentionally NOT emitted from here:
 *  - Date        → the model builds this in DAX/PowerQuery ("not needed in [source]").
 *  - AOP         → no annual-operating-plan/target data exists yet (header-only file).
 *  - Geography   → emitted as the distinct country values present in the data, but
 *                  without ISO 3166 codes/regions (the model expects those enriched
 *                  outside - see README in the zip).
 *
 * Keys are PartSync UUID strings (the model diagram shows integer surrogates); they
 * still form valid text relationships in Power BI.
 */
import type {
  CrmSourceRow,
  CrmCampaignRow,
  CrmLeadRow,
  CrmDealRow,
  CrmPipelineStageRow,
  CrmCompanyRow,
} from '@/api/entities';
import { toCsv, type CsvColumn } from '@/lib/csv';

export interface ExportFile {
  name: string;
  content: string;
}

export interface CrmExportInput {
  sources: CrmSourceRow[];
  campaigns: CrmCampaignRow[];
  leads: CrmLeadRow[];
  deals: CrmDealRow[];
  stages: CrmPipelineStageRow[];
  companies: CrmCompanyRow[];
}

// Single-BU export.
const BU_KEY = 1;
const BU_NAME = 'FieldCalls';

/** Whole+fractional days between two ISO timestamps; null if either is missing. */
export function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round(((end - start) / 86_400_000) * 100) / 100;
}

/** Margin as a percentage of deal value; null when value is missing/zero. */
export function marginPercent(marginValue: number | null, amount: number | null): number | null {
  if (marginValue == null || !amount) return null;
  return Math.round((marginValue / amount) * 100 * 100) / 100;
}

// ---- Source ----
const SOURCE_COLUMNS: CsvColumn<CrmSourceRow>[] = [
  { header: 'Source Key', value: (s) => s.id },
  { header: 'Source Name', value: (s) => s.name },
  { header: 'Source Type', value: (s) => s.source_type ?? '' },
  { header: 'Total Cost', value: (s) => s.total_cost ?? '' },
];

// ---- Campaign ----
const CAMPAIGN_COLUMNS: CsvColumn<CrmCampaignRow>[] = [
  { header: 'Campaign ID', value: (c) => c.id },
  { header: 'Campaign Name', value: (c) => c.name },
  { header: 'Source ID', value: (c) => c.source_id ?? '' },
  { header: 'Campaign Start Date', value: (c) => c.start_date ?? '' },
  { header: 'Campaign End Date', value: (c) => c.end_date ?? '' },
];

// ---- BU (single row: FieldCalls) ----
const BU_COLUMNS: CsvColumn<Record<string, string | number>>[] = [
  { header: 'BU Lvl2 Key', value: (r) => r['key'] },
  { header: 'BU Lvl2 Name', value: (r) => r['lvl2'] },
  { header: 'BU Lvl1 Name', value: (r) => r['lvl1'] },
  { header: 'Order', value: (r) => r['order'] },
];
const BU_ROWS = [{ key: BU_KEY, lvl2: BU_NAME, lvl1: BU_NAME, order: 1 }];

// ---- Lead ----
// Durations (in days) are computed best-effort from the milestone timestamp chain
// PartSync stores. Documented in the zip README; the ones without a clear source
// timestamp (Sales Lead Qual, Contact 1, all Aftermarket) are left blank on purpose.
const LEAD_COLUMNS: CsvColumn<CrmLeadRow>[] = [
  { header: 'Lead Key', value: (l) => l.id },
  { header: 'Lead Name', value: (l) => l.name ?? '' },
  { header: 'BU Lvl2 Key', value: () => BU_KEY },
  { header: 'Source Key', value: (l) => l.source_id ?? '' },
  { header: 'Campaign ID', value: (l) => l.campaign_id ?? '' },
  { header: 'Lead Creation Date', value: (l) => l.created_date ?? '' },
  { header: 'Customer Name', value: (l) => l.company_name ?? '' },
  { header: 'Customer Existing', value: (l) => (l.customer_existing == null ? '' : l.customer_existing) },
  { header: 'Customer Country', value: (l) => l.customer_country ?? '' },
  { header: 'End User', value: (l) => l.end_user_name ?? '' },
  { header: 'End User Country', value: (l) => l.end_user_country ?? '' },
  { header: 'Current Status', value: (l) => l.status ?? '' },
  { header: 'Reached MQL', value: (l) => (l.reached_mql == null ? '' : l.reached_mql) },
  { header: 'MQL Date', value: (l) => l.mql_date ?? '' },
  { header: 'Reached SQL', value: (l) => (l.reached_sql == null ? '' : l.reached_sql) },
  { header: 'SQL Date', value: (l) => l.sql_date ?? '' },
  { header: 'Final State', value: (l) => l.final_state ?? '' },
  { header: 'Final State Date', value: (l) => l.final_state_date ?? '' },
  { header: 'Duration in Data Load', value: (l) => daysBetween(l.data_loaded_at, l.acknowledged_at) ?? '' },
  { header: 'Duration in Load to CRM & Acknowledge', value: (l) => daysBetween(l.acknowledged_at, l.assigned_to_sales_at) ?? '' },
  { header: 'Duration in Lead Pre-qual & Assign to Sales', value: (l) => daysBetween(l.assigned_to_sales_at, l.first_contact_at) ?? '' },
  { header: 'Duration in Sales Lead Qual', value: () => '' },
  { header: 'Duration in Contact 1', value: () => '' },
  { header: 'Duration in Beyond Contact 1', value: (l) => daysBetween(l.first_contact_at, l.final_state_date ?? l.converted_at) ?? '' },
  { header: 'Aftermarket Duration in Fortifi', value: () => '' },
  { header: 'Aftermarket Duration in BU', value: () => '' },
  { header: 'Aftermarket Duration in Contact(s)', value: () => '' },
];

// ---- Opportunity ----
function opportunityColumns(
  stageName: Record<string, string>,
  companyName: Record<string, string>,
  companyCountry: Record<string, string>,
): CsvColumn<CrmDealRow>[] {
  return [
    { header: 'Opportunity Key', value: (d) => d.id },
    { header: 'Lead Key', value: (d) => d.lead_id ?? '' },
    { header: 'BU Lvl2 Key', value: () => BU_KEY },
    { header: 'Opportunity Name', value: (d) => d.name },
    { header: 'Opportunity Stage', value: (d) => (d.stage_id ? stageName[d.stage_id] ?? '' : '') },
    { header: 'Opportunity Creation Date', value: (d) => d.created_date ?? '' },
    { header: 'Projected Close Date', value: (d) => d.expected_close_date ?? '' },
    { header: 'Actual Close Date', value: (d) => d.actual_close_date ?? '' },
    { header: 'Combined Close Date', value: (d) => d.actual_close_date ?? d.expected_close_date ?? '' },
    { header: 'Customer Name', value: (d) => (d.company_id ? companyName[d.company_id] ?? '' : '') },
    { header: 'Customer Country', value: (d) => (d.company_id ? companyCountry[d.company_id] ?? '' : '') },
    { header: 'End User Name', value: (d) => d.end_user_name ?? '' },
    { header: 'End User Country', value: (d) => d.end_user_country ?? '' },
    { header: 'OEM or After', value: (d) => d.oem_or_aftermarket ?? '' },
    { header: 'Prequote Estimate Value', value: (d) => d.prequote_estimate_value ?? '' },
    { header: 'Opportunity Value', value: (d) => d.amount ?? '' },
    { header: 'Margin Value', value: (d) => d.margin_value ?? '' },
    { header: 'Margin %', value: (d) => marginPercent(d.margin_value, d.amount) ?? '' },
  ];
}

// ---- Geography (distinct country values present in the data) ----
function buildGeography(input: CrmExportInput): { country: string }[] {
  const seen = new Map<string, string>(); // upper -> first-seen original
  const add = (v: string | null | undefined) => {
    const t = (v || '').trim();
    if (t && !seen.has(t.toUpperCase())) seen.set(t.toUpperCase(), t);
  };
  input.leads.forEach((l) => {
    add(l.customer_country);
    add(l.end_user_country);
  });
  input.deals.forEach((d) => add(d.end_user_country));
  input.companies.forEach((c) => add(c.country));
  return [...seen.values()].sort().map((country) => ({ country }));
}

const GEOGRAPHY_COLUMNS: CsvColumn<{ country: string }>[] = [
  { header: 'Country Code', value: () => '' }, // ISO 3166 to be enriched outside the model
  { header: 'Country Name', value: (r) => r.country },
  { header: 'Region', value: () => '' },
];

export const CRM_EXPORT_README = `FieldCalls CRM: Lead Management & Sales Funnel export
==================================================

Mapped to the Power BI semantic model (V2). Single business unit: "FieldCalls".

Source.csv        Lead sources (cost tracked here).  key: Source Key.
Campaign.csv      Campaigns, linked to Source via "Source ID".
BU.csv            One row. This export is for the FieldCalls business unit. Every
                  Lead/Opportunity "BU Lvl2 Key" = 1 (FieldCalls).
Lead.csv          Leads + funnel milestones. Joins: Source Key -> Source,
                  Campaign ID -> Campaign, BU Lvl2 Key -> BU.
Opportunity.csv   Deals as opportunities. Joins: Lead Key -> Lead,
                  BU Lvl2 Key -> BU. "Opportunity Stage" is the pipeline stage
                  name; "Combined Close Date" = Actual, else Projected;
                  "Margin %" = Margin Value / Opportunity Value * 100.
Geography.csv     Distinct country values found in the data. Country Code (ISO
                  3166) and Region are BLANK. Enrich these outside the model
                  (the semantic model expects a coded geography table).
AOP.csv           Header only. No annual-operating-plan / target data exists yet.

NOT included (built in Power BI, per the model): the Date table (DAX/PowerQuery).

Keys are A52 UUID strings, not integers, but they still relate as text in PBI.

Lead durations (in days), computed best-effort from milestone timestamps:
  Duration in Data Load                     = acknowledged_at  - data_loaded_at
  Duration in Load to CRM & Acknowledge     = assigned_to_sales_at - acknowledged_at
  Duration in Lead Pre-qual & Assign to Sales = first_contact_at - assigned_to_sales_at
  Duration in Beyond Contact 1              = (final_state_date | converted_at) - first_contact_at
  Duration in Sales Lead Qual, Duration in Contact 1, and all Aftermarket
  durations are left BLANK: no distinct source timestamp. Adjust if these should
  map differently.
`;

/** All files for the CRM export (CSV strings + README). The component zips them. */
export function buildCrmExport(input: CrmExportInput): ExportFile[] {
  const stageName = Object.fromEntries(input.stages.map((s) => [s.id, s.name]));
  const companyName = Object.fromEntries(input.companies.map((c) => [c.id, c.name]));
  const companyCountry = Object.fromEntries(
    input.companies.map((c) => [c.id, c.country ?? '']),
  );

  return [
    { name: 'Source.csv', content: toCsv(input.sources, SOURCE_COLUMNS) },
    { name: 'Campaign.csv', content: toCsv(input.campaigns, CAMPAIGN_COLUMNS) },
    { name: 'BU.csv', content: toCsv(BU_ROWS, BU_COLUMNS) },
    { name: 'Lead.csv', content: toCsv(input.leads, LEAD_COLUMNS) },
    {
      name: 'Opportunity.csv',
      content: toCsv(input.deals, opportunityColumns(stageName, companyName, companyCountry)),
    },
    { name: 'Geography.csv', content: toCsv(buildGeography(input), GEOGRAPHY_COLUMNS) },
    { name: 'AOP.csv', content: toCsv([], [
      { header: 'BU Lvl2 Key', value: () => '' },
      { header: 'Date', value: () => '' },
      { header: 'Target Value', value: () => '' },
    ]) },
    { name: 'README.txt', content: CRM_EXPORT_README },
  ];
}
