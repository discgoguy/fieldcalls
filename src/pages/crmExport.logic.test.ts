import { describe, expect, it } from 'vitest';
import type {
  CrmSourceRow,
  CrmCampaignRow,
  CrmLeadRow,
  CrmDealRow,
  CrmPipelineStageRow,
  CrmCompanyRow,
} from '@/api/entities';
import { buildCrmExport, daysBetween, marginPercent } from './crmExport.logic';

const row = <T>(o: Partial<T>): T => o as T;

const input = {
  sources: [row<CrmSourceRow>({ id: 'src1', name: 'Website', source_type: 'Inbound', total_cost: 1000 })],
  campaigns: [row<CrmCampaignRow>({ id: 'cmp1', name: 'Spring', source_id: 'src1', start_date: '2026-01-01', end_date: '2026-02-01' })],
  leads: [
    row<CrmLeadRow>({
      id: 'lead1', name: 'Acme Lead', source_id: 'src1', campaign_id: 'cmp1', created_date: '2026-01-05',
      company_name: 'Acme', customer_existing: false, customer_country: 'Canada', end_user_name: 'EU',
      end_user_country: 'USA', status: 'working', reached_mql: true, mql_date: '2026-01-06',
      reached_sql: false, final_state: null, final_state_date: null,
      data_loaded_at: '2026-01-05T00:00:00.000Z', acknowledged_at: '2026-01-07T00:00:00.000Z',
      assigned_to_sales_at: '2026-01-10T00:00:00.000Z', first_contact_at: '2026-01-12T00:00:00.000Z',
      converted_at: null,
    }),
  ],
  deals: [
    row<CrmDealRow>({
      id: 'deal1', name: 'Acme Deal', lead_id: 'lead1', stage_id: 'stg1', company_id: 'co1',
      created_date: '2026-01-15', expected_close_date: '2026-03-01', actual_close_date: null,
      end_user_name: 'EU', end_user_country: 'USA', oem_or_aftermarket: 'OEM',
      prequote_estimate_value: 5000, amount: 10000, margin_value: 2500,
    }),
  ],
  stages: [row<CrmPipelineStageRow>({ id: 'stg1', name: 'Negotiation' })],
  companies: [row<CrmCompanyRow>({ id: 'co1', name: 'Acme Corp', country: 'Canada' })],
};

describe('daysBetween & marginPercent', () => {
  it('computes day gaps and null on missing', () => {
    expect(daysBetween('2026-01-05T00:00:00.000Z', '2026-01-07T00:00:00.000Z')).toBe(2);
    expect(daysBetween(null, '2026-01-07T00:00:00.000Z')).toBeNull();
  });
  it('computes margin percent and null when value missing/zero', () => {
    expect(marginPercent(2500, 10000)).toBe(25);
    expect(marginPercent(2500, 0)).toBeNull();
    expect(marginPercent(null, 10000)).toBeNull();
  });
});

describe('buildCrmExport', () => {
  const files = buildCrmExport(input);
  const byName = Object.fromEntries(files.map((f) => [f.name, f.content]));

  it('emits the model tables', () => {
    expect(files.map((f) => f.name).sort()).toEqual(
      ['AOP.csv', 'BU.csv', 'Campaign.csv', 'Geography.csv', 'Lead.csv', 'Opportunity.csv', 'README.txt', 'Source.csv'].sort(),
    );
  });

  it('BU is a single FieldCalls row', () => {
    const lines = byName['BU.csv'].split('\r\n');
    expect(lines[0]).toBe('BU Lvl2 Key,BU Lvl2 Name,BU Lvl1 Name,Order');
    expect(lines[1]).toBe('1,FieldCalls,FieldCalls,1');
  });

  it('Lead stamps BU key and computes milestone durations', () => {
    const lines = byName['Lead.csv'].split('\r\n');
    const header = lines[0].split(',');
    const cells = lines[1].split(',');
    const at = (h: string) => cells[header.indexOf(h)];
    expect(at('BU Lvl2 Key')).toBe('1');
    expect(at('Customer Existing')).toBe('false');
    expect(at('Duration in Data Load')).toBe('2'); // 01-05 -> 01-07
    expect(at('Duration in Load to CRM & Acknowledge')).toBe('3'); // 01-07 -> 01-10
    expect(at('Duration in Lead Pre-qual & Assign to Sales')).toBe('2'); // 01-10 -> 01-12
    expect(at('Duration in Contact 1')).toBe(''); // intentionally blank
  });

  it('Opportunity resolves stage name, customer, and margin %', () => {
    const lines = byName['Opportunity.csv'].split('\r\n');
    const header = lines[0].split(',');
    const cells = lines[1].split(',');
    const at = (h: string) => cells[header.indexOf(h)];
    expect(at('Opportunity Stage')).toBe('Negotiation');
    expect(at('Customer Name')).toBe('Acme Corp');
    expect(at('Customer Country')).toBe('Canada');
    expect(at('Combined Close Date')).toBe('2026-03-01'); // actual null -> projected
    expect(at('Margin %')).toBe('25');
  });

  it('Geography dedupes country values; AOP is header-only', () => {
    const geo = byName['Geography.csv'].split('\r\n');
    expect(geo[0]).toBe('Country Code,Country Name,Region');
    expect(geo.filter((l) => l.includes('Canada'))).toHaveLength(1);
    expect(geo.filter((l) => l.includes('USA'))).toHaveLength(1);
    expect(byName['AOP.csv']).toBe('BU Lvl2 Key,Date,Target Value');
  });
});

describe('daysBetween & marginPercent - edges', () => {
  it('handles negative gaps and invalid dates', () => {
    expect(daysBetween('2026-01-07T00:00:00.000Z', '2026-01-05T00:00:00.000Z')).toBe(-2);
    expect(daysBetween('not-a-date', '2026-01-05T00:00:00.000Z')).toBeNull();
  });
  it('rounds margin percent to 2 decimals', () => {
    expect(marginPercent(1, 3)).toBe(33.33);
  });
});

describe('buildCrmExport - edge cases', () => {
  it('dedupes geography case-insensitively', () => {
    const files = buildCrmExport({
      ...input,
      leads: [row<CrmLeadRow>({ id: 'l', customer_country: 'canada', end_user_country: 'CANADA' })],
      deals: [],
      companies: [row<CrmCompanyRow>({ id: 'c', name: 'X', country: 'Canada' })],
    });
    const geo = files.find((f) => f.name === 'Geography.csv')!.content.split('\r\n');
    expect(geo).toHaveLength(2); // header + one deduped Canada row
  });

  it('quotes commas and blanks unknown stage / missing company', () => {
    const files = buildCrmExport({
      sources: [row<CrmSourceRow>({ id: 's', name: 'Trade Show, East', source_type: null, total_cost: null })],
      campaigns: [],
      leads: [],
      deals: [row<CrmDealRow>({ id: 'd', name: 'D', stage_id: 'ghost', company_id: null, amount: null, margin_value: null })],
      stages: [],
      companies: [],
    });
    const byName = Object.fromEntries(files.map((f) => [f.name, f.content]));
    expect(byName['Source.csv'].split('\r\n')[1]).toBe('s,"Trade Show, East",,');
    const oppHeader = byName['Opportunity.csv'].split('\r\n')[0].split(',');
    const oppCells = byName['Opportunity.csv'].split('\r\n')[1].split(',');
    const at = (h: string) => oppCells[oppHeader.indexOf(h)];
    expect(at('Opportunity Stage')).toBe(''); // unknown stage_id
    expect(at('Customer Name')).toBe(''); // no company
    expect(at('Margin %')).toBe(''); // amount null
  });

  it('leaves a lead duration blank when a milestone is missing', () => {
    const files = buildCrmExport({
      ...input,
      leads: [row<CrmLeadRow>({ id: 'l', data_loaded_at: '2026-01-05T00:00:00.000Z', acknowledged_at: null })],
    });
    const lead = files.find((f) => f.name === 'Lead.csv')!.content.split('\r\n');
    const at = (h: string) => lead[1].split(',')[lead[0].split(',').indexOf(h)];
    expect(at('Duration in Data Load')).toBe(''); // acknowledged_at missing
  });
});
