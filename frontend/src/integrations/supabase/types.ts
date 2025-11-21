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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          access_token: string | null
          company: string | null
          created_at: string
          email: string
          expires_at: string | null
          full_name: string
          id: string
          ip_address: unknown | null
          listing_id: string
          magic_token: string | null
          nda_signed_at: string | null
          phone: string | null
          signature: string | null
          status: string | null
        }
        Insert: {
          access_token?: string | null
          company?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          full_name: string
          id?: string
          ip_address?: unknown | null
          listing_id: string
          magic_token?: string | null
          nda_signed_at?: string | null
          phone?: string | null
          signature?: string | null
          status?: string | null
        }
        Update: {
          access_token?: string | null
          company?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          full_name?: string
          id?: string
          ip_address?: unknown | null
          listing_id?: string
          magic_token?: string | null
          nda_signed_at?: string | null
          phone?: string | null
          signature?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: unknown | null
          listing_id: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown | null
          listing_id?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown | null
          listing_id?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      email_interactions: {
        Row: {
          created_at: string
          email_body: string | null
          email_subject: string | null
          enrollment_id: string | null
          id: string
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          metadata: Json | null
          prospect_id: string
        }
        Insert: {
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          enrollment_id?: string | null
          id?: string
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          metadata?: Json | null
          prospect_id: string
        }
        Update: {
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          enrollment_id?: string | null
          id?: string
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          metadata?: Json | null
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_interactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "listing_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_enrollments: {
        Row: {
          completed_at: string | null
          current_step: number
          id: string
          next_email_at: string | null
          prospect_id: string
          sequence_id: string
          started_at: string
          status: Database["public"]["Enums"]["enrollment_status"]
        }
        Insert: {
          completed_at?: string | null
          current_step?: number
          id?: string
          next_email_at?: string | null
          prospect_id: string
          sequence_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Update: {
          completed_at?: string | null
          current_step?: number
          id?: string
          next_email_at?: string | null
          prospect_id?: string
          sequence_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_enrollments_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "listing_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_template: boolean | null
          listing_id: string | null
          name: string
          sequence_type: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean | null
          listing_id?: string | null
          name: string
          sequence_type: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean | null
          listing_id?: string | null
          name?: string
          sequence_type?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_assets: {
        Row: {
          asset_type: string
          created_at: string
          filename: string
          id: string
          listing_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          asset_type: string
          created_at?: string
          filename: string
          id?: string
          listing_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          filename?: string
          id?: string
          listing_id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_assets_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_prospects: {
        Row: {
          call_demo_date: string | null
          company: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          listing_id: string
          metadata: Json | null
          nda_signed_date: string | null
          notes: string | null
          response_date: string | null
          reviewing_date: string | null
          sent_outreach_date: string | null
          stage: Database["public"]["Enums"]["prospect_stage"]
          updated_at: string
        }
        Insert: {
          call_demo_date?: string | null
          company: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          listing_id: string
          metadata?: Json | null
          nda_signed_date?: string | null
          notes?: string | null
          response_date?: string | null
          reviewing_date?: string | null
          sent_outreach_date?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          updated_at?: string
        }
        Update: {
          call_demo_date?: string | null
          company?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          listing_id?: string
          metadata?: Json | null
          nda_signed_date?: string | null
          notes?: string | null
          response_date?: string | null
          reviewing_date?: string | null
          sent_outreach_date?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_prospects_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          asking_price: number | null
          company_name: string | null
          company_website: string | null
          copyrights: string[] | null
          created_at: string
          data_breakdown: Json | null
          description: string | null
          ebitda: number | null
          email_automation_enabled: boolean | null
          email_domain_preference:
            | Database["public"]["Enums"]["email_domain_preference"]
            | null
          id: string
          industry: string | null
          is_anonymized: boolean
          is_password_protected: boolean | null
          location: string | null
          meta: Json | null
          password_hash: string | null
          patent_count: number | null
          patent_file_url: string | null
          patents: string[] | null
          published_at: string | null
          revenue: number | null
          scraped_data: Json | null
          share_token: string | null
          slug: string
          source_code_repository: string | null
          status: string | null
          tenant_id: string
          title: string
          trademarks: string[] | null
          updated_at: string
          visibility_level: string | null
        }
        Insert: {
          asking_price?: number | null
          company_name?: string | null
          company_website?: string | null
          copyrights?: string[] | null
          created_at?: string
          data_breakdown?: Json | null
          description?: string | null
          ebitda?: number | null
          email_automation_enabled?: boolean | null
          email_domain_preference?:
            | Database["public"]["Enums"]["email_domain_preference"]
            | null
          id?: string
          industry?: string | null
          is_anonymized?: boolean
          is_password_protected?: boolean | null
          location?: string | null
          meta?: Json | null
          password_hash?: string | null
          patent_count?: number | null
          patent_file_url?: string | null
          patents?: string[] | null
          published_at?: string | null
          revenue?: number | null
          scraped_data?: Json | null
          share_token?: string | null
          slug: string
          source_code_repository?: string | null
          status?: string | null
          tenant_id: string
          title: string
          trademarks?: string[] | null
          updated_at?: string
          visibility_level?: string | null
        }
        Update: {
          asking_price?: number | null
          company_name?: string | null
          company_website?: string | null
          copyrights?: string[] | null
          created_at?: string
          data_breakdown?: Json | null
          description?: string | null
          ebitda?: number | null
          email_automation_enabled?: boolean | null
          email_domain_preference?:
            | Database["public"]["Enums"]["email_domain_preference"]
            | null
          id?: string
          industry?: string | null
          is_anonymized?: boolean
          is_password_protected?: boolean | null
          location?: string | null
          meta?: Json | null
          password_hash?: string | null
          patent_count?: number | null
          patent_file_url?: string | null
          patents?: string[] | null
          published_at?: string | null
          revenue?: number | null
          scraped_data?: Json | null
          share_token?: string | null
          slug?: string
          source_code_repository?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
          trademarks?: string[] | null
          updated_at?: string
          visibility_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      qna_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qna_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "qna_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      qna_threads: {
        Row: {
          access_request_id: string | null
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          asked_by: string | null
          created_at: string
          id: string
          is_public: boolean | null
          listing_id: string
          question: string
          status: string | null
          updated_at: string
        }
        Insert: {
          access_request_id?: string | null
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          asked_by?: string | null
          created_at?: string
          id?: string
          is_public?: boolean | null
          listing_id: string
          question: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          access_request_id?: string | null
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          asked_by?: string | null
          created_at?: string
          id?: string
          is_public?: boolean | null
          listing_id?: string
          question?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qna_threads_access_request_id_fkey"
            columns: ["access_request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qna_threads_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_listing: {
        Args: { _listing_id: string; _user_id: string }
        Returns: boolean
      }
      has_nda_access: {
        Args: { _listing_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "reviewer" | "buyer"
      email_domain_preference: "dynamics" | "platform" | "client"
      enrollment_status: "active" | "paused" | "completed" | "cancelled"
      interaction_type: "sent" | "opened" | "clicked" | "replied" | "bounced"
      prospect_stage:
        | "unknown"
        | "new"
        | "disqualified"
        | "sent_outreach"
        | "reviewing"
        | "nda_signed"
        | "loi_submitted"
        | "passed"
        | "buyer"
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
    Enums: {
      app_role: ["admin", "editor", "reviewer", "buyer"],
      email_domain_preference: ["dynamics", "platform", "client"],
      enrollment_status: ["active", "paused", "completed", "cancelled"],
      interaction_type: ["sent", "opened", "clicked", "replied", "bounced"],
      prospect_stage: [
        "unknown",
        "new",
        "disqualified",
        "sent_outreach",
        "reviewing",
        "nda_signed",
        "loi_submitted",
        "passed",
        "buyer",
      ],
    },
  },
} as const
