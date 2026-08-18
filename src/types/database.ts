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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_visibility_scores: {
        Row: {
          calculated_at: string | null
          client_id: string | null
          id: string
          score_by_pillar: Json
          score_total: number
        }
        Insert: {
          calculated_at?: string | null
          client_id?: string | null
          id?: string
          score_by_pillar: Json
          score_total: number
        }
        Update: {
          calculated_at?: string | null
          client_id?: string | null
          id?: string
          score_by_pillar?: Json
          score_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_visibility_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      app_listings: {
        Row: {
          android_package_id: string | null
          app_name: string
          client_id: string | null
          created_at: string | null
          id: string
          ios_app_id: string | null
          landing_url: string | null
        }
        Insert: {
          android_package_id?: string | null
          app_name: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          ios_app_id?: string | null
          landing_url?: string | null
        }
        Update: {
          android_package_id?: string | null
          app_name?: string
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
          severity: string | null
        }
        Insert: {
          audited_at?: string | null
          client_id?: string | null
          detail_locked?: boolean | null
          finding: string
          id?: string
          pillar: number
          severity?: string | null
        }
        Update: {
          audited_at?: string | null
          client_id?: string | null
          detail_locked?: boolean | null
          finding?: string
          id?: string
          pillar?: number
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
      free_audits: {
        Row: {
          domain: string | null
          id: string
          ip_address: string | null
          phone_whatsapp: string | null
          requested_at: string | null
          whatsapp_verified: boolean | null
        }
        Insert: {
          domain?: string | null
          id?: string
          ip_address?: string | null
          phone_whatsapp?: string | null
          requested_at?: string | null
          whatsapp_verified?: boolean | null
        }
        Update: {
          domain?: string | null
          id?: string
          ip_address?: string | null
          phone_whatsapp?: string | null
          requested_at?: string | null
          whatsapp_verified?: boolean | null
        }
        Relationships: []
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
      prompt_sets: {
        Row: {
          active: boolean | null
          category: string | null
          client_id: string | null
          created_at: string | null
          id: string
          prompt_text: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          prompt_text: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
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
          client_id: string | null
          engine: string
          id: string
          mentioned: boolean
          prompt_id: string | null
          response_raw: string | null
          run_at: string | null
        }
        Insert: {
          client_id?: string | null
          engine: string
          id?: string
          mentioned: boolean
          prompt_id?: string | null
          response_raw?: string | null
          run_at?: string | null
        }
        Update: {
          client_id?: string | null
          engine?: string
          id?: string
          mentioned?: boolean
          prompt_id?: string | null
          response_raw?: string | null
          run_at?: string | null
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_client_id: { Args: never; Returns: string }
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

export const Constants = {
  public: {
    Enums: {},
  },
} as const
