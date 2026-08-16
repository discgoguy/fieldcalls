import { describe, expect, it } from 'vitest';
import { ANY, activeCount, activeFields, anyOptionLabel, capitalizeFirst, describeChip, formatOption, offeredValues } from './mapFilters';

describe('describeChip', () => {
  it('reads as a quiet label + "Any" when unset', () => {
    expect(describeChip({ label: 'Region', value: ANY })).toEqual({
      active: false, label: 'Region', value: 'Any',
    });
  });

  it('gains a colon and shows the value when set, so it reads "Region: NS"', () => {
    expect(describeChip({ label: 'Region', value: 'NS' })).toEqual({
      active: true, label: 'Region:', value: 'NS',
    });
  });

  it('treats any non-sentinel value as set, including falsy-looking strings', () => {
    expect(describeChip({ label: 'Deal status', value: '0' }).active).toBe(true);
    expect(describeChip({ label: 'Deal status', value: '' }).active).toBe(true);
  });
});

describe('anyOptionLabel', () => {
  it('lowercases the field label for the reset option', () => {
    expect(anyOptionLabel('Region')).toBe('Any region');
    expect(anyOptionLabel('Deal status')).toBe('Any deal status');
  });
});

describe('activeFields / activeCount', () => {
  const fields = [
    { key: 'continent', value: ANY },
    { key: 'region', value: 'NS' },
    { key: 'industry', value: ANY },
    { key: 'deal', value: 'open' },
  ];

  it('keeps only the narrowing filters, in order', () => {
    expect(activeFields(fields).map((f) => f.key)).toEqual(['region', 'deal']);
  });

  it('counts them', () => {
    expect(activeCount(fields)).toBe(2);
    expect(activeCount([])).toBe(0);
    expect(activeCount([{ value: ANY }])).toBe(0);
  });
});

describe('offeredValues', () => {
  it('passes through the values whose field is on screen', () => {
    expect(offeredValues([{ key: 'region' }, { key: 'country' }], { region: 'NS', country: 'CAN' }))
      .toEqual({ region: 'NS', country: 'CAN' });
  });

  it('reports a value as unset once its field stops being offered', () => {
    // The blank-map bug: Region is still "Alberta" but nothing plotted has a region,
    // so the chip is gone and there would be no way to clear it.
    expect(offeredValues([{ key: 'country' }], { region: 'Alberta', country: ANY }))
      .toEqual({ region: ANY, country: ANY });
  });

  it('withholds the lead-only filters when the scope drops them', () => {
    expect(offeredValues([{ key: 'region' }], { region: 'NS', status: 'working', source: 'Web' }))
      .toEqual({ region: 'NS', status: ANY, source: ANY });
  });

  it('does not mutate or reset the caller\'s state, so the value returns with the field', () => {
    const values = { region: 'NS' };
    expect(offeredValues([], values)).toEqual({ region: ANY });
    expect(values).toEqual({ region: 'NS' });
    expect(offeredValues([{ key: 'region' }], values)).toEqual({ region: 'NS' });
  });

  it('keeps every requested key, even with no fields at all', () => {
    expect(Object.keys(offeredValues([], { a: 'x', b: 'y' }))).toEqual(['a', 'b']);
  });
});

describe('capitalizeFirst', () => {
  it('capitalizes the lowercase status enums', () => {
    expect(capitalizeFirst('open')).toBe('Open');
    expect(capitalizeFirst('disqualified')).toBe('Disqualified');
  });

  it('leaves an all-caps code alone - a naive title-case would ruin CAN and NS', () => {
    expect(capitalizeFirst('CAN')).toBe('CAN');
    expect(capitalizeFirst('NS')).toBe('NS');
  });

  it('is safe on empty input', () => {
    expect(capitalizeFirst('')).toBe('');
  });
});

describe('format on a field', () => {
  const dealStatus = { label: 'Deal status', value: 'open', format: capitalizeFirst };

  it('applies to the chip value', () => {
    expect(describeChip(dealStatus).value).toBe('Open');
  });

  it('applies to option labels', () => {
    expect(formatOption(dealStatus, 'won')).toBe('Won');
  });

  it('is a no-op for a field without one, so codes stay verbatim', () => {
    expect(describeChip({ label: 'Country', value: 'CAN' }).value).toBe('CAN');
    expect(formatOption({}, 'NS')).toBe('NS');
  });

  it('does not affect the unset display', () => {
    expect(describeChip({ ...dealStatus, value: ANY }).value).toBe('Any');
  });
});
