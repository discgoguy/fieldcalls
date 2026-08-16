/**
 * Pure derivation for the map's chip filter bar (the "1a" design direction).
 *
 * Kept out of the component so the chip-state rules - which pill reads as set, what
 * it displays when it doesn't, how many are active - are unit-testable without a DOM.
 */

/** Sentinel meaning "this filter isn't narrowing anything". */
export const ANY = 'all';

/** One filter rendered as a chip. `options` excludes the ANY sentinel. */
export interface MapFilterField {
  key: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  /**
   * Display-only transform for values, e.g. `capitalizeFirst` for the lowercase
   * status enums. Deliberately per-field rather than global: the geography filters
   * hold codes (`CAN`, `NS`) that must not be re-cased.
   */
  format?: (value: string) => string;
}

/**
 * 'open' -> 'Open'. Only the first character is touched, so an all-caps code
 * ('CAN', 'NS') survives unchanged if this is ever applied to one.
 */
export function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export interface ChipDisplay {
  /** True when this filter is narrowing the map. */
  active: boolean;
  /** Label text - gains a colon when set, so it reads "Region: NS". */
  label: string;
  /** Value text - the selection, or "Any" when unset. */
  value: string;
}

/** How a chip presents itself. */
export function describeChip(field: Pick<MapFilterField, 'label' | 'value' | 'format'>): ChipDisplay {
  const active = field.value !== ANY;
  return {
    active,
    label: active ? `${field.label}:` : field.label,
    value: active ? (field.format ? field.format(field.value) : field.value) : 'Any',
  };
}

/** A field's option as shown to the user (applies `format` when present). */
export function formatOption(field: Pick<MapFilterField, 'format'>, value: string): string {
  return field.format ? field.format(value) : value;
}

/** Label for a chip menu's reset option, e.g. "Any region". */
export function anyOptionLabel(label: string): string {
  return `Any ${label.toLowerCase()}`;
}

/** Fields currently narrowing the map - drives the count badge and "Clear all". */
export function activeFields<T extends { value: string }>(fields: T[]): T[] {
  return fields.filter((f) => f.value !== ANY);
}

/** Count of filters currently narrowing the map. */
export function activeCount(fields: { value: string }[]): number {
  return activeFields(fields).length;
}

/**
 * The filter values that may actually narrow the map: any value whose field isn't
 * currently offered is reported as unset.
 *
 * This keeps one invariant true - **a filter narrows the map only while its chip is
 * on screen.** Callers drop a field whose option list is empty (an empty dimension
 * shouldn't render a dead chip), and fields can be withheld by scope, so a selection
 * can outlive the chip that set it: pick Region "Alberta", then reload into data where
 * nothing plotted has a region, and the raw value would keep filtering with no chip
 * left to clear it and nothing in the count. The map would just be blank.
 *
 * The value is reported unset rather than reset, so it starts narrowing again by
 * itself if the field comes back (a transient empty fetch doesn't wipe the selection).
 */
export function offeredValues<K extends string>(
  fields: { key: string }[],
  values: Record<K, string>,
): Record<K, string> {
  const offered = new Set(fields.map((f) => f.key));
  const out = {} as Record<K, string>;
  for (const key of Object.keys(values) as K[]) out[key] = offered.has(key) ? values[key] : ANY;
  return out;
}
