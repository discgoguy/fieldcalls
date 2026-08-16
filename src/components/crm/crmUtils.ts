import type { ChangeEvent } from 'react';
import { supabase } from '@/api/supabaseClient';
import { CrmDealStageHistory, CrmSource, CrmCampaign } from '@/api/entities';
import type { CrmContactRow, CrmPipelineStageRow, CrmLeadRow, Entity, TableName } from '@/api/entities';

export type DealStatus = 'open' | 'won' | 'lost';

/** Shared class for the native <select> controls used across CRM forms. */
export const SELECT_CLASS = 'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

/** Margin % as a display string (margin / amount); em-dash when amount is 0. */
export function marginPct(amount: number | string | null | undefined, margin: number | string | null | undefined): string {
  const a = Number(amount) || 0;
  const m = Number(margin) || 0;
  return a ? `${((m / a) * 100).toFixed(1)}%` : '—';
}

/**
 * Change-handler factory for controlled text/select/textarea inputs, shared by
 * the CRM forms: `const set = makeFieldSetter(form, setForm); ... onChange={set('name')}`.
 */
export function makeFieldSetter<T extends object>(form: T, setForm: (next: T) => void) {
  return <K extends keyof T>(key: K) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });
}

/** Current authenticated user's id (for owner_id / created_by). */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Record a deal stage transition for time-in-stage KPIs.
 * fromStageId null = deal created directly into toStageId.
 * Best-effort: a logging failure must never block the deal update itself.
 */
export async function logStageChange(
  dealId: string | null | undefined,
  fromStageId: string | null | undefined,
  toStageId: string | null | undefined,
): Promise<void> {
  if (!dealId || !toStageId || fromStageId === toStageId) return;
  try {
    await CrmDealStageHistory.create({
      deal_id: dealId,
      from_stage_id: fromStageId || null,
      to_stage_id: toStageId,
      changed_by: await getCurrentUserId(),
    });
  } catch (e) {
    console.error('Failed to log stage change:', e);
  }
}

/**
 * Deal status implied by a pipeline stage. Falls back to the given status when
 * the stage is unknown (e.g. stages failed to load) so a won/lost deal is never
 * silently flipped back to open.
 */
export function statusForStage(
  stage: Pick<CrmPipelineStageRow, 'is_won' | 'is_lost'> | null | undefined,
  fallback: string = 'open',
): string {
  if (!stage) return fallback;
  return stage.is_won ? 'won' : stage.is_lost ? 'lost' : 'open';
}

/** Whole days (>= 0) since the given date; null if no date. */
export function daysSince(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/** Format a numeric amount as currency. */
export function formatMoney(amount: number | string | null | undefined, currency: string | null = 'CAD'): string {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency || 'CAD' }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

/**
 * Whole-dollar currency, for the dashboard KPI tiles. Cents cost three characters
 * and carry no signal at these magnitudes (deal values run 7-10 digits), and that
 * width is what pushed the figures out of their cards.
 *
 * Both fraction-digit bounds must be set: under `style: 'currency'`
 * `minimumFractionDigits` defaults to the currency's 2, and a min above the max
 * makes Intl throw a RangeError.
 */
export function formatMoneyWhole(amount: number | string | null | undefined, currency: string | null = 'CAD'): string {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency || 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString('en-CA')}`;
  }
}

/** Normalization matching the crm_sources/crm_campaigns unique index: lower(btrim(name)). */
export function normalizeDimensionName(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

/**
 * Resolve a dimension name to a row id, creating the row if none exists with
 * that name. Returns null for empty input. The crm_sources/crm_campaigns unique
 * index is on lower(btrim(name)), so both the lookup and the post-conflict
 * re-fetch must match case/whitespace-insensitively - an exact-match lookup
 * would miss "website" vs "Website", insert, hit the index, and surface a
 * duplicate-key error instead of returning the existing row. The tables are
 * small dimensions, so scanning them client-side is fine.
 */
async function ensureDimension<T extends TableName>(
  entity: Entity<T>,
  name: string | null | undefined,
  extra: Record<string, unknown> = {},
): Promise<string | null> {
  const n = (name || '').trim();
  if (!n) return null;
  const findExisting = async (): Promise<string | null> => {
    const rows = (await entity.list('name', 1000)) as { id: string; name?: string | null }[];
    return rows.find((r) => normalizeDimensionName(r.name) === normalizeDimensionName(n))?.id ?? null;
  };
  const existing = await findExisting();
  if (existing) return existing;
  try {
    return (await entity.create({ name: n, ...extra } as never) as { id: string }).id;
  } catch (e) {
    // Unique-index conflict: a concurrent insert or a case/whitespace variant won
    // the race - return the surviving row instead of surfacing the error.
    const dup = await findExisting();
    if (dup) return dup;
    throw e;
  }
}

/** Resolve/create a crm_sources row by name. See ensureDimension. */
export function ensureSource(name: string | null | undefined): Promise<string | null> {
  return ensureDimension(CrmSource, name);
}

/** Resolve/create a crm_campaigns row by name, linking to a source on create. */
export function ensureCampaign(name: string | null | undefined, sourceId: string | null = null): Promise<string | null> {
  return ensureDimension(CrmCampaign, name, { source_id: sourceId });
}

/**
 * Auto-stamp the lead funnel process timestamps that feed the "Duration in Days"
 * measures, based on a lead's state transition. Only stamps a timestamp that is
 * not already set (each milestone happens once), so it's safe on every save.
 *
 * Heuristic mapping from lead state -> milestone (refine as the process firms up):
 *   acknowledged_at      <- status first moves off 'new' (someone is working it)
 *   assigned_to_sales_at <- reached_mql flips true (marketing-qualified -> sales)
 *   first_contact_at     <- reached_sql flips true (sales-qualified, first contact)
 * data_loaded_at is stamped on creation (see callers), not here.
 */
export function leadMilestoneStamps(
  prev: Partial<CrmLeadRow> | null | undefined,
  next: { status?: string | null; reached_mql?: boolean | null; reached_sql?: boolean | null },
  nowIso: string,
): Partial<CrmLeadRow> {
  const stamps: Partial<CrmLeadRow> = {};
  if (!prev?.acknowledged_at && next.status && next.status !== 'new') stamps.acknowledged_at = nowIso;
  if (!prev?.assigned_to_sales_at && next.reached_mql) stamps.assigned_to_sales_at = nowIso;
  if (!prev?.first_contact_at && next.reached_sql) stamps.first_contact_at = nowIso;
  return stamps;
}

/** Loose email validity check for the compose-email UI (the server re-validates). */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Full name for a contact-like object. */
export function contactName(c: Partial<CrmContactRow> | null | undefined): string {
  if (!c) return '';
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Unnamed Contact';
}

/**
 * Datalist options for the Industry field. Industry is free text (no lookup
 * table and no hardcoded list) - suggestions are just the values already saved
 * on records, de-duped and sorted, so previously-used industries resurface
 * without constraining what can be entered.
 */
/** De-dupe + sort free-text values for a suggestion dropdown (trims, drops empties). */
export function distinctSorted(values: (string | null | undefined)[] = []): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = v?.trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Suggestion options for the free-text Industry field (alias of `distinctSorted`). */
export const industryOptions = distinctSorted;

/**
 * Normalize a free-text form value before saving: trim, and treat blank as NULL.
 *
 * Every free-text field that feeds a suggestion dropdown or a filter (Industry,
 * Country, Region) must go through this. Untrimmed values are invisible in the UI
 * but distinct to `Set`/`=`, so a stray trailing space silently produces a
 * duplicate entry in the map's Region/Country/Industry filters: the value looks
 * identical to the one above it and matches a different subset of records.
 * Collapsing blank to NULL likewise avoids '' and NULL both meaning "unset".
 */
export function trimText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * All distinct Industry values in use across companies and leads, for the
 * Industry suggestion dropdown. Projects just the `industry` column from both
 * tables - a narrow read the entity factory's `select('*')` can't express, so it
 * goes through the client directly - then de-dupes/sorts via `distinctSorted`.
 * Best-effort: returns `[]` on error so the form still works as free text.
 */
export async function fetchIndustryOptions(): Promise<string[]> {
  try {
    const [companies, leads] = await Promise.all([
      supabase.from('crm_companies').select('industry'),
      supabase.from('crm_leads').select('industry'),
    ]);
    const rows = [...(companies.data ?? []), ...(leads.data ?? [])] as { industry: string | null }[];
    return distinctSorted(rows.map((r) => r.industry));
  } catch {
    return [];
  }
}

/**
 * All distinct Country values (ISO codes) in use across the CRM, for the Country
 * suggestion dropdowns - company country, lead customer/end-user country, and
 * deal end-user country. Same column-projection approach as `fetchIndustryOptions`.
 * Best-effort: returns `[]` on error so the fields still work as free text.
 */
export async function fetchCountryOptions(): Promise<string[]> {
  try {
    const [companies, leads, deals] = await Promise.all([
      supabase.from('crm_companies').select('country'),
      supabase.from('crm_leads').select('customer_country, end_user_country'),
      supabase.from('crm_deals').select('end_user_country'),
    ]);
    const values: (string | null)[] = [
      ...((companies.data ?? []) as { country: string | null }[]).map((r) => r.country),
      ...((leads.data ?? []) as { customer_country: string | null; end_user_country: string | null }[])
        .flatMap((r) => [r.customer_country, r.end_user_country]),
      ...((deals.data ?? []) as { end_user_country: string | null }[]).map((r) => r.end_user_country),
    ];
    return distinctSorted(values);
  } catch {
    return [];
  }
}

/**
 * All distinct Region (state/province) values in use, for the Region suggestion
 * dropdowns on the company and lead forms. Same column-projection approach as
 * `fetchCountryOptions`. Best-effort: returns `[]` on error so the fields still
 * work as free text.
 *
 * Deliberately NOT uppercased, unlike country: region is free-text here, so forcing
 * case would mangle a spelled-out "Nova Scotia" as readily as it would tidy "ns".
 * Follows Industry (also free-text, also un-cased) rather than the ISO-code fields.
 */
export async function fetchRegionOptions(): Promise<string[]> {
  try {
    const [companies, leads] = await Promise.all([
      supabase.from('crm_companies').select('region'),
      supabase.from('crm_leads').select('region'),
    ]);
    const values: (string | null)[] = [
      ...((companies.data ?? []) as { region: string | null }[]).map((r) => r.region),
      ...((leads.data ?? []) as { region: string | null }[]).map((r) => r.region),
    ];
    return distinctSorted(values);
  } catch {
    return [];
  }
}

export interface LatLng { lat: number; lng: number; }

/** The structured address parts stored on companies/leads. */
export interface AddressParts {
  address?: string | null;      // street line
  city?: string | null;
  region?: string | null;       // state / province
  postal_code?: string | null;
  country?: string | null;
}

/** Join structured address parts into one comma-separated line (for geocoding & display). */
export function composeAddress(p: AddressParts): string {
  return [p.address, p.city, p.region, p.postal_code, p.country]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(', ');
}

/** A record has plottable coordinates (finite lat AND lng). */
export function hasCoords(r: { latitude?: number | null; longitude?: number | null } | null | undefined): boolean {
  return !!r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude);
}

/**
 * Best-effort geocode of a free-text address to lat/lng via OpenStreetMap's
 * Nominatim (free, no API key). Called once per form save (auto-fill when coords
 * are blank) or per "Geocode" button click - never bulk/looped (respect
 * Nominatim's 1 req/sec usage policy). Pass a composed address (see
 * `composeAddress`). Returns null on empty input, no match, or any error; callers
 * fall back to manual lat/lng entry.
 */
export async function geocodeAddress(address: string | null | undefined): Promise<LatLng | null> {
  const q = (address || '').trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const hits: Array<{ lat: string; lon: string }> = await res.json();
    if (!hits.length) return null;
    const lat = Number(hits[0].lat);
    const lng = Number(hits[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
