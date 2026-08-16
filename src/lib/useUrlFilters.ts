import { useSearchParams } from 'react-router-dom';
import {
  clearValues,
  readValues,
  writeValues,
  type FilterSpecs,
  type FilterValues,
} from './urlFilters.logic';

/**
 * Shared hook for URL-backed filter/view state, so browser Back restores filters
 * (see conventions.md "flat route remounts on Back"). `values` is derived from the URL
 * every render (URL is the single source of truth; no local state). Writes use one
 * `{ replace: true }` setSearchParams pass — multi-key changes go through `setFilters`/
 * `clear`, never a loop of `setFilter()`, or react-router 6's updater clobbers all but
 * the last. Pass a module-level const spec; values are strings, clamp enums via `allowed`.
 */
export function useUrlFilters<S extends FilterSpecs>(specs: S) {
  const [params, setParams] = useSearchParams();
  const values = readValues(params, specs);

  /** Set one filter. */
  const setFilter = (key: keyof S, value: string) =>
    setParams((prev) => writeValues(prev, { [key]: value } as Partial<FilterValues<S>>, specs), {
      replace: true,
    });

  /** Set several filters in one pass (use this, never a loop of setFilter). */
  const setFilters = (patch: Partial<FilterValues<S>>) =>
    setParams((prev) => writeValues(prev, patch, specs), { replace: true });

  /** Clear the given keys, or every key in the spec when omitted. */
  const clear = (keys?: readonly (keyof S)[]) =>
    setParams((prev) => clearValues(prev, (keys ?? Object.keys(specs)) as string[]), {
      replace: true,
    });

  return { values, setFilter, setFilters, clear };
}
