import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from './crmUtils';
import { ANY, capitalizeFirst } from './mapFilters';
import { summarizeMapTable, type MapTableRow } from './mapTable.logic';

// Deal-line tint by status, same palette as the dashboard's Recent deals list
// (blue=open, green=won, red=lost).
const DEAL_ROW_CLASS: Record<string, string> = {
  open: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  won: 'bg-green-50 border-green-200 hover:bg-green-100',
  lost: 'bg-red-50 border-red-200 hover:bg-red-100',
};

// A long filter can still leave thousands of records on the map; rendering them all
// would cost more than it tells anyone. The cap is announced rather than silent.
const ROW_CAP = 100;

// The Record cell must be capped, or `truncate` does nothing: a nowrap block
// contributes its full text width as the cell's min-content width, so auto table
// layout widens the table instead of ellipsising (same family as needing `min-w-0`
// in a flex row). Capping the wrapper clamps that contribution for both lines.
//
// The mobile cap is sized so the whole table fits a 375px phone rather than scrolling
// sideways: 293px usable there (375 - `main`'s p-4 - CardContent's p-6 - the border),
// minus the 32px chevron column and ~116px for Amount, leaves ~145px. Truncating a
// name is the right trade - the amount is the one thing that must never be clipped,
// and the full name is still on the row's `title` and one tap away. Narrower than
// 375px still scrolls; that's what the box's `overflow-auto` is for.
//
// The `xl` cap is the same sum done for the split pane CrmMap puts the table in from
// `xl` up: 1280 - 256 (sidebar) - 64 (main's lg:p-8) - 48 (CardContent) - 16 (grid gap),
// halved = 448px. Chevron 32 + Deals ~52 + Amount ~129 (a 9-digit figure) leaves ~219,
// so 12rem + p-2 = 208 fits. A wider viewport only adds slack.
const RECORD_CELL = 'max-w-[8rem] sm:max-w-[20rem] xl:max-w-[12rem]';

interface MapTableProps {
  /** Rows to list, straight from the map's `visible` array (so the two never disagree). */
  rows: MapTableRow[];
  /** The APPLIED deal-status filter; labels the Amount column and the footer's note. */
  dealStatus: string;
}

/**
 * "What am I looking at" table - beside the map from `xl`, below it when narrower. Rows
 * come straight from the map's `visible` array, so the two can never disagree; expanding
 * one lists that record's deals (already narrowed to the applied deal status).
 */
export default function MapTable({ rows, dealStatus }: MapTableProps) {
  const navigate = useNavigate();
  // One row open at a time - an accordion, like TimeCard's expandedId.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const summary = summarizeMapTable(rows);
  const shown = rows.slice(0, ROW_CAP);
  const capped = rows.length - shown.length;

  return (
    // The scroll box is the component's ONLY output - no heading or notice above it, so
    // its top edge is the pane's top edge and the table lines up with the map beside it.
    // The counts and the row-cap warning moved into the sticky footer instead of being
    // dropped: the cap must never be silent. Don't reintroduce a sibling above this box.
    //
    // A plain block, not a flex column - so the height cap scrolls on its own and the
    // shrink-0 gotcha that bit the filter bar doesn't apply here.
    //
    // `isolate` is load-bearing, same reason as the map's. The sticky header needs a
    // z-index to cover the rows scrolling under it, but MapFilterBar's chip menus are
    // `absolute z-10` too - an exact tie, broken by DOM order, and the table comes later,
    // so the header painted over an open Deal-status menu and swallowed one of its
    // options. Isolating this box scopes the header's z-10 to the table instead of
    // letting it compete app-wide, which puts the menu back on top without anyone having
    // to out-bid anyone. Don't swap this for a bigger z-index on the menu.
    //
    // The `<table>` is raw rather than ui/table's `Table`: that wrapper adds its own
    // `overflow-auto` div, which would become the scrollport `sticky` resolves against -
    // an auto-height box that never scrolls, so neither the header nor the footer would
    // stick. `overflow-auto`, not `overflow-y-auto`: both axes are deliberate. Sideways
    // scroll would happen either way (CSS computes the `visible` axis to `auto` once the
    // other isn't visible), so spelling it out keeps a real behavior from reading as an
    // accident. The height cap is shorter on mobile - a 420px scroll box directly under a
    // 360px map leaves a phone with almost no page left - and rises to the map's own
    // 520px in the `xl` split view, so a full table lines up with the map beside it.
    <div className="relative isolate max-h-[320px] sm:max-h-[420px] xl:max-h-[520px] overflow-auto rounded-lg border">
      <table className="w-full caption-bottom text-sm">
        <TableHeader className="sticky top-0 z-10 bg-white">
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Record</TableHead>
            {/* Dropped again from `xl`, where the table shares its row with the map:
                the pane is ~448px, and Location is the one column that isn't width-
                capped ("British Columbia, CAN" runs ~140px). It's also the most
                redundant one there - the map sitting beside it *is* the location. */}
            <TableHead className="hidden sm:table-cell xl:hidden">Location</TableHead>
            {/* Hidden below `sm`, where its ~54px would push Amount off a 375px
                screen. The count moves into the record's second line there, so the
                phone layout loses a column but no information. */}
            <TableHead className="hidden text-right sm:table-cell">Deals</TableHead>
            {/* "Amount", not "Value": this is the sum of the deals listed in the row,
                which is NOT the marker's value (that's open-pipeline for a company and
                prequote-or-amount for a lead). Naming it after the deals' own `amount`
                column keeps the two figures from being read as the same quantity. */}
            <TableHead className="text-right" title="Total amount of the deals listed in this row">
              {dealStatus === ANY ? 'Amount' : `${capitalizeFirst(dealStatus)} amount`}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500">No records match this filter.</TableCell>
            </TableRow>
          )}
          {shown.map((row) => {
            const { record } = row;
            const expandable = row.dealCount > 0;
            const expanded = expandedKey === row.key;
            const location = [record.region, record.country].filter(Boolean).join(', ');
            const toggle = () => setExpandedKey((k) => (k === row.key ? null : row.key));
            return (
              <Fragment key={row.key}>
                <TableRow
                  className={expandable ? 'cursor-pointer' : undefined}
                  onClick={expandable ? toggle : undefined}
                >
                  <TableCell className="w-8 text-gray-400">
                    {/* A real button, so the deal list is reachable by keyboard - the row's
                        own onClick is only a convenience for pointer users. */}
                    {expandable && (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Hide' : 'Show'} deals for ${record.name}`}
                        className="flex items-center hover:text-gray-600"
                        /* stopPropagation, or the row's toggle immediately undoes this one. */
                        onClick={(e) => { e.stopPropagation(); toggle(); }}
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className={RECORD_CELL}>
                      <div className="flex items-center gap-2 min-w-0">
                        {/* The map legend's color, so a row reads as the marker it is. */}
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: record.color }} />
                        {record.href ? (
                          <button
                            type="button"
                            className="hover:underline text-left truncate"
                            title={record.name}
                            /* stopPropagation, or opening the record also toggles the row. */
                            onClick={(e) => { e.stopPropagation(); navigate(record.href as string); }}
                          >
                            {record.name}
                          </button>
                        ) : (
                          <span className="truncate" title={record.name}>{record.name}</span>
                        )}
                      </div>
                      {/* `min-w-0` on the truncating half is load-bearing: a flex item
                          won't shrink below its min-content width without it, so the
                          sub line would push the count out instead of ellipsising.
                          The count is `shrink-0` so it survives a long sub line. */}
                      <div className="flex items-baseline gap-1 text-xs text-gray-500">
                        <span className="min-w-0 truncate" title={record.sub}>{record.sub}</span>
                        <span className="shrink-0 sm:hidden">· {row.dealCount} deal{row.dealCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell xl:hidden">{location || '—'}</TableCell>
                  <TableCell className="hidden text-right sm:table-cell">{row.dealCount}</TableCell>
                  <TableCell className="text-right">
                    {/* One line per currency - a blended cross-currency figure would be a lie. */}
                    {row.totals.length === 0
                      ? <span className="text-gray-400">—</span>
                      : row.totals.map((t) => <div key={t.currency}>{formatMoney(t.amount, t.currency)}</div>)}
                  </TableCell>
                </TableRow>
                {expandable && expanded && (
                  <TableRow key={row.key + '-deals'}>
                    {/* One colSpan cell holding the deal list - the CRM's master-detail
                        idiom, and it avoids aligning sub-cells against a column that
                        disappears below `sm`. */}
                    <TableCell colSpan={5} className="bg-gray-50 p-2">
                      <div className="space-y-1">
                        {/* Buttons, not clickable divs, so each deal is focusable and
                            opens on Enter/Space like the rest of the CRM's links. */}
                        {row.deals.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className={`w-full text-left flex items-center justify-between gap-3 p-2 border rounded-md ${DEAL_ROW_CLASS[d.status ?? ''] || 'hover:bg-gray-50'}`}
                            onClick={() => navigate(createPageUrl('DealDetail') + '?id=' + d.id)}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate" title={d.name}>{d.name}</div>
                              <div className="text-xs text-gray-500">{d.stageName ?? '—'}</div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs capitalize text-gray-500">{d.status}</span>
                              <span className="text-sm font-medium text-gray-800">{formatMoney(d.amount, d.currency)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
        {/* Sticky to the bottom of the scrollport, mirroring the header, so the counts
            and the cap warning stay on screen without costing the table any top
            alignment. `bg-white` overrides TableFooter's translucent `bg-muted/50` -
            twMerge picks the later class - which rows would otherwise show through. */}
        <TableFooter className="sticky bottom-0 z-10 border-t bg-white">
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5} className="px-2 py-1.5 text-xs font-normal text-gray-500">
              {summary.recordCount} record{summary.recordCount === 1 ? '' : 's'} · {summary.dealCount} deal{summary.dealCount === 1 ? '' : 's'}
              {dealStatus !== ANY && ` · ${capitalizeFirst(dealStatus)} deals only`}
              {capped > 0 && (
                <span className="text-amber-700">
                  {' · '}top {ROW_CAP} by value, {capped} more match the filter
                </span>
              )}
            </TableCell>
          </TableRow>
        </TableFooter>
      </table>
    </div>
  );
}
