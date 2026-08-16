import { describe, expect, it } from 'vitest';
import type { CrmCompanyRow, CrmContactRow, CrmDealRow, CrmLeadRow } from '@/api/entities';
import { toCsv } from '@/lib/csv';
import {
  COMPANY_COLUMNS,
  LEAD_COLUMNS,
  contactColumns,
  dealColumns,
} from './exportColumns';

const row = <T>(o: Partial<T>): T => o as T;

/** Header → cell for the single row a spec produced, via the real CSV writer. */
function cells<T>(columns: Parameters<typeof toCsv<T>>[1], r: T): Record<string, string> {
  const [header, body] = toCsv([r], columns).split('\r\n');
  const keys = header.split(',');
  // simple split is fine - these fixtures contain no quoted commas
  return Object.fromEntries(body.split(',').map((v, i) => [keys[i], v]));
}

describe('COMPANY_COLUMNS', () => {
  it('emits the expected headers in order', () => {
    expect(toCsv([], COMPANY_COLUMNS)).toBe(
      'Name,Industry,Domain,Website,Phone,Size,Address,City,Region,Postal Code,Country,Notes',
    );
  });

  it('blanks null fields', () => {
    const c = cells(COMPANY_COLUMNS, row<CrmCompanyRow>({ name: 'Acme', industry: null }));
    expect(c['Name']).toBe('Acme');
    expect(c['Industry']).toBe('');
  });
});

describe('LEAD_COLUMNS', () => {
  it('renders booleans as Yes/No, including converted_at presence', () => {
    const c = cells(
      LEAD_COLUMNS,
      row<CrmLeadRow>({ name: 'L', reached_mql: true, reached_sql: false, converted_at: '2026-01-01' }),
    );
    expect(c['MQL']).toBe('Yes');
    expect(c['SQL']).toBe('No');
    expect(c['Converted']).toBe('Yes');
  });

  it('treats a null converted_at / null flags as No', () => {
    const c = cells(LEAD_COLUMNS, row<CrmLeadRow>({ name: 'L', converted_at: null, reached_mql: null }));
    expect(c['Converted']).toBe('No');
    expect(c['MQL']).toBe('No');
  });
});

describe('contactColumns', () => {
  it('resolves the company name through the map', () => {
    const c = cells(contactColumns({ co1: 'Acme Corp' }), row<CrmContactRow>({ first_name: 'A', company_id: 'co1' }));
    expect(c['Company']).toBe('Acme Corp');
  });

  it('blanks an unknown or missing company id rather than leaking the uuid', () => {
    const unknown = cells(contactColumns({}), row<CrmContactRow>({ company_id: 'ghost' }));
    expect(unknown['Company']).toBe('');
    const none = cells(contactColumns({ co1: 'Acme' }), row<CrmContactRow>({ company_id: null }));
    expect(none['Company']).toBe('');
  });
});

describe('dealColumns', () => {
  it('resolves company and stage names', () => {
    const c = cells(
      dealColumns({ co1: 'Acme Corp' }, { stg1: 'Negotiation' }),
      row<CrmDealRow>({ name: 'D', company_id: 'co1', stage_id: 'stg1', amount: 1000 }),
    );
    expect(c['Company']).toBe('Acme Corp');
    expect(c['Stage']).toBe('Negotiation');
    expect(c['Amount']).toBe('1000');
  });

  it('blanks unknown stage ids and null amounts', () => {
    const c = cells(
      dealColumns({}, {}),
      row<CrmDealRow>({ name: 'D', stage_id: 'ghost', company_id: null, amount: null }),
    );
    expect(c['Stage']).toBe('');
    expect(c['Company']).toBe('');
    expect(c['Amount']).toBe('');
  });
});
