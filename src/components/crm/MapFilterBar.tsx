import { useState, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  ANY,
  activeCount,
  activeFields,
  anyOptionLabel,
  describeChip,
  formatOption,
  type MapFilterField,
} from './mapFilters';

/**
 * Filter bar for the CRM Overview map - the "Chip bar" design direction.
 *
 * Every filter is a pill carrying its own label, so the row reads as "what I've
 * narrowed to": untouched pills stay grey and say "Any", a set one turns blue and
 * shows its value. Each pill opens its own menu whose first entry clears it.
 *
 * Two layouts, because the phone can't hold seven pills: below `sm` the chips
 * collapse to a single **Filters** button with an active-count badge plus a
 * horizontally scrolling strip of the set values, and the menus become one bottom
 * sheet. Presentational only - all state is owned by the caller.
 */

export interface MapScopeOption {
  value: string;
  label: string;
}

interface MapFilterBarProps {
  /** Current scope ('all' | 'company' | 'lead'). */
  scope: string;
  /** Options for the scope mode toggle. */
  scopeOptions: MapScopeOption[];
  /** Called when the scope mode changes. */
  onScopeChange: (value: string) => void;
  /** Only pass fields that have something to filter by; empty ones aren't rendered. */
  fields: MapFilterField[];
  /** Only used for the mobile sheet's "Show N results" confirm button. */
  shown: number;
  /** Called to reset every filter. */
  onClearAll: () => void;
}

/**
 * Shared menu of a chip's options; the first entry resets the filter.
 *
 * `shrink-0` on each option is **load-bearing**: the menu is a `flex flex-col` with a
 * `max-h`, and flex items shrink by default, so without it the options compress to fit
 * the cap - overlapping, vertically clipped text - instead of the menu scrolling.
 */
function OptionList({ field, onPicked }: { field: MapFilterField; onPicked: () => void }) {
  const pick = (value: string) => { field.onChange(value); onPicked(); };
  const option = (value: string, label: string) => {
    const selected = field.value === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => pick(value)}
        title={label}
        className={`shrink-0 truncate rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-gray-100 ${
          selected ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <>
      {option(ANY, anyOptionLabel(field.label))}
      {field.options.map((o) => option(o, formatOption(field, o)))}
    </>
  );
}

export default function MapFilterBar({
  scope,
  scopeOptions,
  onScopeChange,
  fields,
  shown,
  onClearAll,
}: MapFilterBarProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const active = activeFields(fields);
  const count = activeCount(fields);

  // Only the sheet needs a hand-rolled Escape handler; the chip menus are Radix
  // Popovers, which dismiss on Escape and outside click themselves.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  const scopeSwitch = (fill: boolean) => (
    <div className={`flex gap-0.5 rounded-[9px] bg-gray-100 p-[3px] ${fill ? 'w-full' : ''}`}>
      {scopeOptions.map((o) => {
        const on = scope === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onScopeChange(o.value)}
            aria-pressed={on}
            className={`rounded-[7px] text-[13px] font-semibold transition-colors ${
              fill ? 'flex-1 py-2' : 'px-3.5 py-1.5'
            } ${on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div>
      {/* ---------------- sm and up: the full chip row ---------------- */}
      <div className="hidden flex-wrap items-center gap-2.5 sm:flex">
        {scopeSwitch(false)}
        <div className="mx-1 h-[26px] w-px bg-gray-200" />

        {fields.map((field) => {
          const chip = describeChip(field);
          return (
            // Radix Popover rather than a hand-placed absolute menu: it portals the
            // content and runs collision detection, so a chip near the right edge or
            // low in the window gets its menu shifted/flipped back into view instead of
            // being clipped. It also owns outside-click, Escape and focus.
            <Popover
              key={field.key}
              open={openKey === field.key}
              onOpenChange={(open: boolean) => setOpenKey(open ? field.key : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title={chip.active ? `${field.label}: ${chip.value}` : field.label}
                  className={`flex max-w-[15rem] items-center gap-[7px] rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                    chip.active ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* The label and chevron hold their size; only the value truncates, so a
                      wordy option ("Lobster Processing & Export") can't stretch the row. */}
                  <span className={`shrink-0 ${chip.active ? 'text-blue-500' : 'text-gray-500'}`}>{chip.label}</span>
                  <span className={`min-w-0 truncate font-semibold ${chip.active ? 'text-blue-700' : 'text-gray-400'}`}>
                    {chip.value}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
                </button>
              </PopoverTrigger>

              {/* Capped + scrollable on top of the collision handling: Industry/Country/
                  Region are free-text dimensions with no lookup table, so the option
                  count is unbounded. `w-auto` overrides PopoverContent's default w-72.
                  `hidden sm:flex` because the content is portaled to <body>, so the
                  bar's own `sm:` visibility doesn't reach it: resizing below the
                  breakpoint with a menu open would otherwise leave it floating after
                  its chip is gone. */}
              <PopoverContent
                align="start"
                sideOffset={6}
                collisionPadding={8}
                className="hidden max-h-[18rem] w-auto min-w-[190px] max-w-[17rem] flex-col gap-px overflow-y-auto overscroll-contain rounded-[10px] p-1.5 shadow-lg sm:flex"
              >
                <OptionList field={field} onPicked={() => setOpenKey(null)} />
              </PopoverContent>
            </Popover>
          );
        })}

        {count > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="px-1.5 py-1.5 text-[13px] font-semibold text-gray-500 hover:text-gray-900"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ---------------- below sm: scope + Filters button + set values ---------------- */}
      <div className="sm:hidden">
        {scopeSwitch(true)}
        <div className="mt-3 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex min-h-[44px] flex-none items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-gray-900"
          >
            Filters
            {count > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
          {/* Set values double as one-tap clears, so the strip is actionable. */}
          {active.map((field) => (
            <button
              key={field.key}
              type="button"
              onClick={() => field.onChange(ANY)}
              aria-label={`Clear ${field.label} filter`}
              title={`${field.label}: ${formatOption(field, field.value)}`}
              className="flex min-h-[44px] max-w-[11rem] flex-none items-center gap-[7px] rounded-full border border-blue-200 bg-blue-50 px-3 text-[13px] text-blue-700"
            >
              <span className="min-w-0 truncate">{describeChip(field).value}</span>
              <X className="h-3 w-3 shrink-0 text-blue-300" />
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- mobile bottom sheet ---------------- */}
      {sheetOpen && (
        <div className="sm:hidden">
          {/* Sits at the app's modal level (matching shadcn Dialog's z-50) rather
              than out-bidding Leaflet - the map is isolated, so it no longer needs to. */}
          <div
            className="fixed inset-0 z-40 bg-gray-900/30"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          {/* Only the field groups scroll: Reset and "Show N results" are pinned as
              siblings of the scroll area, not inside it. With everything in one
              scrollport, a long dimension (industry is free text and uncapped) pushed
              the primary action a screen or more below the fold. `min-h-0` on the
              middle child is load-bearing - without it a flex item won't shrink under
              its content size, so the sheet grows past max-h instead of scrolling. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Map filters"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-[20px] bg-white shadow-[0_-8px_30px_rgba(16,24,40,0.18)]"
          >
            <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-4">
              <div className="text-[17px] font-bold text-gray-900">Filters</div>
              <button
                type="button"
                onClick={onClearAll}
                disabled={count === 0}
                className="text-[13px] font-semibold text-gray-500 disabled:opacity-40"
              >
                Reset
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-4">
              {fields.map((field) => (
                // shrink-0 for the same reason as the desktop options: these are flex
                // children of a height-capped scroll area and would otherwise squash.
                <div key={field.key} className="flex shrink-0 flex-col gap-2">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                    {field.label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[{ v: ANY, l: 'Any' }, ...field.options.map((o) => ({ v: o, l: formatOption(field, o) }))].map(({ v, l }) => {
                      const selected = field.value === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => field.onChange(v)}
                          title={l}
                          className={`max-w-[13rem] truncate rounded-full border px-3.5 py-2 text-[13px] ${
                            selected
                              ? 'border-blue-200 bg-blue-50 font-semibold text-blue-700'
                              : 'border-gray-200 bg-white text-gray-700'
                          }`}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 border-t border-gray-100 px-4 pb-6 pt-3">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex h-12 w-full items-center justify-center rounded-[10px] bg-blue-600 text-[15px] font-semibold text-white"
              >
                Show {shown} result{shown === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
