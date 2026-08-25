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
      app_themes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          theme: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
          theme: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          theme?: Json
          updated_at?: string
        }
        Relationships: []
      }
      learning_sessions: {
        Row: {
          created_at: string
          duration: number | null
          end_time: string | null
          id: string
          pasukim_covered: string[] | null
          perek: number
          sefer_id: number
          sefer_name: string
          start_time: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration?: number | null
          end_time?: string | null
          id?: string
          pasukim_covered?: string[] | null
          perek: number
          sefer_id: number
          sefer_name: string
          start_time: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration?: number | null
          end_time?: string | null
          id?: string
          pasukim_covered?: string[] | null
          perek?: number
          sefer_id?: number
          sefer_name?: string
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      migration_logs: {
        Row: {
          error: string | null
          executed_at: string
          executed_by: string | null
          id: string
          name: string
          sql_content: string | null
          success: boolean
        }
        Insert: {
          error?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          name: string
          sql_content?: string | null
          success?: boolean
        }
        Update: {
          error?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          name?: string
          sql_content?: string | null
          success?: boolean
        }
        Relationships: []
      }
      omer_email_reminders: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_sent_date: string | null
          reminder_time: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_sent_date?: string | null
          reminder_time: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_sent_date?: string | null
          reminder_time?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      omer_whatsapp_reminders: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_sent_date: string | null
          phone_number: string
          reminder_time: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sent_date?: string | null
          phone_number: string
          reminder_time: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sent_date?: string | null
          phone_number?: string
          reminder_time?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          display_name: string | null
          id: string
          requested_role: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          requested_role?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          requested_role?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          reminders: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          reminders?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          reminders?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      siddur: {
        Row: {
          cat_name: string
          category: string
          created_at: string
          id: string
          lines: Json
          nusach: string
          section_idx: number
          title: string
          updated_at: string
        }
        Insert: {
          cat_name: string
          category: string
          created_at?: string
          id?: string
          lines: Json
          nusach: string
          section_idx: number
          title: string
          updated_at?: string
        }
        Update: {
          cat_name?: string
          category?: string
          created_at?: string
          id?: string
          lines?: Json
          nusach?: string
          section_idx?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      siddur_themes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          theme: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
          theme: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          theme?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_answers: {
        Row: {
          created_at: string
          id: number
          is_shared: boolean | null
          mefaresh: string
          question_id: number
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_shared?: boolean | null
          mefaresh: string
          question_id: number
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          is_shared?: boolean | null
          mefaresh?: string
          question_id?: number
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "user_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bookmarks: {
        Row: {
          created_at: string
          id: string
          note: string | null
          pasuk_id: string
          pasuk_text: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          pasuk_id: string
          pasuk_text: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          pasuk_id?: string
          pasuk_text?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_content: {
        Row: {
          content_text: string
          content_type: string
          created_at: string
          id: string
          is_shared: boolean | null
          mefaresh: string | null
          pasuk_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_text: string
          content_type: string
          created_at?: string
          id?: string
          is_shared?: boolean | null
          mefaresh?: string | null
          pasuk_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_text?: string
          content_type?: string
          created_at?: string
          id?: string
          is_shared?: boolean | null
          mefaresh?: string | null
          pasuk_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_highlights: {
        Row: {
          color: string
          created_at: string
          end_index: number
          highlight_text: string
          id: string
          pasuk_id: string
          start_index: number
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          end_index: number
          highlight_text: string
          id?: string
          pasuk_id: string
          start_index: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          end_index?: number
          highlight_text?: string
          id?: string
          pasuk_id?: string
          start_index?: number
          user_id?: string
        }
        Relationships: []
      }
      user_notes: {
        Row: {
          created_at: string
          id: string
          is_shared: boolean | null
          note_text: string
          pasuk_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_shared?: boolean | null
          note_text: string
          pasuk_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_shared?: boolean | null
          note_text?: string
          pasuk_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_personal_questions: {
        Row: {
          answer_text: string | null
          created_at: string
          id: string
          pasuk_id: string
          question_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_text?: string | null
          created_at?: string
          id?: string
          pasuk_id: string
          question_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_text?: string | null
          created_at?: string
          id?: string
          pasuk_id?: string
          question_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_questions: {
        Row: {
          created_at: string
          id: number
          is_shared: boolean | null
          text: string
          title_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_shared?: boolean | null
          text: string
          title_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          is_shared?: boolean | null
          text?: string
          title_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_questions_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "user_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reading_position: {
        Row: {
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          api_keys: Json | null
          created_at: string
          display_settings: Json | null
          display_settings_mobile: Json | null
          font_settings: Json | null
          font_settings_mobile: Json | null
          id: string
          quiz_attempts: Json
          quiz_plans: Json
          show_shared_content: boolean | null
          siddur_display_settings: Json | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_keys?: Json | null
          created_at?: string
          display_settings?: Json | null
          display_settings_mobile?: Json | null
          font_settings?: Json | null
          font_settings_mobile?: Json | null
          id?: string
          quiz_attempts?: Json
          quiz_plans?: Json
          show_shared_content?: boolean | null
          siddur_display_settings?: Json | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_keys?: Json | null
          created_at?: string
          display_settings?: Json | null
          display_settings_mobile?: Json | null
          font_settings?: Json | null
          font_settings_mobile?: Json | null
          id?: string
          quiz_attempts?: Json
          quiz_plans?: Json
          show_shared_content?: boolean | null
          siddur_display_settings?: Json | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_titles: {
        Row: {
          created_at: string
          id: number
          is_shared: boolean | null
          pasuk_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_shared?: boolean | null
          pasuk_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          is_shared?: boolean | null
          pasuk_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_user: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      exec_sql: { Args: { query: string }; Returns: Json }
      execute_safe_migration: {
        Args: { p_migration_name: string; p_migration_sql: string }
        Returns: Json
      }
      get_migration_history: {
        Args: never
        Returns: {
          error: string
          executed_at: string
          id: string
          name: string
          success: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          roles: Database["public"]["Enums"]["app_role"][]
          user_id: string
        }[]
      }
      reject_user: { Args: { _user_id: string }; Returns: undefined }
      set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer" | "user"
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
      app_role: ["admin", "editor", "viewer", "user"],
    },
  },
} as const
