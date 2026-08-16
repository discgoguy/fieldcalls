export interface FilterOption { value: string; label: string; }

interface FilterSelectProps {
  /** Field label shown on the control. */
  label: string;
  /** Currently selected value (`all` = no filter). */
  value: string;
  /** Selectable options. */
  options: FilterOption[];
  /** Called with the newly selected value. */
  onChange: (value: string) => void;
  /** Label for the "no filter" option (value `all`). */
  allLabel?: string;
}

/**
 * A small labelled dropdown for the CRM list filter toolbars, matching the
 * CrmMap filter style. Renders nothing when there's nothing to filter by (no
 * options), so an empty dimension doesn't show a dead control. The sentinel value
 * for "no filter" is the string `all`.
 */
export default function FilterSelect({ label, value, options, onChange, allLabel = 'All' }: FilterSelectProps) {
  if (options.length === 0) return null;
  return (
    // min-w-0 plus a capped select width keep this usable on a phone: a native
    // select sizes itself to its widest option, so one long value ("Lobster
    // Processing & Export") pushed the control past the viewport edge. Capped, the
    // text truncates instead.
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-gray-600">
      <span className="shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 max-w-[9rem] flex-1 rounded-md border border-input bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="all">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
