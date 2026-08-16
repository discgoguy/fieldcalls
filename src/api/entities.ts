import { supabase } from './supabaseClient';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T]['Row'];
export type InsertRow<T extends TableName> = Tables[T]['Insert'];
export type UpdateRow<T extends TableName> = Tables[T]['Update'];

type FilterOperators<V> = {
  $gte?: V;
  $gt?: V;
  $lte?: V;
  $lt?: V;
  $ne?: V;
  $in?: V[];
};

/** Filter values: exact match, array (IN), operator object, or null (IS NULL). */
export type Filters<T extends TableName> = {
  [K in keyof Row<T>]?: Row<T>[K] | NonNullable<Row<T>[K]>[] | FilterOperators<Row<T>[K]> | null;
};

export interface Entity<T extends TableName> {
  list(orderBy?: string, limit?: number): Promise<Row<T>[]>;
  get(id: string): Promise<Row<T>>;
  filter(filters: Filters<T>, orderBy?: string, limit?: number, offset?: number): Promise<Row<T>[]>;
  create(payload: InsertRow<T>): Promise<Row<T>>;
  bulkCreate(items: InsertRow<T>[]): Promise<Row<T>[]>;
  update(id: string, payload: UpdateRow<T>): Promise<Row<T>>;
  delete(id: string): Promise<{ success: boolean }>;
}

/**
 * Factory that returns list/get/filter/create/update/delete helpers
 * for a given Supabase table name, typed from the generated DB schema.
 *
 * The query-builder internals are deliberately untyped (`from()` returns any):
 * supabase-js's generics don't survive a table name that is itself a generic
 * parameter. The public Entity<T> interface carries the real types.
 */
function makeEntity<T extends TableName>(table: T): Entity<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const from = () => supabase.from(table) as any;
  return {
    async list(orderBy = 'created_date', limit = 1000) {
      const ascending = !orderBy.startsWith('-');
      const column = orderBy.replace(/^-/, '');
      const PAGE_SIZE = 1000; // matches the platform's observed per-request row ceiling
      let results: Row<T>[] = [];
      let offset = 0;
      while (results.length < limit) {
        const remaining = limit - results.length;
        const pageSize = Math.min(PAGE_SIZE, remaining);
        const { data, error } = await from()
          .select('*')
          .order(column, { ascending })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        results = results.concat(data ?? []);
        if (!data || data.length < pageSize) break; // fewer rows than asked for = end
        offset += pageSize;
      }
      return results;
    },

    async get(id) {
      const { data, error } = await from()
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async filter(filters, orderBy = 'created_date', limit = 1000, offset = 0) {
      const ascending = !orderBy.startsWith('-');
      const column = orderBy.replace(/^-/, '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const applyFilters = (query: any) => {
        for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
          if (value === null || value === undefined) {
            query = query.is(key, null);
          } else if (Array.isArray(value)) {
            query = query.in(key, value);
          } else if (typeof value === 'object') {
            const ops = value as FilterOperators<unknown>;
            if ('$gte' in ops) query = query.gte(key, ops.$gte);
            if ('$gt' in ops) query = query.gt(key, ops.$gt);
            if ('$lte' in ops) query = query.lte(key, ops.$lte);
            if ('$lt' in ops) query = query.lt(key, ops.$lt);
            if ('$ne' in ops) query = query.neq(key, ops.$ne);
            if ('$in' in ops) query = query.in(key, ops.$in);
          } else {
            query = query.eq(key, value);
          }
        }
        return query;
      };
      // Page like list() does: each response is capped at the platform's max_rows
      // (1000), so a single .range() over a larger limit would silently truncate.
      const PAGE_SIZE = 1000;
      let results: Row<T>[] = [];
      while (results.length < limit) {
        const pageStart = offset + results.length;
        const pageSize = Math.min(PAGE_SIZE, limit - results.length);
        const query = applyFilters(from().select('*').order(column, { ascending }))
          .range(pageStart, pageStart + pageSize - 1);
        const { data, error } = await query;
        if (error) throw error;
        results = results.concat(data ?? []);
        if (!data || data.length < pageSize) break; // fewer rows than asked for = end
      }
      return results;
    },

    async create(payload) {
      const { data, error } = await from()
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async bulkCreate(items) {
      const { data, error } = await from()
        .insert(items)
        .select();
      if (error) throw error;
      return data ?? [];
    },

    async update(id, payload) {
      const { data, error } = await from()
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await from()
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    },
  };
}

export const Customer             = makeEntity('customers');
export const Machine              = makeEntity('machines');
export const MachineType          = makeEntity('machine_types');
export const MaintenanceChecklist = makeEntity('maintenance_checklists');
export const MaintenanceChecklistItem = makeEntity('maintenance_checklist_items');
export const MaintenanceTemplate  = makeEntity('maintenance_templates');
export const Part                 = makeEntity('parts');
export const AssemblyComponent    = makeEntity('assembly_components');
export const PurchaseOrder        = makeEntity('purchase_orders');
export const PurchaseOrderItem    = makeEntity('purchase_order_items');
export const Quote                = makeEntity('quotes');
export const QuoteItem            = makeEntity('quote_items');
export const Supplier             = makeEntity('suppliers');
export const Technician           = makeEntity('technicians');
export const Ticket               = makeEntity('tickets');
export const TicketNote           = makeEntity('ticket_notes');
export const TicketEvent          = makeEntity('ticket_events');
export const KnowledgeCategory    = makeEntity('knowledge_categories');
export const KnowledgeItem        = makeEntity('knowledge_items');
export const Setting              = makeEntity('settings');
export const Transaction          = makeEntity('transactions');
export const BorrowedPart         = makeEntity('borrowed_parts');
export const CustomerInventory    = makeEntity('customer_inventory');

// User entity
export const User = makeEntity('profiles');

// Entities for tables that live on prod (backup/restore, timecards, etc.).
// database.types.ts is now generated from prod, so these are fully typed.
export const Role               = makeEntity('roles');
export const PendingUser        = makeEntity('pending_users');
export const InventoryCount     = makeEntity('inventory_counts');
export const InventoryCountItem = makeEntity('inventory_count_items');
export const InventoryAudit     = makeEntity('inventory_audit');
export const PriceHistory       = makeEntity('price_history');
export const CalendarEvent      = makeEntity('calendar_events');
export const Department          = makeEntity('departments');
export const Task                = makeEntity('tasks');
export const Timecard            = makeEntity('timecards');
export const TimecardEntry       = makeEntity('timecard_entries');

export const Category = makeEntity('categories');

// CRM entities
export const CrmCompany       = makeEntity('crm_companies');
export const CrmContact       = makeEntity('crm_contacts');
export const CrmPipelineStage = makeEntity('crm_pipeline_stages');
export const CrmDeal          = makeEntity('crm_deals');
export const CrmLead          = makeEntity('crm_leads');
export const CrmActivity      = makeEntity('crm_activities');
export const CrmAttachment    = makeEntity('crm_attachments');
export const CrmDealStageHistory = makeEntity('crm_deal_stage_history');
export const CrmSource        = makeEntity('crm_sources');
export const CrmCampaign      = makeEntity('crm_campaigns');

// Convenient row aliases for CRM components
export type CrmCompanyRow          = Row<'crm_companies'>;
export type CrmContactRow          = Row<'crm_contacts'>;
export type CrmPipelineStageRow    = Row<'crm_pipeline_stages'>;
export type CrmDealRow             = Row<'crm_deals'>;
export type CrmLeadRow             = Row<'crm_leads'>;
export type CrmActivityRow         = Row<'crm_activities'>;
export type CrmAttachmentRow       = Row<'crm_attachments'>;
export type CrmDealStageHistoryRow = Row<'crm_deal_stage_history'>;
export type CrmSourceRow           = Row<'crm_sources'>;
export type CrmCampaignRow         = Row<'crm_campaigns'>;
export type QuoteRow               = Row<'quotes'>;
export type ProfileRow             = Row<'profiles'>;
