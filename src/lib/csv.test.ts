import { describe, it, expect } from 'vitest';
import { toCsv, csvFilename, type CsvColumn } from './csv';

interface Row { name: string; amount: number | null; note: string | null; }

const COLS: CsvColumn<Row>[] = [
  { header: 'Name', value: (r) => r.name },
  { header: 'Amount', value: (r) => r.amount },
  { header: 'Note', value: (r) => r.note },
];

describe('toCsv', () => {
  it('writes a header row even with no data', () => {
    expect(toCsv([], COLS)).toBe('Name,Amount,Note');
  });

  it('renders values and blanks null/undefined', () => {
    const csv = toCsv([{ name: 'Acme', amount: 100, note: null }], COLS);
    expect(csv).toBe('Name,Amount,Note\r\nAcme,100,');
  });

  it('quotes cells containing commas, quotes, or newlines', () => {
    const csv = toCsv(
      [{ name: 'Smith, Co', amount: null, note: 'says "hi"\nbye' }],
      COLS,
    );
    // comma -> quoted; embedded quotes -> doubled; newline kept inside quotes
    expect(csv).toBe('Name,Amount,Note\r\n"Smith, Co",,"says ""hi""\nbye"');
  });
});

describe('csvFilename', () => {
  it('appends the date (YYYY-MM-DD) and .csv', () => {
    expect(csvFilename('crm-leads', '2026-07-28T12:00:00Z')).toBe('crm-leads_2026-07-28.csv');
  });
});
