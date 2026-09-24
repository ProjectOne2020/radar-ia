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
      ai_visibility_scores: {
        Row: {
          calculated_at: string | null
          classifier_version: string | null
          client_id: string | null
          code_sha: string | null
          comparability: string | null
          coverage_expected: number | null
          coverage_successful: number | null
          delta_total: number | null
          id: string
          methodology_version: string
          previous_snapshot_id: string | null
          publication_status: string
          score_by_pillar: Json
          score_total: number
          scoring_version: string | null
          session_id: string | null
        }
        Insert: {
          calculated_at?: string | null
          classifier_version?: string | null
          client_id?: string | null
          code_sha?: string | null
          comparability?: string | null
          coverage_expected?: number | null
          coverage_successful?: number | null
          delta_total?: number | null
          id?: string
          methodology_version?: string
          previous_snapshot_id?: string | null
          publication_status?: string
          score_by_pillar: Json
          score_total: number
          scoring_version?: string | null
          session_id?: string | null
        }
        Update: {
          calculated_at?: string | null
          classifier_version?: string | null
          client_id?: string | null
          code_sha?: string | null
          comparability?: string | null
          coverage_expected?: number | null
          coverage_successful?: number | null
          delta_total?: number | null
          id?: string
          methodology_version?: string
          previous_snapshot_id?: string | null
          publication_status?: string
          score_by_pillar?: Json
          score_total?: number
          scoring_version?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_visibility_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_visibility_scores_previous_snapshot_id_fkey"
            columns: ["previous_snapshot_id"]
            isOneToOne: false
            referencedRelation: "ai_visibility_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_visibility_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "measurement_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_listings: {
        Row: {
          android_package_id: string | null
          app_name: string
          app_type: string | null
          city: string | null
          client_id: string | null
          created_at: string | null
          id: string
          ios_app_id: string | null
          landing_url: string | null
        }
        Insert: {
          android_package_id?: string | null
          app_name: string
          app_type?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          ios_app_id?: string | null
          landing_url?: string | null
        }
        Update: {
          android_package_id?: string | null
          app_name?: string
          app_type?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          ios_app_id?: string | null
          landing_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_listings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_findings: {
        Row: {
          audited_at: string | null
          client_id: string | null
          detail_locked: boolean | null
          finding: string
          id: string
          pillar: number
          session_id: string | null
          severity: string | null
        }
        Insert: {
          audited_at?: string | null
          client_id?: string | null
          detail_locked?: boolean | null
          finding: string
          id?: string
          pillar: number
          session_id?: string | null
          severity?: string | null
        }
        Update: {
          audited_at?: string | null
          client_id?: string | null
          detail_locked?: boolean | null
          finding?: string
          id?: string
          pillar?: number
          session_id?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "measurement_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      citations: {
        Row: {
          cited_domain: string | null
          cited_url: string | null
          id: string
          is_client_domain: boolean | null
          is_directory: boolean | null
          tracking_run_id: string | null
        }
        Insert: {
          cited_domain?: string | null
          cited_url?: string | null
          id?: string
          is_client_domain?: boolean | null
          is_directory?: boolean | null
          tracking_run_id?: string | null
        }
        Update: {
          cited_domain?: string | null
          cited_url?: string | null
          id?: string
          is_client_domain?: boolean | null
          is_directory?: boolean | null
          tracking_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "citations_tracking_run_id_fkey"
            columns: ["tracking_run_id"]
            isOneToOne: false
            referencedRelation: "tracking_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_competitors: {
        Row: {
          client_id: string | null
          competitor_client_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          client_id?: string | null
          competitor_client_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          client_id?: string | null
          competitor_client_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_competitors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_competitors_competitor_client_id_fkey"
            columns: ["competitor_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_identity_variants: {
        Row: {
          client_id: string
          created_at: string
          id: string
          kind: string
          source: string
          value: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          kind: string
          source?: string
          value: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          source?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_identity_variants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          business_name: string
          country: string
          created_at: string | null
          currency: string
          email: string | null
          id: string
          niche: string
          onboarding_type: string
          partner_id: string | null
          phone_whatsapp: string
          plan: string
          public_listing_opt_in: boolean
          tax_id: string | null
          verification_status: string
        }
        Insert: {
          business_name: string
          country: string
          created_at?: string | null
          currency: string
          email?: string | null
          id?: string
          niche: string
          onboarding_type: string
          partner_id?: string | null
          phone_whatsapp: string
          plan: string
          public_listing_opt_in?: boolean
          tax_id?: string | null
          verification_status?: string
        }
        Update: {
          business_name?: string
          country?: string
          created_at?: string | null
          currency?: string
          email?: string | null
          id?: string
          niche?: string
          onboarding_type?: string
          partner_id?: string | null
          phone_whatsapp?: string
          plan?: string
          public_listing_opt_in?: boolean
          tax_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_sources: {
        Row: {
          directory_name: string
          directory_url_pattern: string | null
          id: string
          niche: string
          weight_hint: number | null
        }
        Insert: {
          directory_name: string
          directory_url_pattern?: string | null
          id?: string
          niche: string
          weight_hint?: number | null
        }
        Update: {
          directory_name?: string
          directory_url_pattern?: string | null
          id?: string
          niche?: string
          weight_hint?: number | null
        }
        Relationships: []
      }
      enterprise_leads: {
        Row: {
          approved_at: string | null
          business_name: string
          checkout_url: string | null
          city: string | null
          client_id: string | null
          contact_name: string
          country: string | null
          created_at: string
          currency: string | null
          email: string
          id: string
          message: string | null
          phone_whatsapp: string
          quoted_at: string | null
          quoted_recurring_fee: number | null
          quoted_setup_fee: number | null
          status: string
          website_url: string | null
        }
        Insert: {
          approved_at?: string | null
          business_name: string
          checkout_url?: string | null
          city?: string | null
          client_id?: string | null
          contact_name: string
          country?: string | null
          created_at?: string
          currency?: string | null
          email: string
          id?: string
          message?: string | null
          phone_whatsapp: string
          quoted_at?: string | null
          quoted_recurring_fee?: number | null
          quoted_setup_fee?: number | null
          status?: string
          website_url?: string | null
        }
        Update: {
          approved_at?: string | null
          business_name?: string
          checkout_url?: string | null
          city?: string | null
          client_id?: string | null
          contact_name?: string
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string
          id?: string
          message?: string | null
          phone_whatsapp?: string
          quoted_at?: string | null
          quoted_recurring_fee?: number | null
          quoted_setup_fee?: number | null
          status?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      free_audits: {
        Row: {
          client_id: string | null
          domain: string | null
          id: string
          ip_address: string | null
          otp_attempts: number
          otp_last_sent_at: string | null
          otp_sends: number
          phone_whatsapp: string | null
          requested_at: string | null
          whatsapp_verified: boolean | null
        }
        Insert: {
          client_id?: string | null
          domain?: string | null
          id?: string
          ip_address?: string | null
          otp_attempts?: number
          otp_last_sent_at?: string | null
          otp_sends?: number
          phone_whatsapp?: string | null
          requested_at?: string | null
          whatsapp_verified?: boolean | null
        }
        Update: {
          client_id?: string | null
          domain?: string | null
          id?: string
          ip_address?: string | null
          otp_attempts?: number
          otp_last_sent_at?: string | null
          otp_sends?: number
          phone_whatsapp?: string | null
          requested_at?: string | null
          whatsapp_verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "free_audits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          apple_business_url: string | null
          bing_places_url: string | null
          city: string | null
          client_id: string | null
          created_at: string | null
          gbp_url: string | null
          has_own_site: boolean | null
          id: string
          name: string
          phone: string | null
          website_url: string | null
        }
        Insert: {
          address?: string | null
          apple_business_url?: string | null
          bing_places_url?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          gbp_url?: string | null
          has_own_site?: boolean | null
          id?: string
          name: string
          phone?: string | null
          website_url?: string | null
        }
        Update: {
          address?: string | null
          apple_business_url?: string | null
          bing_places_url?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          gbp_url?: string | null
          has_own_site?: boolean | null
          id?: string
          name?: string
          phone?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_sessions: {
        Row: {
          classifier_version: string
          client_id: string
          code_sha: string | null
          completed_at: string | null
          engine_set: string[]
          execution_status: string
          expected_runs: number
          failure_reason: string | null
          id: string
          methodology_version: string
          prompt_set_hash: string
          publication_status: string
          scoring_version: string
          started_at: string
          trigger_source: string
        }
        Insert: {
          classifier_version: string
          client_id: string
          code_sha?: string | null
          completed_at?: string | null
          engine_set: string[]
          execution_status?: string
          expected_runs: number
          failure_reason?: string | null
          id?: string
          methodology_version: string
          prompt_set_hash: string
          publication_status?: string
          scoring_version: string
          started_at?: string
          trigger_source: string
        }
        Update: {
          classifier_version?: string
          client_id?: string
          code_sha?: string | null
          completed_at?: string | null
          engine_set?: string[]
          execution_status?: string
          expected_runs?: number
          failure_reason?: string | null
          id?: string
          methodology_version?: string
          prompt_set_hash?: string
          publication_status?: string
          scoring_version?: string
          started_at?: string
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_intake: {
        Row: {
          client_id: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          gbp_notes: string | null
          has_gbp: boolean | null
          id: string
          invite_email: string | null
          website_access_method: string | null
          website_platform: string | null
        }
        Insert: {
          client_id: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          gbp_notes?: string | null
          has_gbp?: boolean | null
          id?: string
          invite_email?: string | null
          website_access_method?: string | null
          website_platform?: string | null
        }
        Update: {
          client_id?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          gbp_notes?: string | null
          has_gbp?: boolean | null
          id?: string
          invite_email?: string | null
          website_access_method?: string | null
          website_platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_intake_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_accounts: {
        Row: {
          agency_name: string
          api_key: string | null
          created_at: string | null
          id: string
          revenue_share_pct: number | null
          status: string | null
        }
        Insert: {
          agency_name: string
          api_key?: string | null
          created_at?: string | null
          id?: string
          revenue_share_pct?: number | null
          status?: string | null
        }
        Update: {
          agency_name?: string
          api_key?: string | null
          created_at?: string | null
          id?: string
          revenue_share_pct?: number | null
          status?: string | null
        }
        Relationships: []
      }
      partner_applications: {
        Row: {
          agency_name: string
          client_count: string | null
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          partner_account_id: string | null
          phone_whatsapp: string
          reviewed_at: string | null
          status: string
          website_url: string | null
        }
        Insert: {
          agency_name: string
          client_count?: string | null
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          partner_account_id?: string | null
          phone_whatsapp: string
          reviewed_at?: string | null
          status?: string
          website_url?: string | null
        }
        Update: {
          agency_name?: string
          client_count?: string | null
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          partner_account_id?: string | null
          phone_whatsapp?: string
          reviewed_at?: string | null
          status?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_applications_partner_account_id_fkey"
            columns: ["partner_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_sets: {
        Row: {
          active: boolean | null
          category: string | null
          client_id: string | null
          created_at: string | null
          id: string
          prompt_class: string | null
          prompt_text: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          prompt_class?: string | null
          prompt_text: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          prompt_class?: string | null
          prompt_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_sets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank: {
        Row: {
          active: boolean
          category_type: string
          country: string
          created_at: string
          id: string
          question_text: string
          rubro: string
          rubro_label: string
        }
        Insert: {
          active?: boolean
          category_type?: string
          country: string
          created_at?: string
          id?: string
          question_text: string
          rubro: string
          rubro_label: string
        }
        Update: {
          active?: boolean
          category_type?: string
          country?: string
          created_at?: string
          id?: string
          question_text?: string
          rubro?: string
          rubro_label?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          bucket: string
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      sku_catalogs: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          merchant_center_id: string | null
          platform: string | null
          sku_count: number | null
          store_url: string | null
          ucp_enabled: boolean | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          merchant_center_id?: string | null
          platform?: string | null
          sku_count?: number | null
          store_url?: string | null
          ucp_enabled?: boolean | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          merchant_center_id?: string | null
          platform?: string | null
          sku_count?: number | null
          store_url?: string | null
          ucp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sku_catalogs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          client_id: string | null
          created_at: string | null
          current_period_end: string | null
          id: string
          plan: string
          setup_fee_paid: boolean | null
          status: string
          stripe_subscription_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan: string
          setup_fee_paid?: boolean | null
          status: string
          stripe_subscription_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan?: string
          setup_fee_paid?: boolean | null
          status?: string
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_runs: {
        Row: {
          attempt: number
          classifier_version: string | null
          client_id: string | null
          engine: string
          id: string
          is_canonical: boolean
          mention_method: string | null
          mentioned: boolean
          model_requested: string | null
          model_resolved: string | null
          outcome: string
          prompt_class: string | null
          prompt_hash: string | null
          prompt_id: string | null
          prompt_text_executed: string | null
          provider: string | null
          request_config: Json | null
          request_config_hash: string | null
          response_raw: string | null
          run_at: string | null
          session_id: string | null
        }
        Insert: {
          attempt?: number
          classifier_version?: string | null
          client_id?: string | null
          engine: string
          id?: string
          is_canonical?: boolean
          mention_method?: string | null
          mentioned: boolean
          model_requested?: string | null
          model_resolved?: string | null
          outcome?: string
          prompt_class?: string | null
          prompt_hash?: string | null
          prompt_id?: string | null
          prompt_text_executed?: string | null
          provider?: string | null
          request_config?: Json | null
          request_config_hash?: string | null
          response_raw?: string | null
          run_at?: string | null
          session_id?: string | null
        }
        Update: {
          attempt?: number
          classifier_version?: string | null
          client_id?: string | null
          engine?: string
          id?: string
          is_canonical?: boolean
          mention_method?: string | null
          mentioned?: boolean
          model_requested?: string | null
          model_resolved?: string | null
          outcome?: string
          prompt_class?: string | null
          prompt_hash?: string | null
          prompt_id?: string | null
          prompt_text_executed?: string | null
          provider?: string | null
          request_config?: Json | null
          request_config_hash?: string | null
          response_raw?: string | null
          run_at?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "measurement_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_consumptions: {
        Row: {
          client_id: string
          consumed_at: string
          grant_id: string
          session_id: string
        }
        Insert: {
          client_id: string
          consumed_at?: string
          grant_id: string
          session_id: string
        }
        Update: {
          client_id?: string
          consumed_at?: string
          grant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_consumptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_consumptions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "trial_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_consumptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "measurement_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_grants: {
        Row: {
          active: boolean
          audits_remaining: number
          client_id: string
          created_at: string
          granted_plan: string
          had_subscription: boolean
          id: string
          original_current_period_end: string | null
          original_plan: string | null
          original_setup_fee_paid: boolean | null
          original_status: string | null
          original_stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean
          audits_remaining: number
          client_id: string
          created_at?: string
          granted_plan: string
          had_subscription: boolean
          id?: string
          original_current_period_end?: string | null
          original_plan?: string | null
          original_setup_fee_paid?: boolean | null
          original_status?: string | null
          original_stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean
          audits_remaining?: number
          client_id?: string
          created_at?: string
          granted_plan?: string
          had_subscription?: boolean
          id?: string
          original_current_period_end?: string | null
          original_plan?: string | null
          original_setup_fee_paid?: boolean | null
          original_status?: string | null
          original_stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_grants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      question_bank_coverage: {
        Row: {
          count_distinct: number | null
          count_total: number | null
          country: string | null
          is_complete: boolean | null
          rubro: string | null
          rubro_label: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_scores_by_day: {
        Args: { days_back?: number }
        Returns: {
          count: number
          day: string
        }[]
      }
      consume_trial_audit_for_session: {
        Args: { p_client_id: string; p_session_id: string }
        Returns: string
      }
      current_client_id: { Args: never; Returns: string }
      question_bank_coverage: {
        Args: never
        Returns: {
          active: number
          country: string
          rubro: string
          total: number
        }[]
      }
      select_1: { Args: never; Returns: number }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
