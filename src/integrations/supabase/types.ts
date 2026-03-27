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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      algorithm_results: {
        Row: {
          ahp_data: Json | null
          computed_at: string | null
          cosine_similarity: number | null
          employee_id: string | null
          employee_interview_id: string | null
          final_readiness: number | null
          gap_analysis: Json | null
          id: string
          jaccard_binary: number | null
          jaccard_weighted: number | null
          manager_interview_id: string | null
          manager_readiness_adjustment: number | null
          normalized_gap_score: number | null
          overall_readiness: number | null
          role_id: string | null
          tfidf_rarity: Json | null
          upskilling_paths: Json | null
        }
        Insert: {
          ahp_data?: Json | null
          computed_at?: string | null
          cosine_similarity?: number | null
          employee_id?: string | null
          employee_interview_id?: string | null
          final_readiness?: number | null
          gap_analysis?: Json | null
          id?: string
          jaccard_binary?: number | null
          jaccard_weighted?: number | null
          manager_interview_id?: string | null
          manager_readiness_adjustment?: number | null
          normalized_gap_score?: number | null
          overall_readiness?: number | null
          role_id?: string | null
          tfidf_rarity?: Json | null
          upskilling_paths?: Json | null
        }
        Update: {
          ahp_data?: Json | null
          computed_at?: string | null
          cosine_similarity?: number | null
          employee_id?: string | null
          employee_interview_id?: string | null
          final_readiness?: number | null
          gap_analysis?: Json | null
          id?: string
          jaccard_binary?: number | null
          jaccard_weighted?: number | null
          manager_interview_id?: string | null
          manager_readiness_adjustment?: number | null
          normalized_gap_score?: number | null
          overall_readiness?: number | null
          role_id?: string | null
          tfidf_rarity?: Json | null
          upskilling_paths?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "algorithm_results_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "algorithm_results_employee_interview_id_fkey"
            columns: ["employee_interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "algorithm_results_manager_interview_id_fkey"
            columns: ["manager_interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "algorithm_results_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      bootcamp_progress: {
        Row: {
          bootcamp_id: string | null
          completed_at: string | null
          employee_id: string | null
          id: string
          module_index: number | null
          notes: string | null
          status: string | null
        }
        Insert: {
          bootcamp_id?: string | null
          completed_at?: string | null
          employee_id?: string | null
          id?: string
          module_index?: number | null
          notes?: string | null
          status?: string | null
        }
        Update: {
          bootcamp_id?: string | null
          completed_at?: string | null
          employee_id?: string | null
          id?: string
          module_index?: number | null
          notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bootcamp_progress_bootcamp_id_fkey"
            columns: ["bootcamp_id"]
            isOneToOne: false
            referencedRelation: "bootcamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bootcamp_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      bootcamps: {
        Row: {
          algorithm_result_id: string | null
          employee_id: string | null
          expected_outcomes: Json | null
          generated_at: string | null
          hours_per_week: number | null
          id: string
          milestones: Json | null
          modules: Json | null
          status: string | null
          target_role_id: string | null
          title: string | null
          total_duration_weeks: number | null
        }
        Insert: {
          algorithm_result_id?: string | null
          employee_id?: string | null
          expected_outcomes?: Json | null
          generated_at?: string | null
          hours_per_week?: number | null
          id?: string
          milestones?: Json | null
          modules?: Json | null
          status?: string | null
          target_role_id?: string | null
          title?: string | null
          total_duration_weeks?: number | null
        }
        Update: {
          algorithm_result_id?: string | null
          employee_id?: string | null
          expected_outcomes?: Json | null
          generated_at?: string | null
          hours_per_week?: number | null
          id?: string
          milestones?: Json | null
          modules?: Json | null
          status?: string | null
          target_role_id?: string | null
          title?: string | null
          total_duration_weeks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bootcamps_algorithm_result_id_fkey"
            columns: ["algorithm_result_id"]
            isOneToOne: false
            referencedRelation: "algorithm_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bootcamps_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bootcamps_target_role_id_fkey"
            columns: ["target_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_skills: {
        Row: {
          confidence: string | null
          employee_id: string | null
          evidence: string | null
          id: string
          proficiency: number | null
          skill_name: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          confidence?: string | null
          employee_id?: string | null
          evidence?: string | null
          id?: string
          proficiency?: number | null
          skill_name: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence?: string | null
          employee_id?: string | null
          evidence?: string | null
          id?: string
          proficiency?: number | null
          skill_name?: string
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_skills_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          avatar_color: string | null
          avatar_initials: string | null
          created_at: string | null
          department: string | null
          email: string | null
          id: string
          job_title: string | null
          learning_agility: number | null
          name: string
          past_performance_reviews: Json | null
          performance_score: number | null
          tenure_years: number | null
          training_history: Json | null
        }
        Insert: {
          avatar_color?: string | null
          avatar_initials?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          learning_agility?: number | null
          name: string
          past_performance_reviews?: Json | null
          performance_score?: number | null
          tenure_years?: number | null
          training_history?: Json | null
        }
        Update: {
          avatar_color?: string | null
          avatar_initials?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          learning_agility?: number | null
          name?: string
          past_performance_reviews?: Json | null
          performance_score?: number | null
          tenure_years?: number | null
          training_history?: Json | null
        }
        Relationships: []
      }
      interview_invitations: {
        Row: {
          accepted_at: string | null
          employee_id: string | null
          expires_at: string | null
          id: string
          interview_id: string | null
          invited_at: string | null
          invited_by_manager: string
          message: string | null
          preset_pack: string | null
          status: string | null
          target_role_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          interview_id?: string | null
          invited_at?: string | null
          invited_by_manager: string
          message?: string | null
          preset_pack?: string | null
          status?: string | null
          target_role_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          interview_id?: string | null
          invited_at?: string | null
          invited_by_manager?: string
          message?: string | null
          preset_pack?: string | null
          status?: string | null
          target_role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_invitations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_invitations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_invitations_target_role_id_fkey"
            columns: ["target_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          completed_at: string | null
          concerns: Json | null
          conversation_history: Json | null
          employee_id: string | null
          extracted_skills: Json | null
          hidden_role_suggestion: string | null
          id: string
          insufficient_evidence: Json | null
          interview_notes: string | null
          interview_type: string | null
          interviewer_name: string | null
          interviewer_title: string | null
          leadership_potential_observed: number | null
          learning_agility_observed: number | null
          manager_confidence_score: number | null
          potential_indicators: Json | null
          questions_asked: number | null
          started_at: string | null
          status: string | null
          target_role_id: string | null
          unexpected_skills: Json | null
        }
        Insert: {
          completed_at?: string | null
          concerns?: Json | null
          conversation_history?: Json | null
          employee_id?: string | null
          extracted_skills?: Json | null
          hidden_role_suggestion?: string | null
          id?: string
          insufficient_evidence?: Json | null
          interview_notes?: string | null
          interview_type?: string | null
          interviewer_name?: string | null
          interviewer_title?: string | null
          leadership_potential_observed?: number | null
          learning_agility_observed?: number | null
          manager_confidence_score?: number | null
          potential_indicators?: Json | null
          questions_asked?: number | null
          started_at?: string | null
          status?: string | null
          target_role_id?: string | null
          unexpected_skills?: Json | null
        }
        Update: {
          completed_at?: string | null
          concerns?: Json | null
          conversation_history?: Json | null
          employee_id?: string | null
          extracted_skills?: Json | null
          hidden_role_suggestion?: string | null
          id?: string
          insufficient_evidence?: Json | null
          interview_notes?: string | null
          interview_type?: string | null
          interviewer_name?: string | null
          interviewer_title?: string | null
          leadership_potential_observed?: number | null
          learning_agility_observed?: number | null
          manager_confidence_score?: number | null
          potential_indicators?: Json | null
          questions_asked?: number | null
          started_at?: string | null
          status?: string | null
          target_role_id?: string | null
          unexpected_skills?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_target_role_id_fkey"
            columns: ["target_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      reorg_matches: {
        Row: {
          computed_at: string | null
          cosine_similarity: number | null
          department_from: string | null
          department_to: string | null
          employee_id: string | null
          gaps_remaining: Json | null
          id: string
          immediate_readiness: boolean | null
          readiness_percent: number | null
          role_id: string | null
          transfer_type: string | null
          weeks_to_full_readiness: number | null
        }
        Insert: {
          computed_at?: string | null
          cosine_similarity?: number | null
          department_from?: string | null
          department_to?: string | null
          employee_id?: string | null
          gaps_remaining?: Json | null
          id?: string
          immediate_readiness?: boolean | null
          readiness_percent?: number | null
          role_id?: string | null
          transfer_type?: string | null
          weeks_to_full_readiness?: number | null
        }
        Update: {
          computed_at?: string | null
          cosine_similarity?: number | null
          department_from?: string | null
          department_to?: string | null
          employee_id?: string | null
          gaps_remaining?: Json | null
          id?: string
          immediate_readiness?: boolean | null
          readiness_percent?: number | null
          role_id?: string | null
          transfer_type?: string | null
          weeks_to_full_readiness?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reorg_matches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorg_matches_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          algorithm_result_id: string | null
          employee_id: string | null
          generated_at: string | null
          id: string
          report_markdown: string | null
          role_id: string | null
        }
        Insert: {
          algorithm_result_id?: string | null
          employee_id?: string | null
          generated_at?: string | null
          id?: string
          report_markdown?: string | null
          role_id?: string | null
        }
        Update: {
          algorithm_result_id?: string | null
          employee_id?: string | null
          generated_at?: string | null
          id?: string
          report_markdown?: string | null
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_algorithm_result_id_fkey"
            columns: ["algorithm_result_id"]
            isOneToOne: false
            referencedRelation: "algorithm_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          department: string | null
          description: string | null
          headcount_needed: number | null
          id: string
          is_open: boolean | null
          required_skills: Json | null
          strategic_weights: Json | null
          title: string
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          description?: string | null
          headcount_needed?: number | null
          id?: string
          is_open?: boolean | null
          required_skills?: Json | null
          strategic_weights?: Json | null
          title: string
        }
        Update: {
          created_at?: string | null
          department?: string | null
          description?: string | null
          headcount_needed?: number | null
          id?: string
          is_open?: boolean | null
          required_skills?: Json | null
          strategic_weights?: Json | null
          title?: string
        }
        Relationships: []
      }
      skills_catalog: {
        Row: {
          category: string | null
          description: string | null
          difficulty: number | null
          id: string
          is_future_skill: boolean | null
          name: string
          strategic_priority: number | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          difficulty?: number | null
          id?: string
          is_future_skill?: boolean | null
          name: string
          strategic_priority?: number | null
        }
        Update: {
          category?: string | null
          description?: string | null
          difficulty?: number | null
          id?: string
          is_future_skill?: boolean | null
          name?: string
          strategic_priority?: number | null
        }
        Relationships: []
      }
      strategy_documents: {
        Row: {
          document_type: string | null
          extracted_future_skills: Json | null
          extracted_initiatives: Json | null
          id: string
          is_active: boolean | null
          processed: boolean | null
          raw_text: string | null
          summary: string | null
          time_horizon: string | null
          title: string
          uploaded_at: string | null
        }
        Insert: {
          document_type?: string | null
          extracted_future_skills?: Json | null
          extracted_initiatives?: Json | null
          id?: string
          is_active?: boolean | null
          processed?: boolean | null
          raw_text?: string | null
          summary?: string | null
          time_horizon?: string | null
          title: string
          uploaded_at?: string | null
        }
        Update: {
          document_type?: string | null
          extracted_future_skills?: Json | null
          extracted_initiatives?: Json | null
          id?: string
          is_active?: boolean | null
          processed?: boolean | null
          raw_text?: string | null
          summary?: string | null
          time_horizon?: string | null
          title?: string
          uploaded_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          employee_id: string | null
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          employee_id?: string | null
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          employee_id?: string | null
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: { _user_id: string }; Returns: string }
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
