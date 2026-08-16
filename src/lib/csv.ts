/**
 * Tiny CSV export helper. Pure string building (unit-tested in csv.test.ts) plus a
 * browser download. Used by the CRM list pages' "Export CSV" buttons; each page
 * defines readable columns and exports whatever rows are currently in view (so the
 * export honours the on-screen filters).
 *
 * Unlike the legacy per-cell escaping in pages/Export.jsx (which only quoted
 * strings and mangled values containing commas), every cell here is quoted when it
 * contains a comma, quote, or newline - so a value like an address never shifts
 * columns.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/** Escape one cell: stringify, then RFC-4180 quote when it contains , " CR or LF. */
function escapeCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string (CRLF-delimited) from rows and a column spec. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(','));
  return [header, ...body].join('\r\n');
}

/** Trigger a browser download of `csv` as `filename` (UTF-8 BOM so Excel is happy). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Build the CSV from `columns`/`rows` and download it as `filename`. */
export function exportCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  downloadCsv(filename, toCsv(rows, columns));
}

/** `crm-companies_2026-07-28.csv` - a dated filename for an export. */
export function csvFilename(base: string, isoDate: string = new Date().toISOString()): string {
  return `${base}_${isoDate.slice(0, 10)}.csv`;
}
