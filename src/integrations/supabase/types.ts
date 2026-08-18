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
      minyanim: {
        Row: {
          active: boolean;
          created_at: string;
          day_type: string;
          fixed_time: string | null;
          id: string;
          label: string;
          note: string;
          notification_enabled: boolean;
          offset_minutes: number;
          prayer: string;
          reminder_minutes: number;
          schedule_type: string;
          relative_to: string | null;
          room: string;
          sort_order: number;
          time_mode: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          day_type?: string;
          fixed_time?: string | null;
          id?: string;
          label?: string;
          note?: string;
          notification_enabled?: boolean;
          offset_minutes?: number;
          prayer?: string;
          reminder_minutes?: number;
          schedule_type?: string;
          relative_to?: string | null;
          room?: string;
          sort_order?: number;
          time_mode?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          day_type?: string;
          fixed_time?: string | null;
          id?: string;
          label?: string;
          note?: string;
          notification_enabled?: boolean;
          offset_minutes?: number;
          prayer?: string;
          reminder_minutes?: number;
          schedule_type?: string;
          relative_to?: string | null;
          room?: string;
          sort_order?: number;
          time_mode?: string;
          updated_at?: string;
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
          sort_order?: number;
          teacher?: string;
          time_text?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shiur_categories: {
        Row: {
          id: string;
          name: string;
          description: string;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          enabled: boolean;
          browser_enabled: boolean;
          minyanim_enabled: boolean;
          shiurim_enabled: boolean;
          announcements_enabled: boolean;
          chavrutot_enabled: boolean;
          selected_minyan_ids: string[];
          selected_shiur_ids: string[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          browser_enabled?: boolean;
          minyanim_enabled?: boolean;
          shiurim_enabled?: boolean;
          announcements_enabled?: boolean;
          chavrutot_enabled?: boolean;
          selected_minyan_ids?: string[];
          selected_shiur_ids?: string[];
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          browser_enabled?: boolean;
          minyanim_enabled?: boolean;
          shiurim_enabled?: boolean;
          announcements_enabled?: boolean;
          chavrutot_enabled?: boolean;
          selected_minyan_ids?: string[];
          selected_shiur_ids?: string[];
          updated_at?: string;
        };
        Relationships: [];
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_admin: { Args: never; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
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
