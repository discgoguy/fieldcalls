import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { createPageUrl } from '@/utils';
import type { CrmLeadRow, CrmCompanyRow, CrmDealRow, CrmSourceRow, CrmPipelineStageRow } from '@/api/entities';
import { hasCoords, formatMoney, trimText } from './crmUtils';
import { CONTINENTS, continentForCountry } from './continents';
import { MapPin } from 'lucide-react';
import MapFilterBar from './MapFilterBar';
import MapTable from './MapTable';
import { buildMapTableRows } from './mapTable.logic';
import { ANY, capitalizeFirst, offeredValues, type MapFilterField } from './mapFilters';
import { useUrlFilters } from '@/lib/useUrlFilters';

// Companies are blue; leads are colored by status. "new" uses slate (not the
// dashboard's blue) so a new lead never looks like a company on the map.
const COMPANY_COLOR = '#2a78d6';
const LEAD_STATUS_COLORS: Record<string, string> = {
  new: '#64748b', working: '#eda100', qualified: '#008300', disqualified: '#e34948',
};
const LEAD_FALLBACK_COLOR = '#eda100';
const leadColor = (status: string | null) => (status && LEAD_STATUS_COLORS[status]) || LEAD_FALLBACK_COLOR;

const LEAD_STATUSES = ['new', 'working', 'qualified', 'disqualified'] as const;
const MARKER_RADIUS = 7;

// crm_deals.status values, in pipeline order. Used by the Deal status filter: a
// record matches when it has at least one deal in the selected status.
const DEAL_STATUS_ORDER = ['open', 'won', 'lost'] as const;

type KindFilter = 'all' | 'company' | 'lead';
const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'company', label: 'Companies' },
  { value: 'lead', label: 'Leads' },
];

// URL-persisted filter/scope state, one query param per key (see useUrlFilters).
// ANY ('all') is every default, so it's dropped from the URL. `scope` is clamped to
// its three modes; the rest are open-ended. Module-level for stable identity.
const MAP_FILTER_SPEC = {
  scope: { default: ANY, allowed: ['all', 'company', 'lead'] },
  status: { default: ANY },
  country: { default: ANY },
  region: { default: ANY },
  continent: { default: ANY },
  industry: { default: ANY },
  source: { default: ANY },
  dealStatus: { default: ANY },
} as const;

// NOTE: country/region/industry are trimmed via trimText() when points are built,
// so the filter option lists and their equality tests agree. Rows saved before
// trim-on-save may still hold a trailing space; untrimmed, such a value shows up as
// a second, visually identical entry in the dropdown matching a different subset.
interface MapPoint {
  id: string;
  kind: 'company' | 'lead';
  name: string;
  sub: string;
  status: string | null;    // lead status; null for companies
  country: string | null;   // company.country / lead.customer_country
  region: string | null;    // state/province, both record types
  continent: string | null; // derived from country
  industry: string | null;  // company/lead industry
  source: string | null;    // lead source name; null for companies
  value: number;            // open pipeline (company) / attributed deal value (lead)
  dealStatuses: string[];   // distinct statuses of this record's linked deals
  color: string;
  lat: number;
  lng: number;
  href: string | null;      // detail page to open on click, if any
}

interface CrmMapProps {
  /** Companies to plot (only those with coordinates appear). */
  companies: CrmCompanyRow[];
  /** Leads to plot (only those with coordinates appear). */
  leads: CrmLeadRow[];
  /** Deals, used for marker sizing and the deal-status filter. */
  deals: CrmDealRow[];
  /** Lead sources, for resolving the Source filter's names. */
  sources: CrmSourceRow[];
  /** Pipeline stages, for the table explorer's stage names. Optional: without them a deal shows no stage. */
  stages?: CrmPipelineStageRow[];
}

// Recenter/zoom the map to fit every plotted point whenever they change.
function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 9);
      return;
    }
    map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export default function CrmMap({ companies, leads, deals, sources, stages = [] }: CrmMapProps) {
  const navigate = useNavigate();

  // Filters + scope live in the URL (via useUrlFilters) so they survive a detail-page
  // round-trip and browser Back; clear() below preserves scope and CRMDashboard's `tab`.
  const { values, setFilter, clear } = useUrlFilters(MAP_FILTER_SPEC);
  const kind = values.scope as KindFilter;
  // 'all' means no deal-status filter (records with no deals still show).
  const { status, country, region, continent, industry, source, dealStatus } = values;

  // Per-company open pipeline and per-lead attributed deal value (for sizing), plus
  // each record's distinct linked-deal statuses (for the Deal status filter).
  //
  // Statuses are tracked separately from the value maps on purpose: those sum only
  // OPEN deals, so a company whose deals are all won/lost has value 0 despite having
  // deals. Deriving the filter from `value > 0` would wrongly hide it (and would also
  // hide an open deal with a null/zero amount).
  const { companyValue, leadValue, companyDealStatuses, leadDealStatuses } = useMemo(() => {
    const companyValue = new Map<string, number>();
    const leadValue = new Map<string, number>();
    const companyDealStatuses = new Map<string, Set<string>>();
    const leadDealStatuses = new Map<string, Set<string>>();
    const track = (m: Map<string, Set<string>>, id: string, status: string | null) => {
      if (!status) return;
      const set = m.get(id) ?? new Set<string>();
      set.add(status);
      m.set(id, set);
    };
    for (const d of deals) {
      if (d.company_id) {
        track(companyDealStatuses, d.company_id, d.status ?? null);
        if (d.status === 'open') {
          companyValue.set(d.company_id, (companyValue.get(d.company_id) ?? 0) + (Number(d.amount) || 0));
        }
      }
      if (d.lead_id) {
        track(leadDealStatuses, d.lead_id, d.status ?? null);
        const v = Number(d.prequote_estimate_value ?? d.amount) || 0;
        leadValue.set(d.lead_id, (leadValue.get(d.lead_id) ?? 0) + v);
      }
    }
    return { companyValue, leadValue, companyDealStatuses, leadDealStatuses };
  }, [deals]);

  const sourceName = useMemo(() => {
    const byId = new Map(sources.map((s) => [s.id, s.name]));
    return (l: CrmLeadRow) => trimText(l.source) || (l.source_id ? trimText(byId.get(l.source_id)) : null);
  }, [sources]);

  const points = useMemo<MapPoint[]>(() => {
    const out: MapPoint[] = [];
    for (const c of companies) {
      if (!hasCoords(c)) continue;
      out.push({
        id: c.id, kind: 'company', name: c.name || 'Unnamed company',
        sub: [c.industry, c.country].filter(Boolean).join(' · ') || 'Company',
        status: null, country: trimText(c.country), region: trimText(c.region), continent: continentForCountry(c.country), industry: trimText(c.industry), source: null,
        value: companyValue.get(c.id) ?? 0, dealStatuses: [...(companyDealStatuses.get(c.id) ?? [])], color: COMPANY_COLOR,
        lat: c.latitude as number, lng: c.longitude as number,
        href: createPageUrl('CompanyDetail') + '?id=' + c.id,
      });
    }
    for (const l of leads) {
      if (!hasCoords(l)) continue;
      out.push({
        id: l.id, kind: 'lead', name: l.name || l.company_name || 'Unnamed lead',
        sub: [l.company_name, l.status].filter(Boolean).join(' · ') || 'Lead',
        status: l.status ?? null, country: trimText(l.customer_country), region: trimText(l.region), continent: continentForCountry(l.customer_country), industry: trimText(l.industry), source: sourceName(l),
        value: leadValue.get(l.id) ?? 0, dealStatuses: [...(leadDealStatuses.get(l.id) ?? [])], color: leadColor(l.status ?? null),
        lat: l.latitude as number, lng: l.longitude as number,
        href: createPageUrl('LeadDetail') + '?id=' + l.id,
      });
    }
    return out;
  }, [companies, leads, companyValue, leadValue, companyDealStatuses, leadDealStatuses, sourceName]);

  // Options for the country/source dropdowns, from what's actually plotted.
  const countryOptions = useMemo(
    () => Array.from(new Set(points.map((p) => p.country).filter((c): c is string => !!c))).sort(),
    [points],
  );
  const regionOptions = useMemo(
    () => Array.from(new Set(points.map((p) => p.region).filter((r): r is string => !!r))).sort(),
    [points],
  );
  const industryFilterOptions = useMemo(
    () => Array.from(new Set(points.map((p) => p.industry).filter((i): i is string => !!i))).sort(),
    [points],
  );
  const continentOptions = useMemo(() => {
    const present = new Set(points.map((p) => p.continent).filter(Boolean));
    return CONTINENTS.filter((c) => present.has(c));
  }, [points]);
  const sourceOptions = useMemo(
    () => Array.from(new Set(points.filter((p) => p.kind === 'lead').map((p) => p.source).filter((s): s is string => !!s))).sort(),
    [points],
  );

  // Deal-status options from what's actually plotted, in pipeline order - same
  // approach as the country/industry/source dropdowns.
  const dealStatusOptions = useMemo(() => {
    const present = new Set(points.flatMap((p) => p.dealStatuses));
    return DEAL_STATUS_ORDER.filter((s) => present.has(s));
  }, [points]);

  // The chip fields, as data. Each entry is dropped when it has nothing to offer, so
  // an empty dimension never renders a dead chip; lead status and source are withheld
  // when the scope is Companies, since they can only ever narrow leads.
  const filterFields = useMemo<MapFilterField[]>(() => {
    const leadsInScope = kind !== 'company';
    const all: (MapFilterField | null)[] = [
      { key: 'continent', label: 'Continent', value: continent, options: continentOptions, onChange: (v) => setFilter('continent', v) },
      { key: 'country', label: 'Country', value: country, options: countryOptions, onChange: (v) => setFilter('country', v) },
      { key: 'region', label: 'Region', value: region, options: regionOptions, onChange: (v) => setFilter('region', v) },
      { key: 'industry', label: 'Industry', value: industry, options: industryFilterOptions, onChange: (v) => setFilter('industry', v) },
      { key: 'dealStatus', label: 'Deal status', value: dealStatus, options: dealStatusOptions, onChange: (v) => setFilter('dealStatus', v), format: capitalizeFirst },
      leadsInScope
        ? { key: 'status', label: 'Lead status', value: status, options: [...LEAD_STATUSES], onChange: (v) => setFilter('status', v), format: capitalizeFirst }
        : null,
      leadsInScope
        ? { key: 'source', label: 'Source', value: source, options: sourceOptions, onChange: (v) => setFilter('source', v) }
        : null,
    ];
    return all.filter((f): f is MapFilterField => !!f && f.options.length > 0);
  }, [
    kind, continent, continentOptions, country, countryOptions, region, regionOptions,
    industry, industryFilterOptions, dealStatus, dealStatusOptions, status, source, sourceOptions,
  ]);

  // Only the offered fields get to narrow anything, so a selection can't outlive its
  // chip and blank the map with no way to clear it (see `offeredValues`). Read these,
  // never the raw state, when filtering.
  const applied = useMemo(
    () => offeredValues(filterFields, { continent, country, region, industry, dealStatus, status, source }),
    [filterFields, continent, country, region, industry, dealStatus, status, source],
  );

  // Kind + continent + country + industry + deal status apply to both; lead status +
  // source only ever narrow leads.
  const visible = useMemo(() => points.filter((p) => {
    if (kind === 'company' && p.kind !== 'company') return false;
    if (kind === 'lead' && p.kind !== 'lead') return false;
    if (applied.continent !== ANY && p.continent !== applied.continent) return false;
    if (applied.country !== ANY && p.country !== applied.country) return false;
    if (applied.region !== ANY && p.region !== applied.region) return false;
    if (applied.industry !== ANY && p.industry !== applied.industry) return false;
    // Keep records with at least one deal in the selected status.
    if (applied.dealStatus !== ANY && !p.dealStatuses.includes(applied.dealStatus)) return false;
    if (applied.status !== ANY && p.kind === 'lead' && p.status !== applied.status) return false;
    if (applied.source !== ANY && p.kind === 'lead' && p.source !== applied.source) return false;
    return true;
  }), [points, kind, applied]);

  // Table explorer rows - derived from the SAME `visible` array the markers use, so
  // the map and the table can never disagree. Deals are narrowed by the applied deal
  // status, so an expanded row lists exactly the deals in the search criteria.
  const tableRows = useMemo(
    () => buildMapTableRows({ visible, deals, stages, dealStatus: applied.dealStatus }),
    [visible, deals, stages, applied.dealStatus],
  );

  const plotted = points.length;
  const shownCompanies = visible.filter((p) => p.kind === 'company').length;
  const leadStatusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of visible) if (p.kind === 'lead') m.set(p.status ?? 'new', (m.get(p.status ?? 'new') ?? 0) + 1);
    return m;
  }, [visible]);

  // Resets every chip in one pass. `scope` is omitted on purpose (a mode, not a filter).
  const clearAllFilters = () =>
    clear(['continent', 'country', 'region', 'industry', 'dealStatus', 'status', 'source']);

  if (plotted === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] text-center text-gray-500 border rounded-lg bg-gray-50">
        <MapPin className="h-8 w-8 mb-2 text-gray-400" />
        <p className="font-medium">No mapped companies or leads yet.</p>
        <p className="text-sm mt-1 max-w-md">
          Add latitude/longitude to a company or lead (use the “Geocode from address”
          button in their form) and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filter bar - the chip-bar design. Fields are declared as data so the bar
          stays presentational; a field with no options is dropped so an empty
          dimension never shows a dead chip, and the two lead-only filters are
          withheld when the scope is Companies. */}
      <MapFilterBar
        scope={kind}
        scopeOptions={KIND_OPTIONS}
        onScopeChange={(v) => setFilter('scope', v)}
        fields={filterFields}
        shown={visible.length}
        onClearAll={clearAllFilters}
      />


      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
        {kind !== 'lead' && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: COMPANY_COLOR }} />
            Companies ({shownCompanies})
          </span>
        )}
        {kind !== 'company' && LEAD_STATUSES.map((s) => (
          leadStatusCounts.get(s) ? (
            <span key={s} className="flex items-center gap-1.5 capitalize">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: LEAD_STATUS_COLORS[s] }} />
              {s} ({leadStatusCounts.get(s)})
            </span>
          ) : null
        ))}
      </div>

      {/* Split view from `xl`: map left, table right. Below that it stays stacked, and
          `gap-2` keeps the stacked spacing identical to the surrounding `space-y-2`.
          `items-start` so a short table sits at the top of its pane instead of being
          stretched to the map's height.

          `xl` (not `lg`) is where the split starts because that's the first width with
          room for both: from `lg` the sidebar takes a real 256px column, so at 1024 each
          pane would only be ~320px. See MapTable for the pane-width arithmetic - its
          column layout is tuned to the number below, so the two must be changed together. */}
      <div className="grid gap-2 xl:grid-cols-2 xl:items-start xl:gap-4">
        {/* `isolate` is load-bearing, not cosmetic. Leaflet gives its panes z-index
            200-700 and its controls/attribution 800-1000, and a plain `relative` box
            (z-index auto) is NOT a stacking context - so those numbers competed
            globally and the map painted over the app's sidebar drawer (z-30), dialogs
            (z-50) and toasts (z-100). `isolation: isolate` creates a stacking context
            so they can only ever stack against each other. */}
        <div className="relative isolate h-[360px] sm:h-[520px] overflow-hidden rounded-lg border">
          <MapContainer center={[points[0].lat, points[0].lng]} zoom={4} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={visible} />
            {visible.map((p) => (
              <CircleMarker
                key={`${p.kind}-${p.id}`}
                center={[p.lat, p.lng]}
                radius={MARKER_RADIUS}
                pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.7, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  <span className="font-medium">{p.name}</span>
                  {p.value > 0 && <span className="text-gray-500"> · {formatMoney(p.value)}</span>}
                </Tooltip>
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{p.sub}</div>
                    {p.value > 0 && (
                      <div className="text-xs text-gray-500">
                        {p.kind === 'company' ? 'Open pipeline' : 'Deal value'}: {formatMoney(p.value)}
                      </div>
                    )}
                    {p.href && (
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => navigate(p.href as string)}
                      >
                        {p.kind === 'company' ? 'Open company →' : 'Open lead →'}
                      </button>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          {visible.length === 0 && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
              <span className="bg-white/90 border rounded-md px-3 py-1.5 text-sm text-gray-500 shadow-sm">
                No records match this filter.
              </span>
            </div>
          )}
        </div>

        {/* What you're looking at, as rows: one per visible record, expandable to its deals. */}
        <MapTable rows={tableRows} dealStatus={applied.dealStatus} />
      </div>
    </div>
  );
}
