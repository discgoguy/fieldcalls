export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assembly_components: {
        Row: {
          assembly_part_id: string | null
          component_part_id: string | null
          created_date: string | null
          id: string
          quantity_required: number
          updated_date: string | null
        }
        Insert: {
          assembly_part_id?: string | null
          component_part_id?: string | null
          created_date?: string | null
          id?: string
          quantity_required?: number
          updated_date?: string | null
        }
        Update: {
          assembly_part_id?: string | null
          component_part_id?: string | null
          created_date?: string | null
          id?: string
          quantity_required?: number
          updated_date?: string | null
        }
        Relationships: []
      }
      borrowed_parts: {
        Row: {
          closure_date: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          department: string | null
          id: string
          is_sample: boolean | null
          job_project_number: string | null
          movement_date: string | null
          movement_type: string | null
          notes: string | null
          part_id: string | null
          quantity: number | null
          status: string | null
          updated_date: string | null
        }
        Insert: {
          closure_date?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          department?: string | null
          id?: string
          is_sample?: boolean | null
          job_project_number?: string | null
          movement_date?: string | null
          movement_type?: string | null
          notes?: string | null
          part_id?: string | null
          quantity?: number | null
          status?: string | null
          updated_date?: string | null
        }
        Update: {
          closure_date?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          department?: string | null
          id?: string
          is_sample?: boolean | null
          job_project_number?: string | null
          movement_date?: string | null
          movement_type?: string | null
          notes?: string | null
          part_id?: string | null
          quantity?: number | null
          status?: string | null
          updated_date?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          assigned_customer_ids: Json | null
          assigned_customer_names: Json | null
          assigned_technician_ids: Json | null
          assigned_technician_names: Json | null
          created_date: string | null
          end_date: string
          event_type: string | null
          id: string
          is_admin_managed: boolean | null
          notes: string | null
          start_date: string
          title: string | null
          updated_date: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          all_day?: boolean | null
          assigned_customer_ids?: Json | null
          assigned_customer_names?: Json | null
          assigned_technician_ids?: Json | null
          assigned_technician_names?: Json | null
          created_date?: string | null
          end_date: string
          event_type?: string | null
          id: string
          is_admin_managed?: boolean | null
          notes?: string | null
          start_date: string
          title?: string | null
          updated_date?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          all_day?: boolean | null
          assigned_customer_ids?: Json | null
          assigned_customer_names?: Json | null
          assigned_technician_ids?: Json | null
          assigned_technician_names?: Json | null
          created_date?: string | null
          end_date?: string
          event_type?: string | null
          id?: string
          is_admin_managed?: boolean | null
          notes?: string | null
          start_date?: string
          title?: string | null
          updated_date?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_date: string | null
          id: string
          name: string
          nonsa_markup_percentage: number | null
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          id?: string
          name: string
          nonsa_markup_percentage?: number | null
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          id?: string
          name?: string
          nonsa_markup_percentage?: number | null
          updated_date?: string | null
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          body: string | null
          company_id: string | null
          completed: boolean | null
          completed_at: string | null
          contact_id: string | null
          created_by: string | null
          created_date: string | null
          deal_id: string | null
          direction: string | null
          due_date: string | null
          email_to: string | null
          id: string
          lead_id: string | null
          owner_id: string | null
          subject: string | null
          type: string | null
          updated_date: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_by?: string | null
          created_date?: string | null
          deal_id?: string | null
          direction?: string | null
          due_date?: string | null
          email_to?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          subject?: string | null
          type?: string | null
          updated_date?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_by?: string | null
          created_date?: string | null
          deal_id?: string | null
          direction?: string | null
          due_date?: string | null
          email_to?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          subject?: string | null
          type?: string | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_attachments: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_date: string | null
          deal_id: string | null
          external_id: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          lead_id: string | null
          mime_type: string | null
          source: string | null
          storage_path: string | null
          updated_date: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_date?: string | null
          deal_id?: string | null
          external_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          source?: string | null
          storage_path?: string | null
          updated_date?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_date?: string | null
          deal_id?: string | null
          external_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          source?: string | null
          storage_path?: string | null
          updated_date?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_attachments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_attachments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          created_date: string | null
          end_date: string | null
          id: string
          name: string
          source_id: string | null
          start_date: string | null
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          end_date?: string | null
          id?: string
          name: string
          source_id?: string | null
          start_date?: string | null
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          end_date?: string | null
          id?: string
          name?: string
          source_id?: string | null
          start_date?: string | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "crm_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_companies: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_date: string | null
          domain: string | null
          id: string
          industry: string | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          region: string | null
          size: string | null
          updated_date: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_date?: string | null
          domain?: string | null
          id?: string
          industry?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          size?: string | null
          updated_date?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_date?: string | null
          domain?: string | null
          id?: string
          industry?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          size?: string | null
          updated_date?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company_id: string | null
          created_date: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          title: string | null
          updated_date: string | null
        }
        Insert: {
          company_id?: string | null
          created_date?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          title?: string | null
          updated_date?: string | null
        }
        Update: {
          company_id?: string | null
          created_date?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          title?: string | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_stage_history: {
        Row: {
          changed_by: string | null
          created_date: string | null
          deal_id: string
          from_stage_id: string | null
          id: string
          to_stage_id: string
          updated_date: string | null
        }
        Insert: {
          changed_by?: string | null
          created_date?: string | null
          deal_id: string
          from_stage_id?: string | null
          id?: string
          to_stage_id: string
          updated_date?: string | null
        }
        Update: {
          changed_by?: string | null
          created_date?: string | null
          deal_id?: string
          from_stage_id?: string | null
          id?: string
          to_stage_id?: string
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          actual_close_date: string | null
          amount: number | null
          company_id: string | null
          created_date: string | null
          currency: string | null
          end_user_country: string | null
          end_user_name: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          margin_value: number | null
          name: string
          notes: string | null
          oem_or_aftermarket: string | null
          owner_id: string | null
          prequote_estimate_value: number | null
          primary_contact_id: string | null
          quote_id: string | null
          stage_id: string | null
          status: string | null
          updated_date: string | null
        }
        Insert: {
          actual_close_date?: string | null
          amount?: number | null
          company_id?: string | null
          created_date?: string | null
          currency?: string | null
          end_user_country?: string | null
          end_user_name?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          margin_value?: number | null
          name: string
          notes?: string | null
          oem_or_aftermarket?: string | null
          owner_id?: string | null
          prequote_estimate_value?: number | null
          primary_contact_id?: string | null
          quote_id?: string | null
          stage_id?: string | null
          status?: string | null
          updated_date?: string | null
        }
        Update: {
          actual_close_date?: string | null
          amount?: number | null
          company_id?: string | null
          created_date?: string | null
          currency?: string | null
          end_user_country?: string | null
          end_user_name?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          margin_value?: number | null
          name?: string
          notes?: string | null
          oem_or_aftermarket?: string | null
          owner_id?: string | null
          prequote_estimate_value?: number | null
          primary_contact_id?: string | null
          quote_id?: string | null
          stage_id?: string | null
          status?: string | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          acknowledged_at: string | null
          address: string | null
          assigned_to_sales_at: string | null
          campaign_id: string | null
          city: string | null
          company_name: string | null
          converted_at: string | null
          converted_company_id: string | null
          converted_contact_id: string | null
          converted_deal_id: string | null
          created_date: string | null
          customer_country: string | null
          customer_existing: boolean | null
          data_loaded_at: string | null
          email: string | null
          end_user_country: string | null
          end_user_name: string | null
          final_state: string | null
          final_state_date: string | null
          first_contact_at: string | null
          id: string
          industry: string | null
          latitude: number | null
          longitude: number | null
          mql_date: string | null
          name: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          reached_mql: boolean | null
          reached_sql: boolean | null
          region: string | null
          source: string | null
          source_id: string | null
          sql_date: string | null
          status: string | null
          updated_date: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          address?: string | null
          assigned_to_sales_at?: string | null
          campaign_id?: string | null
          city?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_company_id?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_date?: string | null
          customer_country?: string | null
          customer_existing?: boolean | null
          data_loaded_at?: string | null
          email?: string | null
          end_user_country?: string | null
          end_user_name?: string | null
          final_state?: string | null
          final_state_date?: string | null
          first_contact_at?: string | null
          id?: string
          industry?: string | null
          latitude?: number | null
          longitude?: number | null
          mql_date?: string | null
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          reached_mql?: boolean | null
          reached_sql?: boolean | null
          region?: string | null
          source?: string | null
          source_id?: string | null
          sql_date?: string | null
          status?: string | null
          updated_date?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          address?: string | null
          assigned_to_sales_at?: string | null
          campaign_id?: string | null
          city?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_company_id?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_date?: string | null
          customer_country?: string | null
          customer_existing?: boolean | null
          data_loaded_at?: string | null
          email?: string | null
          end_user_country?: string | null
          end_user_name?: string | null
          final_state?: string | null
          final_state_date?: string | null
          first_contact_at?: string | null
          id?: string
          industry?: string | null
          latitude?: number | null
          longitude?: number | null
          mql_date?: string | null
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          reached_mql?: boolean | null
          reached_sql?: boolean | null
          region?: string | null
          source?: string | null
          source_id?: string | null
          sql_date?: string | null
          status?: string | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_converted_contact_id_fkey"
            columns: ["converted_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_converted_deal_id_fkey"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "crm_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          created_date: string | null
          id: string
          is_lost: boolean | null
          is_won: boolean | null
          name: string
          sort_order: number | null
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name: string
          sort_order?: number | null
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name?: string
          sort_order?: number | null
          updated_date?: string | null
        }
        Relationships: []
      }
      crm_sources: {
        Row: {
          created_date: string | null
          id: string
          name: string
          source_type: string | null
          total_cost: number | null
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          id?: string
          name: string
          source_type?: string | null
          total_cost?: number | null
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          id?: string
          name?: string
          source_type?: string | null
          total_cost?: number | null
          updated_date?: string | null
        }
        Relationships: []
      }
      customer_inventory: {
        Row: {
          created_date: string | null
          customer_id: string | null
          id: string
          machine_id: string | null
          notes: string | null
          part_id: string | null
          quantity: number | null
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          customer_id?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          part_id?: string | null
          quantity?: number | null
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          customer_id?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          part_id?: string | null
          quantity?: number | null
          updated_date?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          contact_person: string | null
          created_date: string | null
          customer_identifier: string | null
          email: string | null
          id: string
          inactive: boolean | null
          is_nonsa: boolean | null
          notes: string | null
          phone: string | null
          state: string | null
          updated_date: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          contact_person?: string | null
          created_date?: string | null
          customer_identifier?: string | null
          email?: string | null
          id?: string
          inactive?: boolean | null
          is_nonsa?: boolean | null
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_date?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          contact_person?: string | null
          created_date?: string | null
          customer_identifier?: string | null
          email?: string | null
          id?: string
          inactive?: boolean | null
          is_nonsa?: boolean | null
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_date?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          active: boolean | null
          created_date: string | null
          description: string | null
          id: string
          name: string
          updated_date: string | null
        }
        Insert: {
          active?: boolean | null
          created_date?: string | null
          description?: string | null
          id?: string
          name: string
          updated_date?: string | null
        }
        Update: {
          active?: boolean | null
          created_date?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_date?: string | null
        }
        Relationships: []
      }
      inventory_audit: {
        Row: {
          change_type: string | null
          created_by: string | null
          created_by_name: string | null
          created_date: string | null
          id: string
          notes: string | null
          part_id: string | null
          part_name: string | null
          part_number: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
        }
        Insert: {
          change_type?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_date?: string | null
          id?: string
          notes?: string | null
          part_id?: string | null
          part_name?: string | null
          part_number?: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
        }
        Update: {
          change_type?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_date?: string | null
          id?: string
          notes?: string | null
          part_id?: string | null
          part_name?: string | null
          part_number?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change?: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_audit_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_items: {
        Row: {
          category: string | null
          count_id: string | null
          created_date: string | null
          id: string
          location_counts: Json | null
          notes: string | null
          part_id: string
          part_name: string | null
          part_number: string | null
          system_quantity: number | null
          total_counted: number | null
          updated_date: string | null
        }
        Insert: {
          category?: string | null
          count_id?: string | null
          created_date?: string | null
          id?: string
          location_counts?: Json | null
          notes?: string | null
          part_id: string
          part_name?: string | null
          part_number?: string | null
          system_quantity?: number | null
          total_counted?: number | null
          updated_date?: string | null
        }
        Update: {
          category?: string | null
          count_id?: string | null
          created_date?: string | null
          id?: string
          location_counts?: Json | null
          notes?: string | null
          part_id?: string
          part_name?: string | null
          part_number?: string | null
          system_quantity?: number | null
          total_counted?: number | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          category_filter: string | null
          committed_at: string | null
          committed_by: string | null
          committed_by_name: string | null
          created_by: string | null
          created_by_name: string | null
          created_date: string | null
          id: string
          locations: Json | null
          name: string
          notes: string | null
          status: string | null
          updated_date: string | null
        }
        Insert: {
          category_filter?: string | null
          committed_at?: string | null
          committed_by?: string | null
          committed_by_name?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_date?: string | null
          id?: string
          locations?: Json | null
          name: string
          notes?: string | null
          status?: string | null
          updated_date?: string | null
        }
        Update: {
          category_filter?: string | null
          committed_at?: string | null
          committed_by?: string | null
          committed_by_name?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_date?: string | null
          id?: string
          locations?: Json | null
          name?: string
          notes?: string | null
          status?: string | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_committed_by_fkey"
            columns: ["committed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_categories: {
        Row: {
          created_date: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_date?: string | null
        }
        Relationships: []
      }
      knowledge_items: {
        Row: {
          category_id: string | null
          content: string | null
          created_date: string | null
          description: string | null
          file_url: string | null
          id: string
          is_published: boolean | null
          item_type: string | null
          machine_type_ids: string | null
          tags: string[] | null
          title: string
          updated_date: string | null
          url: string | null
        }
        Insert: {
          category_id?: string | null
          content?: string | null
          created_date?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          is_published?: boolean | null
          item_type?: string | null
          machine_type_ids?: string | null
          tags?: string[] | null
          title: string
          updated_date?: string | null
          url?: string | null
        }
        Update: {
          category_id?: string | null
          content?: string | null
          created_date?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          is_published?: boolean | null
          item_type?: string | null
          machine_type_ids?: string | null
          tags?: string[] | null
          title?: string
          updated_date?: string | null
          url?: string | null
        }
        Relationships: []
      }
      machine_types: {
        Row: {
          created_date: string | null
          description: string | null
          id: string
          name: string
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          description?: string | null
          id?: string
          name: string
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_date?: string | null
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_date: string | null
          customer_id: string | null
          id: string
          installation_date: string | null
          machine_type: string | null
          model: string | null
          notes: string | null
          serial_number: string | null
          status: string | null
          updated_date: string | null
          warranty_expiration: string | null
        }
        Insert: {
          created_date?: string | null
          customer_id?: string | null
          id?: string
          installation_date?: string | null
          machine_type?: string | null
          model?: string | null
          notes?: string | null
          serial_number?: string | null
          status?: string | null
          updated_date?: string | null
          warranty_expiration?: string | null
        }
        Update: {
          created_date?: string | null
          customer_id?: string | null
          id?: string
          installation_date?: string | null
          machine_type?: string | null
          model?: string | null
          notes?: string | null
          serial_number?: string | null
          status?: string | null
          updated_date?: string | null
          warranty_expiration?: string | null
        }
        Relationships: []
      }
      maintenance_checklist_items: {
        Row: {
          category: string | null
          checklist_id: string | null
          completed: boolean | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          description: string | null
          id: string
          instance_label: string | null
          is_completed: boolean | null
          is_sample: boolean | null
          linked_part_id: string | null
          linked_part_quantity: number | null
          machine_id: string | null
          options: Json | null
          response_value: string | null
          section_name: string | null
          sort_order: string | null
          task_description: string | null
          task_key: string | null
          task_type: string | null
          template_id: string | null
          trigger_response: string | null
          updated_date: string | null
        }
        Insert: {
          category?: string | null
          checklist_id?: string | null
          completed?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          instance_label?: string | null
          is_completed?: boolean | null
          is_sample?: boolean | null
          linked_part_id?: string | null
          linked_part_quantity?: number | null
          machine_id?: string | null
          options?: Json | null
          response_value?: string | null
          section_name?: string | null
          sort_order?: string | null
          task_description?: string | null
          task_key?: string | null
          task_type?: string | null
          template_id?: string | null
          trigger_response?: string | null
          updated_date?: string | null
        }
        Update: {
          category?: string | null
          checklist_id?: string | null
          completed?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          instance_label?: string | null
          is_completed?: boolean | null
          is_sample?: boolean | null
          linked_part_id?: string | null
          linked_part_quantity?: number | null
          machine_id?: string | null
          options?: Json | null
          response_value?: string | null
          section_name?: string | null
          sort_order?: string | null
          task_description?: string | null
          task_key?: string | null
          task_type?: string | null
          template_id?: string | null
          trigger_response?: string | null
          updated_date?: string | null
        }
        Relationships: []
      }
      maintenance_checklist_items_backup_20260815: {
        Row: {
          category: string | null
          checklist_id: string | null
          completed: boolean | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          description: string | null
          id: string | null
          is_completed: boolean | null
          is_sample: boolean | null
          linked_part_id: string | null
          linked_part_quantity: number | null
          machine_id: string | null
          options: Json | null
          response_value: string | null
          section_name: string | null
          sort_order: string | null
          task_description: string | null
          task_type: string | null
          trigger_response: string | null
          updated_date: string | null
        }
        Insert: {
          category?: string | null
          checklist_id?: string | null
          completed?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_sample?: boolean | null
          linked_part_id?: string | null
          linked_part_quantity?: number | null
          machine_id?: string | null
          options?: Json | null
          response_value?: string | null
          section_name?: string | null
          sort_order?: string | null
          task_description?: string | null
          task_type?: string | null
          trigger_response?: string | null
          updated_date?: string | null
        }
        Update: {
          category?: string | null
          checklist_id?: string | null
          completed?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_sample?: boolean | null
          linked_part_id?: string | null
          linked_part_quantity?: number | null
          machine_id?: string | null
          options?: Json | null
          response_value?: string | null
          section_name?: string | null
          sort_order?: string | null
          task_description?: string | null
          task_type?: string | null
          trigger_response?: string | null
          updated_date?: string | null
        }
        Relationships: []
      }
      maintenance_checklist_items_backup_20260815c: {
        Row: {
          category: string | null
          checklist_id: string | null
          completed: boolean | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          description: string | null
          id: string | null
          is_completed: boolean | null
          is_sample: boolean | null
          linked_part_id: string | null
          linked_part_quantity: number | null
          machine_id: string | null
          options: Json | null
          response_value: string | null
          section_name: string | null
          sort_order: string | null
          task_description: string | null
          task_key: string | null
          task_type: string | null
          template_id: string | null
          trigger_response: string | null
          updated_date: string | null
        }
        Insert: {
          category?: string | null
          checklist_id?: string | null
          completed?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_sample?: boolean | null
          linked_part_id?: string | null
          linked_part_quantity?: number | null
          machine_id?: string | null
          options?: Json | null
          response_value?: string | null
          section_name?: string | null
          sort_order?: string | null
          task_description?: string | null
          task_key?: string | null
          task_type?: string | null
          template_id?: string | null
          trigger_response?: string | null
          updated_date?: string | null
        }
        Update: {
          category?: string | null
          checklist_id?: string | null
          completed?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_sample?: boolean | null
          linked_part_id?: string | null
          linked_part_quantity?: number | null
          machine_id?: string | null
          options?: Json | null
          response_value?: string | null
          section_name?: string | null
          sort_order?: string | null
          task_description?: string | null
          task_key?: string | null
          task_type?: string | null
          template_id?: string | null
          trigger_response?: string | null
          updated_date?: string | null
        }
        Relationships: []
      }
      maintenance_checklists: {
        Row: {
          checklist_number: string | null
          completed_date: string | null
          created_date: string | null
          customer_id: string | null
          id: string
          machine_ids: string[] | null
          notes: string | null
          scheduled_date: string | null
          section_notes: Json | null
          status: string | null
          technician_ids: string[] | null
          updated_date: string | null
          visit_date: string | null
        }
        Insert: {
          checklist_number?: string | null
          completed_date?: string | null
          created_date?: string | null
          customer_id?: string | null
          id?: string
          machine_ids?: string[] | null
          notes?: string | null
          scheduled_date?: string | null
          section_notes?: Json | null
          status?: string | null
          technician_ids?: string[] | null
          updated_date?: string | null
          visit_date?: string | null
        }
        Update: {
          checklist_number?: string | null
          completed_date?: string | null
          created_date?: string | null
          customer_id?: string | null
          id?: string
          machine_ids?: string[] | null
          notes?: string | null
          scheduled_date?: string | null
          section_notes?: Json | null
          status?: string | null
          technician_ids?: string[] | null
          updated_date?: string | null
          visit_date?: string | null
        }
        Relationships: []
      }
      maintenance_checklists_backup_20260815: {
        Row: {
          checklist_number: string | null
          completed_date: string | null
          created_date: string | null
          customer_id: string | null
          id: string | null
          machine_ids: string[] | null
          notes: string | null
          scheduled_date: string | null
          section_notes: Json | null
          status: string | null
          technician_ids: string[] | null
          updated_date: string | null
          visit_date: string | null
        }
        Insert: {
          checklist_number?: string | null
          completed_date?: string | null
          created_date?: string | null
          customer_id?: string | null
          id?: string | null
          machine_ids?: string[] | null
          notes?: string | null
          scheduled_date?: string | null
          section_notes?: Json | null
          status?: string | null
          technician_ids?: string[] | null
          updated_date?: string | null
          visit_date?: string | null
        }
        Update: {
          checklist_number?: string | null
          completed_date?: string | null
          created_date?: string | null
          customer_id?: string | null
          id?: string | null
          machine_ids?: string[] | null
          notes?: string | null
          scheduled_date?: string | null
          section_notes?: Json | null
          status?: string | null
          technician_ids?: string[] | null
          updated_date?: string | null
          visit_date?: string | null
        }
        Relationships: []
      }
      maintenance_templates: {
        Row: {
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          is_sample: boolean | null
          machine_type: string
          sections: Json | null
          updated_date: string | null
        }
        Insert: {
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          is_sample?: boolean | null
          machine_type: string
          sections?: Json | null
          updated_date?: string | null
        }
        Update: {
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          is_sample?: boolean | null
          machine_type?: string
          sections?: Json | null
          updated_date?: string | null
        }
        Relationships: []
      }
      maintenance_templates_backup_20260815: {
        Row: {
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string | null
          is_sample: boolean | null
          machine_type: string | null
          sections: Json | null
          updated_date: string | null
        }
        Insert: {
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string | null
          is_sample?: boolean | null
          machine_type?: string | null
          sections?: Json | null
          updated_date?: string | null
        }
        Update: {
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string | null
          is_sample?: boolean | null
          machine_type?: string | null
          sections?: Json | null
          updated_date?: string | null
        }
        Relationships: []
      }
      maintenance_templates_backup_20260815b: {
        Row: {
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string | null
          is_sample: boolean | null
          machine_type: string | null
          sections: Json | null
          updated_date: string | null
        }
        Insert: {
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string | null
          is_sample?: boolean | null
          machine_type?: string | null
          sections?: Json | null
          updated_date?: string | null
        }
        Update: {
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string | null
          is_sample?: boolean | null
          machine_type?: string | null
          sections?: Json | null
          updated_date?: string | null
        }
        Relationships: []
      }
      parts: {
        Row: {
          assembly_labor_cost: number | null
          category: string | null
          compatible_machine_types: Json | null
          cost: number | null
          cost_per_pack: number | null
          cost_usd: number | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          description: string | null
          id: string
          is_assembly: boolean | null
          is_favorite: boolean | null
          is_internal: boolean | null
          is_obsolete: boolean | null
          is_pack: boolean | null
          is_sample: boolean | null
          markup_percentage: number | null
          nonsa_price: number | null
          pack_size: number | null
          part_name: string | null
          part_number: string
          quantity_in_inventory: number | null
          reorder_level: number | null
          sales_price: number | null
          supplier: string | null
          updated_date: string | null
        }
        Insert: {
          assembly_labor_cost?: number | null
          category?: string | null
          compatible_machine_types?: Json | null
          cost?: number | null
          cost_per_pack?: number | null
          cost_usd?: number | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          is_assembly?: boolean | null
          is_favorite?: boolean | null
          is_internal?: boolean | null
          is_obsolete?: boolean | null
          is_pack?: boolean | null
          is_sample?: boolean | null
          markup_percentage?: number | null
          nonsa_price?: number | null
          pack_size?: number | null
          part_name?: string | null
          part_number: string
          quantity_in_inventory?: number | null
          reorder_level?: number | null
          sales_price?: number | null
          supplier?: string | null
          updated_date?: string | null
        }
        Update: {
          assembly_labor_cost?: number | null
          category?: string | null
          compatible_machine_types?: Json | null
          cost?: number | null
          cost_per_pack?: number | null
          cost_usd?: number | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          is_assembly?: boolean | null
          is_favorite?: boolean | null
          is_internal?: boolean | null
          is_obsolete?: boolean | null
          is_pack?: boolean | null
          is_sample?: boolean | null
          markup_percentage?: number | null
          nonsa_price?: number | null
          pack_size?: number | null
          part_name?: string | null
          part_number?: string
          quantity_in_inventory?: number | null
          reorder_level?: number | null
          sales_price?: number | null
          supplier?: string | null
          updated_date?: string | null
        }
        Relationships: []
      }
      pending_users: {
        Row: {
          customer_id: string | null
          email: string
          full_name: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          role: string | null
          technician_id: string | null
        }
        Insert: {
          customer_id?: string | null
          email: string
          full_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string | null
          technician_id?: string | null
        }
        Update: {
          customer_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string | null
          technician_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_users_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          checked_at: string | null
          cost_usd: number | null
          id: string
          notes: string | null
          part_id: string
          part_name: string | null
          part_number: string
          price_changed: boolean | null
          scraped_price: number | null
          status: string | null
          supplier: string
          url: string | null
        }
        Insert: {
          checked_at?: string | null
          cost_usd?: number | null
          id?: string
          notes?: string | null
          part_id: string
          part_name?: string | null
          part_number: string
          price_changed?: boolean | null
          scraped_price?: number | null
          status?: string | null
          supplier: string
          url?: string | null
        }
        Update: {
          checked_at?: string | null
          cost_usd?: number | null
          id?: string
          notes?: string | null
          part_id?: string
          part_name?: string | null
          part_number?: string
          price_changed?: boolean | null
          scraped_price?: number | null
          status?: string | null
          supplier?: string
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_date: string | null
          customer_id: string | null
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          is_customer: boolean | null
          phone: string | null
          role: string | null
          role_id: string | null
          technician_id: string | null
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          customer_id?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_customer?: boolean | null
          phone?: string | null
          role?: string | null
          role_id?: string | null
          technician_id?: string | null
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          customer_id?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_customer?: boolean | null
          phone?: string | null
          role?: string | null
          role_id?: string | null
          technician_id?: string | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_date: string | null
          description: string | null
          id: string
          part_id: string | null
          purchase_order_id: string | null
          quantity_ordered: number | null
          quantity_received: number | null
          received: boolean | null
          received_date: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          description?: string | null
          id?: string
          part_id?: string | null
          purchase_order_id?: string | null
          quantity_ordered?: number | null
          quantity_received?: number | null
          received?: boolean | null
          received_date?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          description?: string | null
          id?: string
          part_id?: string | null
          purchase_order_id?: string | null
          quantity_ordered?: number | null
          quantity_received?: number | null
          received?: boolean | null
          received_date?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_date?: string | null
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          approved_by_user_name: string | null
          created_by: string | null
          created_date: string | null
          currency: string | null
          date_completed: string | null
          exchange_rate: number | null
          id: string
          notes: string | null
          order_date: string | null
          payment_type: string | null
          po_number: string
          shipping_expense: number | null
          shipping_method: string | null
          status: string | null
          subtotal: number | null
          supplier_id: string | null
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number | null
          updated_date: string | null
        }
        Insert: {
          approved_by_user_name?: string | null
          created_by?: string | null
          created_date?: string | null
          currency?: string | null
          date_completed?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          order_date?: string | null
          payment_type?: string | null
          po_number: string
          shipping_expense?: number | null
          shipping_method?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_date?: string | null
        }
        Update: {
          approved_by_user_name?: string | null
          created_by?: string | null
          created_date?: string | null
          currency?: string | null
          date_completed?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          order_date?: string | null
          payment_type?: string | null
          po_number?: string
          shipping_expense?: number | null
          shipping_method?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_date?: string | null
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          category: string | null
          created_date: string | null
          description: string | null
          id: string
          item_type: string | null
          part_id: string | null
          quantity: number | null
          quote_id: string | null
          total_price: number | null
          unit_price: number | null
          updated_date: string | null
        }
        Insert: {
          category?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          item_type?: string | null
          part_id?: string | null
          quantity?: number | null
          quote_id?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_date?: string | null
        }
        Update: {
          category?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          item_type?: string | null
          part_id?: string | null
          quantity?: number | null
          quote_id?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_date?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          converted_to_ticket_id: string | null
          created_by: string | null
          created_date: string | null
          currency: string | null
          customer_id: string | null
          id: string
          notes: string | null
          quote_number: string
          status: string | null
          subject: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          terms_and_conditions: string | null
          total_amount: number | null
          updated_date: string | null
          valid_until: string | null
        }
        Insert: {
          converted_to_ticket_id?: string | null
          created_by?: string | null
          created_date?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          quote_number: string
          status?: string | null
          subject?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_date?: string | null
          valid_until?: string | null
        }
        Update: {
          converted_to_ticket_id?: string | null
          created_by?: string | null
          created_date?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          quote_number?: string
          status?: string | null
          subject?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_date?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_date: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          permissions: Json | null
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          permissions?: Json | null
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          permissions?: Json | null
          updated_date?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_date: string | null
          id: string
          key: string
          updated_date: string | null
          value: string | null
        }
        Insert: {
          created_date?: string | null
          id?: string
          key: string
          updated_date?: string | null
          value?: string | null
        }
        Update: {
          created_date?: string | null
          id?: string
          key?: string
          updated_date?: string | null
          value?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          created_date: string | null
          email: string | null
          id: string
          is_usd: boolean | null
          name: string
          notes: string | null
          phone: string | null
          sales_person: string | null
          updated_date: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_date?: string | null
          email?: string | null
          id?: string
          is_usd?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          sales_person?: string | null
          updated_date?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_date?: string | null
          email?: string | null
          id?: string
          is_usd?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          sales_person?: string | null
          updated_date?: string | null
          website?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          active: boolean | null
          created_date: string | null
          department_id: string
          description: string | null
          id: string
          name: string
          updated_date: string | null
        }
        Insert: {
          active?: boolean | null
          created_date?: string | null
          department_id: string
          description?: string | null
          id?: string
          name: string
          updated_date?: string | null
        }
        Update: {
          active?: boolean | null
          created_date?: string | null
          department_id?: string
          description?: string | null
          id?: string
          name?: string
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          active: boolean | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          is_sample: boolean | null
          notes: string | null
          phone: string | null
          specialties: Json | null
          technician_code: string | null
          updated_date: string | null
        }
        Insert: {
          active?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_sample?: boolean | null
          notes?: string | null
          phone?: string | null
          specialties?: Json | null
          technician_code?: string | null
          updated_date?: string | null
        }
        Update: {
          active?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_sample?: boolean | null
          notes?: string | null
          phone?: string | null
          specialties?: Json | null
          technician_code?: string | null
          updated_date?: string | null
        }
        Relationships: []
      }
      ticket_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_date: string
          details: Json | null
          event_type: string
          from_value: string | null
          id: string
          ticket_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_date?: string
          details?: Json | null
          event_type: string
          from_value?: string | null
          id?: string
          ticket_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_date?: string
          details?: Json | null
          event_type?: string
          from_value?: string | null
          id?: string
          ticket_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_notes: {
        Row: {
          attachments: Json | null
          author_name: string | null
          author_role: string | null
          content: string
          created_by: string | null
          created_date: string | null
          id: string
          is_internal: boolean | null
          ticket_id: string | null
          updated_date: string | null
        }
        Insert: {
          attachments?: Json | null
          author_name?: string | null
          author_role?: string | null
          content: string
          created_by?: string | null
          created_date?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string | null
          updated_date?: string | null
        }
        Update: {
          attachments?: Json | null
          author_name?: string | null
          author_role?: string | null
          content?: string
          created_by?: string | null
          created_date?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string | null
          updated_date?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          attachments: Json | null
          created_by: string | null
          created_date: string | null
          customer_id: string | null
          customer_po_number: string | null
          description: string | null
          id: string
          last_escalation_sent_at: string | null
          last_reminder_sent_at: string | null
          last_reply_role: string | null
          machine_id: string | null
          notes: string | null
          parts: Json | null
          purchase_order_number: string | null
          quote_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by_name: string | null
          resulting_reference_id: string | null
          resulting_reference_type: string | null
          status: string | null
          subject: string
          technician_id: string | null
          ticket_number: string
          ticket_type: string | null
          updated_date: string | null
          urgency: string | null
        }
        Insert: {
          attachments?: Json | null
          created_by?: string | null
          created_date?: string | null
          customer_id?: string | null
          customer_po_number?: string | null
          description?: string | null
          id?: string
          last_escalation_sent_at?: string | null
          last_reminder_sent_at?: string | null
          last_reply_role?: string | null
          machine_id?: string | null
          notes?: string | null
          parts?: Json | null
          purchase_order_number?: string | null
          quote_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_name?: string | null
          resulting_reference_id?: string | null
          resulting_reference_type?: string | null
          status?: string | null
          subject: string
          technician_id?: string | null
          ticket_number: string
          ticket_type?: string | null
          updated_date?: string | null
          urgency?: string | null
        }
        Update: {
          attachments?: Json | null
          created_by?: string | null
          created_date?: string | null
          customer_id?: string | null
          customer_po_number?: string | null
          description?: string | null
          id?: string
          last_escalation_sent_at?: string | null
          last_reminder_sent_at?: string | null
          last_reply_role?: string | null
          machine_id?: string | null
          notes?: string | null
          parts?: Json | null
          purchase_order_number?: string | null
          quote_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_name?: string | null
          resulting_reference_id?: string | null
          resulting_reference_type?: string | null
          status?: string | null
          subject?: string
          technician_id?: string | null
          ticket_number?: string
          ticket_type?: string | null
          updated_date?: string | null
          urgency?: string | null
        }
        Relationships: []
      }
      tickets_backup_20260815: {
        Row: {
          attachments: Json | null
          created_by: string | null
          created_date: string | null
          customer_id: string | null
          customer_po_number: string | null
          description: string | null
          id: string | null
          last_reply_role: string | null
          machine_id: string | null
          notes: string | null
          parts: Json | null
          purchase_order_number: string | null
          quote_id: string | null
          status: string | null
          subject: string | null
          technician_id: string | null
          ticket_number: string | null
          ticket_type: string | null
          updated_date: string | null
          urgency: string | null
        }
        Insert: {
          attachments?: Json | null
          created_by?: string | null
          created_date?: string | null
          customer_id?: string | null
          customer_po_number?: string | null
          description?: string | null
          id?: string | null
          last_reply_role?: string | null
          machine_id?: string | null
          notes?: string | null
          parts?: Json | null
          purchase_order_number?: string | null
          quote_id?: string | null
          status?: string | null
          subject?: string | null
          technician_id?: string | null
          ticket_number?: string | null
          ticket_type?: string | null
          updated_date?: string | null
          urgency?: string | null
        }
        Update: {
          attachments?: Json | null
          created_by?: string | null
          created_date?: string | null
          customer_id?: string | null
          customer_po_number?: string | null
          description?: string | null
          id?: string | null
          last_reply_role?: string | null
          machine_id?: string | null
          notes?: string | null
          parts?: Json | null
          purchase_order_number?: string | null
          quote_id?: string | null
          status?: string | null
          subject?: string | null
          technician_id?: string | null
          ticket_number?: string | null
          ticket_type?: string | null
          updated_date?: string | null
          urgency?: string | null
        }
        Relationships: []
      }
      timecard_entries: {
        Row: {
          created_date: string | null
          department_id: string
          hours: number
          id: string
          notes: string | null
          task_id: string
          timecard_id: string
          updated_date: string | null
        }
        Insert: {
          created_date?: string | null
          department_id: string
          hours?: number
          id?: string
          notes?: string | null
          task_id: string
          timecard_id: string
          updated_date?: string | null
        }
        Update: {
          created_date?: string | null
          department_id?: string
          hours?: number
          id?: string
          notes?: string | null
          task_id?: string
          timecard_id?: string
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timecard_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timecard_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timecard_entries_timecard_id_fkey"
            columns: ["timecard_id"]
            isOneToOne: false
            referencedRelation: "timecards"
            referencedColumns: ["id"]
          },
        ]
      }
      timecards: {
        Row: {
          created_date: string | null
          date: string
          id: string
          notes: string | null
          total_hours: number | null
          updated_date: string | null
          user_id: string
        }
        Insert: {
          created_date?: string | null
          date: string
          id?: string
          notes?: string | null
          total_hours?: number | null
          updated_date?: string | null
          user_id: string
        }
        Update: {
          created_date?: string | null
          date?: string
          id?: string
          notes?: string | null
          total_hours?: number | null
          updated_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer_id: string | null
          date: string | null
          food_expense: number | null
          hotel_expense: number | null
          id: string
          is_sample: boolean | null
          is_weekend_service: boolean | null
          kilometers: number | null
          machine_id: string | null
          notes: string | null
          onsite_hours: number | null
          order_id: string | null
          part_id: string | null
          purchase_order_number: string | null
          quantity: number | null
          service_call_id: string | null
          shipment_method: string | null
          shipping_cost: number | null
          technician_ids: Json | null
          technician_name: string | null
          tolls_expense: number | null
          total_cost: number | null
          tracking_number: string | null
          transaction_id: string | null
          transaction_type: string | null
          travel_hours: number | null
          updated_date: string | null
        }
        Insert: {
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer_id?: string | null
          date?: string | null
          food_expense?: number | null
          hotel_expense?: number | null
          id?: string
          is_sample?: boolean | null
          is_weekend_service?: boolean | null
          kilometers?: number | null
          machine_id?: string | null
          notes?: string | null
          onsite_hours?: number | null
          order_id?: string | null
          part_id?: string | null
          purchase_order_number?: string | null
          quantity?: number | null
          service_call_id?: string | null
          shipment_method?: string | null
          shipping_cost?: number | null
          technician_ids?: Json | null
          technician_name?: string | null
          tolls_expense?: number | null
          total_cost?: number | null
          tracking_number?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          travel_hours?: number | null
          updated_date?: string | null
        }
        Update: {
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer_id?: string | null
          date?: string | null
          food_expense?: number | null
          hotel_expense?: number | null
          id?: string
          is_sample?: boolean | null
          is_weekend_service?: boolean | null
          kilometers?: number | null
          machine_id?: string | null
          notes?: string | null
          onsite_hours?: number | null
          order_id?: string | null
          part_id?: string | null
          purchase_order_number?: string | null
          quantity?: number | null
          service_call_id?: string | null
          shipment_method?: string | null
          shipping_cost?: number | null
          technician_ids?: Json | null
          technician_name?: string | null
          tolls_expense?: number | null
          total_cost?: number | null
          tracking_number?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          travel_hours?: number | null
          updated_date?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_lead: {
        Args: {
          p_acknowledged_at?: string
          p_assigned_to_sales_at?: string
          p_company_name?: string
          p_create_deal?: boolean
          p_deal_amount?: number
          p_deal_name?: string
          p_first_contact_at?: string
          p_first_name?: string
          p_last_name?: string
          p_lead_id: string
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      next_ticket_number: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
