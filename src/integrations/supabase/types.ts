export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      admin_messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          is_read: boolean;
          phone: string;
          sender_name: string;
          subject: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          phone?: string;
          sender_name?: string;
          subject?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          phone?: string;
          sender_name?: string;
          subject?: string;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          body: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          kind: string;
          notification_enabled: boolean;
          pinned: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          kind?: string;
          notification_enabled?: boolean;
          pinned?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          kind?: string;
          notification_enabled?: boolean;
          pinned?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chavruta_requests: {
        Row: {
          availability: string;
          created_at: string;
          email: string;
          id: string;
          intent: string;
          level: string;
          name: string;
          notes: string;
          phone: string;
          share_contact: boolean;
          status: string;
          study_format: string;
          topic: string;
          updated_at: string;
        };
        Insert: {
          availability?: string;
          created_at?: string;
          email?: string;
          id?: string;
          intent?: string;
          level?: string;
          name: string;
          notes?: string;
          phone?: string;
          share_contact?: boolean;
          status?: string;
          study_format?: string;
          topic: string;
          updated_at?: string;
        };
        Update: {
          availability?: string;
          created_at?: string;
          email?: string;
          id?: string;
          intent?: string;
          level?: string;
          name?: string;
          notes?: string;
          phone?: string;
          share_contact?: boolean;
          status?: string;
          study_format?: string;
          topic?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chavrutot: {
        Row: {
          active: boolean;
          contact: string;
          created_at: string;
          id: string;
          looking_for_partner: boolean;
          notification_enabled: boolean;
          partners: string;
          sort_order: number;
          time_text: string;
          topic: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          contact?: string;
          created_at?: string;
          id?: string;
          looking_for_partner?: boolean;
          notification_enabled?: boolean;
          partners?: string;
          sort_order?: number;
          time_text?: string;
          topic: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          contact?: string;
          created_at?: string;
          id?: string;
          looking_for_partner?: boolean;
          notification_enabled?: boolean;
          partners?: string;
          sort_order?: number;
          time_text?: string;
          topic?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      home_widgets: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          kind: string;
          label: string;
          sort_order: number;
          updated_at: string;
          visible: boolean;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          kind?: string;
          label: string;
          sort_order?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          kind?: string;
          label?: string;
          sort_order?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Relationships: [];
      };
      migration_logs: {
        Row: {
          error: string | null;
          executed_at: string;
          executed_by: string | null;
          id: string;
          name: string;
          statements_count: number;
          success: boolean;
        };
        Insert: {
          error?: string | null;
          executed_at?: string;
          executed_by?: string | null;
          id?: string;
          name: string;
          statements_count?: number;
          success?: boolean;
        };
        Update: {
          error?: string | null;
          executed_at?: string;
          executed_by?: string | null;
          id?: string;
          name?: string;
          statements_count?: number;
          success?: boolean;
        };
        Relationships: [];
      };
      minyan_categories: {
        Row: {
          active: boolean;
          created_at: string;
          display_mode: string;
          id: string;
          name: string;
          sort_order: number;
          subcategories: Json;
          system_key: string | null;
          updated_at: string;
          visible_from: string | null;
          visible_until: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_mode?: string;
          id?: string;
          name: string;
          sort_order?: number;
          subcategories?: Json;
          system_key?: string | null;
          updated_at?: string;
          visible_from?: string | null;
          visible_until?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_mode?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          subcategories?: Json;
          system_key?: string | null;
          updated_at?: string;
          visible_from?: string | null;
          visible_until?: string | null;
        };
        Relationships: [];
      };
      minyanim: {
        Row: {
          active: boolean;
          category_id: string | null;
          created_at: string;
          day_type: string;
          fixed_time: string | null;
          id: string;
          label: string;
          note: string;
          notification_enabled: boolean;
          offset_minutes: number;
          prayer: string;
          relative_to: string | null;
          reminder_minutes: number;
          room: string;
          sort_order: number;
          time_mode: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category_id?: string | null;
          created_at?: string;
          day_type?: string;
          fixed_time?: string | null;
          id?: string;
          label?: string;
          note?: string;
          notification_enabled?: boolean;
          offset_minutes?: number;
          prayer?: string;
          relative_to?: string | null;
          reminder_minutes?: number;
          room?: string;
          sort_order?: number;
          time_mode?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category_id?: string | null;
          created_at?: string;
          day_type?: string;
          fixed_time?: string | null;
          id?: string;
          label?: string;
          note?: string;
          notification_enabled?: boolean;
          offset_minutes?: number;
          prayer?: string;
          relative_to?: string | null;
          reminder_minutes?: number;
          room?: string;
          sort_order?: number;
          time_mode?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "minyanim_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "minyan_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          announcements_enabled: boolean;
          browser_enabled: boolean;
          chavrutot_enabled: boolean;
          enabled: boolean;
          minyanim_enabled: boolean;
          selected_minyan_ids: string[];
          selected_shiur_ids: string[];
          shiurim_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          announcements_enabled?: boolean;
          browser_enabled?: boolean;
          chavrutot_enabled?: boolean;
          enabled?: boolean;
          minyanim_enabled?: boolean;
          selected_minyan_ids?: string[];
          selected_shiur_ids?: string[];
          shiurim_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          announcements_enabled?: boolean;
          browser_enabled?: boolean;
          chavrutot_enabled?: boolean;
          enabled?: boolean;
          minyanim_enabled?: boolean;
          selected_minyan_ids?: string[];
          selected_shiur_ids?: string[];
          shiurim_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          address: string;
          candle_offset_minutes: number;
          city: string;
          created_at: string;
          elevation: number;
          id: string;
          latitude: number;
          longitude: number;
          name: string;
          phone: string;
          subtitle: string;
          theme: string;
          tzeit_offset_minutes: number;
          updated_at: string;
        };
        Insert: {
          address?: string;
          candle_offset_minutes?: number;
          city?: string;
          created_at?: string;
          elevation?: number;
          id?: string;
          latitude?: number;
          longitude?: number;
          name?: string;
          phone?: string;
          subtitle?: string;
          theme?: string;
          tzeit_offset_minutes?: number;
          updated_at?: string;
        };
        Update: {
          address?: string;
          candle_offset_minutes?: number;
          city?: string;
          created_at?: string;
          elevation?: number;
          id?: string;
          latitude?: number;
          longitude?: number;
          name?: string;
          phone?: string;
          subtitle?: string;
          theme?: string;
          tzeit_offset_minutes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      shiur_categories: {
        Row: {
          active: boolean;
          created_at: string;
          description: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      shiurim: {
        Row: {
          active: boolean;
          category_id: string | null;
          created_at: string;
          day_of_week: number;
          description: string;
          id: string;
          location: string;
          notification_enabled: boolean;
          reminder_minutes: number;
          schedule_type: string;
          sort_order: number;
          teacher: string;
          time_text: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category_id?: string | null;
          created_at?: string;
          day_of_week?: number;
          description?: string;
          id?: string;
          location?: string;
          notification_enabled?: boolean;
          reminder_minutes?: number;
          schedule_type?: string;
          sort_order?: number;
          teacher?: string;
          time_text?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category_id?: string | null;
          created_at?: string;
          day_of_week?: number;
          description?: string;
          id?: string;
          location?: string;
          notification_enabled?: boolean;
          reminder_minutes?: number;
          schedule_type?: string;
          sort_order?: number;
          teacher?: string;
          time_text?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shiurim_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "shiur_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_ui_preferences: {
        Row: {
          created_at: string;
          preferences: Json;
          preferences_updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          preferences?: Json;
          preferences_updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          preferences?: Json;
          preferences_updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_create_user: {
        Args: {
          p_email: string;
          p_name?: string;
          p_password: string;
          p_role?: Database["public"]["Enums"]["app_role"];
        };
        Returns: string;
      };
      admin_delete_user: { Args: { p_user_id: string }; Returns: boolean };
      admin_list_users: {
        Args: never;
        Returns: {
          created_at: string;
          email: string;
          id: string;
          last_sign_in_at: string;
          name: string;
          role: string;
        }[];
      };
      admin_update_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"];
          p_user_id: string;
        };
        Returns: boolean;
      };
      claim_admin: { Args: never; Returns: boolean };
      execute_admin_migration: {
        Args: { p_name: string; p_statements: string[] };
        Returns: Json;
      };
      get_migration_history: {
        Args: never;
        Returns: {
          error: string;
          executed_at: string;
          id: string;
          name: string;
          statements_count: number;
          success: boolean;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      list_approved_chavruta_requests: {
        Args: never;
        Returns: {
          availability: string;
          created_at: string;
          email: string;
          id: string;
          intent: string;
          level: string;
          name: string;
          notes: string;
          phone: string;
          study_format: string;
          topic: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "gabbai" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gabbai", "user"],
    },
  },
} as const;
