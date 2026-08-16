import { describe, expect, it } from 'vitest';
import { clearValues, coerce, readValues, writeValues, type FilterSpecs } from './urlFilters.logic';

// A representative CRM spec: a free-text search, a whitelisted enum, and a plain filter.
const specs = {
  q: { default: '' },
  status: { default: 'all', allowed: ['all', 'open', 'won', 'lost'] as const },
  industry: { default: 'all' },
} satisfies FilterSpecs;

describe('coerce', () => {
  it('falls back to the default when the param is missing', () => {
    expect(coerce(null, { default: 'all' })).toBe('all');
    expect(coerce(null, { default: '' })).toBe('');
  });

  it('keeps a valid value verbatim', () => {
    expect(coerce('open', specs.status)).toBe('open');
    expect(coerce('acme', { default: '' })).toBe('acme');
  });

  it('clamps an out-of-whitelist value back to the default - a hand-edited URL can not inject', () => {
    expect(coerce('bogus', specs.status)).toBe('all');
  });

  it('passes any value through when there is no whitelist', () => {
    expect(coerce('anything', { default: '' })).toBe('anything');
    expect(coerce('', { default: 'all' })).toBe('');
  });
});

describe('readValues', () => {
  it('coerces every key against the URL', () => {
    const params = new URLSearchParams('q=acme&status=won&industry=mining');
    expect(readValues(params, specs)).toEqual({ q: 'acme', status: 'won', industry: 'mining' });
  });

  it('fills defaults for absent params and clamps an invalid enum', () => {
    const params = new URLSearchParams('status=bogus');
    expect(readValues(params, specs)).toEqual({ q: '', status: 'all', industry: 'all' });
  });
});

describe('writeValues', () => {
  it('sets a real value', () => {
    const next = writeValues(new URLSearchParams(), { status: 'open' }, specs);
    expect(next.get('status')).toBe('open');
  });

  it('drops a key whose value equals its default', () => {
    const next = writeValues(new URLSearchParams('status=open'), { status: 'all' }, specs);
    expect(next.has('status')).toBe(false);
  });

  it('drops a key whose value is empty or whitespace', () => {
    expect(writeValues(new URLSearchParams('q=acme'), { q: '' }, specs).has('q')).toBe(false);
    expect(writeValues(new URLSearchParams('q=acme'), { q: '   ' }, specs).has('q')).toBe(false);
  });

  it('treats an undefined patch value as a drop (does not throw)', () => {
    expect(writeValues(new URLSearchParams('q=acme'), { q: undefined }, specs).has('q')).toBe(false);
  });

  it('leaves other existing keys untouched', () => {
    const next = writeValues(new URLSearchParams('q=acme&status=won'), { industry: 'mining' }, specs);
    expect(next.get('q')).toBe('acme');
    expect(next.get('status')).toBe('won');
    expect(next.get('industry')).toBe('mining');
  });

  it('applies every key of a multi-key patch in one pass', () => {
    const next = writeValues(
      new URLSearchParams('q=old'),
      { q: 'acme', status: 'open', industry: 'all' },
      specs,
    );
    // q set, status set, industry dropped (== default) - all from a single call.
    expect(next.get('q')).toBe('acme');
    expect(next.get('status')).toBe('open');
    expect(next.has('industry')).toBe(false);
  });

  it('does not mutate the input params', () => {
    const params = new URLSearchParams('status=open');
    writeValues(params, { status: 'won' }, specs);
    expect(params.get('status')).toBe('open');
  });
});

describe('clearValues', () => {
  it('removes the listed keys', () => {
    const next = clearValues(new URLSearchParams('q=acme&status=won'), ['q', 'status']);
    expect(next.has('q')).toBe(false);
    expect(next.has('status')).toBe(false);
  });

  it('preserves keys outside the list (scope/tab), the batched-write regression guard', () => {
    // A clear-all of the filter keys must not wipe non-filter view state the caller kept.
    const next = clearValues(new URLSearchParams('q=acme&status=won&scope=mine&tab=leads'), [
      'q',
      'status',
      'industry',
    ]);
    expect(next.has('q')).toBe(false);
    expect(next.has('status')).toBe(false);
    expect(next.get('scope')).toBe('mine');
    expect(next.get('tab')).toBe('leads');
  });

  it('does not mutate the input params', () => {
    const params = new URLSearchParams('q=acme');
    clearValues(params, ['q']);
    expect(params.get('q')).toBe('acme');
  });
});
