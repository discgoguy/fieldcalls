/**
 * Pure read/write/clear rules for URL-backed filter state, kept out of `useUrlFilters`
 * so they're unit-testable without react-router or a DOM (URLSearchParams in, value or
 * new URLSearchParams out).
 */

export interface FilterSpec {
  default: string;
  /** When present, a raw value outside this list coerces back to `default`. */
  allowed?: readonly string[];
}

export type FilterSpecs = Record<string, FilterSpec>;

export type FilterValues<S extends FilterSpecs> = Record<keyof S, string>;

/** Missing or out-of-`allowed` -> default; otherwise the raw value. Guards stale/hand-edited URLs. */
export function coerce(raw: string | null, spec: FilterSpec): string {
  if (raw == null) return spec.default;
  if (spec.allowed && !spec.allowed.includes(raw)) return spec.default;
  return raw;
}

export function readValues<S extends FilterSpecs>(params: URLSearchParams, specs: S): FilterValues<S> {
  const out = {} as FilterValues<S>;
  for (const key in specs) out[key] = coerce(params.get(key), specs[key]);
  return out;
}

/**
 * Apply a patch, returning new params (input untouched). A patched key is dropped when
 * its value is the default or blank, set otherwise; unpatched keys are left as-is.
 */
export function writeValues<S extends FilterSpecs>(
  params: URLSearchParams,
  patch: Partial<FilterValues<S>>,
  specs: S,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key in patch) {
    const value = patch[key];
    // Nullish/blank/default all mean "not set" -> drop the param to keep the URL short.
    if (value == null || value.trim() === '' || value === specs[key].default) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

/** Delete the listed keys, returning new params. Unlisted keys (e.g. `scope`/`tab`) are preserved. */
export function clearValues(params: URLSearchParams, keys: readonly string[]): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of keys) next.delete(key);
  return next;
}
