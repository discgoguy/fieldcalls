import { describe, it, expect } from 'vitest';
import { statusForStage, daysSince, formatMoney, formatMoneyWhole, marginPct, contactName, leadMilestoneStamps, isValidEmail, trimText, distinctSorted } from './crmUtils';

describe('statusForStage', () => {
  it('maps won/lost/open from stage flags', () => {
    expect(statusForStage({ is_won: true, is_lost: false })).toBe('won');
    expect(statusForStage({ is_won: false, is_lost: true })).toBe('lost');
    expect(statusForStage({ is_won: false, is_lost: false })).toBe('open');
  });
  it('returns the fallback (default "open") for an unknown stage, never silently flipping', () => {
    expect(statusForStage(null)).toBe('open');
    expect(statusForStage(undefined, 'won')).toBe('won'); // e.g. keep a won deal won if stages failed to load
  });
});

describe('marginPct', () => {
  it('is margin/amount to one decimal', () => {
    expect(marginPct(1000, 250)).toBe('25.0%');
    expect(marginPct('1000', '250')).toBe('25.0%'); // coerces strings
  });
  it('is an em-dash when amount is 0 or missing (no divide-by-zero)', () => {
    expect(marginPct(0, 250)).toBe('—');
    expect(marginPct(null, null)).toBe('—');
  });
});

describe('daysSince', () => {
  it('is null when there is no date', () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
  });
  it('floors whole days elapsed', () => {
    expect(daysSince(new Date(Date.now() - 3.5 * 86400000))).toBe(3);
  });
  it('clamps a future date to 0 (never negative)', () => {
    expect(daysSince(new Date(Date.now() + 86400000))).toBe(0);
  });
});

describe('contactName', () => {
  it('joins first and last name', () => {
    expect(contactName({ first_name: 'Dana', last_name: 'Reyes' })).toBe('Dana Reyes');
    expect(contactName({ first_name: 'Dana' })).toBe('Dana');
  });
  it('falls back to email, then a placeholder', () => {
    expect(contactName({ email: 'x@y.z' })).toBe('x@y.z');
    expect(contactName({})).toBe('Unnamed Contact');
    expect(contactName(null)).toBe('');
  });
});

describe('formatMoney', () => {
  it('groups thousands for a valid currency', () => {
    expect(formatMoney(1000)).toContain('1,000');
    expect(formatMoney(1234.5)).toContain('1,234');
  });
  it('coerces null/garbage amounts to 0', () => {
    expect(formatMoney(null)).toContain('0');
  });
  it('falls back to a plain $ string when the currency code is invalid', () => {
    expect(formatMoney(1234.5, 'NOTACURRENCY')).toBe('$1234.50');
  });
});

describe('isValidEmail', () => {
  it('accepts a normal address (trimming whitespace)', () => {
    expect(isValidEmail('dana@acme.example')).toBe(true);
    expect(isValidEmail('  dana@acme.example  ')).toBe(true);
  });
  it('rejects empty, malformed, or missing pieces', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('dana')).toBe(false);
    expect(isValidEmail('dana@acme')).toBe(false);
    expect(isValidEmail('dana @acme.example')).toBe(false);
  });
});

describe('leadMilestoneStamps', () => {
  const NOW = '2026-07-08T00:00:00.000Z';

  it('stamps acknowledged when status first leaves "new"', () => {
    expect(leadMilestoneStamps(null, { status: 'working' }, NOW)).toEqual({ acknowledged_at: NOW });
  });
  it('does NOT stamp acknowledged while status is still "new"', () => {
    expect(leadMilestoneStamps(null, { status: 'new' }, NOW)).toEqual({});
  });
  it('stamps assigned-to-sales on MQL and first-contact on SQL', () => {
    expect(leadMilestoneStamps(null, { reached_mql: true }, NOW)).toEqual({ assigned_to_sales_at: NOW });
    expect(leadMilestoneStamps(null, { reached_sql: true }, NOW)).toEqual({ first_contact_at: NOW });
  });
  it('never overwrites a milestone that is already set (each happens once)', () => {
    const prev = { acknowledged_at: '2020-01-01T00:00:00.000Z' };
    expect(leadMilestoneStamps(prev, { status: 'working' }, NOW)).toEqual({});
  });
  it('stamps all three at once when a lead jumps straight to SQL', () => {
    expect(
      leadMilestoneStamps(null, { status: 'qualified', reached_mql: true, reached_sql: true }, NOW),
    ).toEqual({ acknowledged_at: NOW, assigned_to_sales_at: NOW, first_contact_at: NOW });
  });
});

describe('formatMoneyWhole', () => {
  it('drops the cents the KPI tiles do not need', () => {
    expect(formatMoneyWhole(4313500)).toBe('$4,313,500');
    expect(formatMoneyWhole(172540.5)).toBe('$172,541'); // rounds, no trailing .50
  });

  it('handles the 7-10 digit range the dashboard actually shows', () => {
    expect(formatMoneyWhole(1234567)).toBe('$1,234,567');
    expect(formatMoneyWhole(1234567890)).toBe('$1,234,567,890');
  });

  it('coerces junk to $0 like formatMoney does', () => {
    expect(formatMoneyWhole(null)).toBe('$0');
    expect(formatMoneyWhole('nope')).toBe('$0');
  });

  it('does not throw on a currency style (min fraction digits must be pinned to 0)', () => {
    // style:'currency' defaults minimumFractionDigits to 2; leaving it while setting
    // maximumFractionDigits:0 makes Intl throw RangeError.
    expect(() => formatMoneyWhole(1000, 'USD')).not.toThrow();
  });
});

describe('trimText', () => {
  it('trims surrounding whitespace', () => {
    expect(trimText('NS ')).toBe('NS');
    expect(trimText(' ME')).toBe('ME');
    expect(trimText('  Nova Scotia  ')).toBe('Nova Scotia');
  });

  it('collapses blank and missing values to null, so \'\' and NULL do not both mean unset', () => {
    expect(trimText('')).toBeNull();
    expect(trimText('   ')).toBeNull();
    expect(trimText(null)).toBeNull();
    expect(trimText(undefined)).toBeNull();
  });

  it('leaves an already-clean value untouched', () => {
    expect(trimText('QC')).toBe('QC');
  });

  it('de-duplicates values that only differed by whitespace (the filter bug)', () => {
    // 'NS ' and 'NS' rendered as two identical-looking Region options, each
    // matching a different subset of records.
    const raw = ['NS ', 'NS', ' ME', 'ME', 'QC'];
    const normalized = raw.map(trimText).filter((v): v is string => !!v);
    expect(distinctSorted(normalized)).toEqual(['ME', 'NS', 'QC']);
    expect(new Set(raw).size).toBe(5); // untrimmed: 5 "distinct" values
  });
});
