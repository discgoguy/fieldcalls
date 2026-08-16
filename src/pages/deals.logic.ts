// Pure helpers for the Deals kanban, extracted from Deals.tsx so the grouping and
// totals are unit-testable without React or @dnd-kit. Type-only imports (erased),
// so this module has no runtime dependencies.
import type { CrmDealRow, CrmPipelineStageRow, CrmDealStageHistoryRow } from '@/api/entities';

/**
 * Bucket deals into their pipeline stage. A deal whose stage_id is missing or
 * unknown falls into the FIRST stage's column (so it's never dropped from the
 * board), matching the kanban's behavior. With no stages, deals have nowhere to
 * go and the map is empty.
 */
export function groupDealsByStage(
  stages: CrmPipelineStageRow[],
  deals: CrmDealRow[],
): Record<string, CrmDealRow[]> {
  const map: Record<string, CrmDealRow[]> = {};
  stages.forEach((s) => { map[s.id] = []; });
  deals.forEach((d) => {
    if (d.stage_id && map[d.stage_id]) map[d.stage_id].push(d);
    else if (stages[0]) map[stages[0].id]?.push(d);
  });
  return map;
}

/** Sum of deal amounts (coerces strings, ignores null/garbage). Used per column. */
export function stageTotal(deals: CrmDealRow[]): number {
  return deals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
}

/**
 * Map each deal to the timestamp it entered its current stage, from stage history.
 * History is expected ascending by created_date, so the last write per deal wins =
 * its latest transition. Entries with no created_date are skipped.
 */
export function latestStageEntryByDeal(history: CrmDealStageHistoryRow[]): Record<string, string> {
  const entered: Record<string, string> = {};
  history.forEach((h) => { if (h.created_date) entered[h.deal_id] = h.created_date; });
  return entered;
}
