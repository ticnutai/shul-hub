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
      admin_messages: {
        Row: {
          body: string
          community_id: string
          created_at: string
          id: string
          is_read: boolean
          phone: string
          sender_id: string | null
          sender_name: string
          subject: string
        }
        Insert: {
          body: string
          community_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          phone?: string
          sender_id?: string | null
          sender_name?: string
          subject?: string
        }
        Update: {
          body?: string
          community_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          phone?: string
          sender_id?: string | null
          sender_name?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          community_id: string
          created_at: string
          expires_at: string | null
          home_width: string
          id: string
          image_path: string | null
          image_url: string | null
          kind: string
          notification_enabled: boolean
          pinned: boolean
          show_on_home: boolean
          sort_order: number
          style: Json
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          community_id?: string
          created_at?: string
          expires_at?: string | null
          home_width?: string
          id?: string
          image_path?: string | null
          image_url?: string | null
          kind?: string
          notification_enabled?: boolean
          pinned?: boolean
          show_on_home?: boolean
          sort_order?: number
          style?: Json
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          community_id?: string
          created_at?: string
          expires_at?: string | null
          home_width?: string
          id?: string
          image_path?: string | null
          image_url?: string | null
          kind?: string
          notification_enabled?: boolean
          pinned?: boolean
          show_on_home?: boolean
          sort_order?: number
          style?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      app_themes: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          id: string
          name: string
          theme: Json
          updated_at: string
        }
        Insert: {
          community_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name: string
          theme: Json
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          theme?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_themes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      chavruta_requests: {
        Row: {
          availability: string
          community_id: string
          created_at: string
          email: string
          id: string
          intent: string
          level: string
          name: string
          notes: string
          phone: string
          sender_id: string | null
          share_contact: boolean
          status: string
          study_format: string
          topic: string
          updated_at: string
        }
        Insert: {
          availability?: string
          community_id?: string
          created_at?: string
          email?: string
          id?: string
          intent?: string
          level?: string
          name: string
          notes?: string
          phone?: string
          sender_id?: string | null
          share_contact?: boolean
          status?: string
          study_format?: string
          topic: string
          updated_at?: string
        }
        Update: {
          availability?: string
          community_id?: string
          created_at?: string
          email?: string
          id?: string
          intent?: string
          level?: string
          name?: string
          notes?: string
          phone?: string
          sender_id?: string | null
          share_contact?: boolean
          status?: string
          study_format?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chavruta_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      chavrutot: {
        Row: {
          active: boolean
          community_id: string
          contact: string
          created_at: string
          id: string
          looking_for_partner: boolean
          notification_enabled: boolean
          partners: string
          sort_order: number
          time_text: string
          topic: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          community_id?: string
          contact?: string
          created_at?: string
          id?: string
          looking_for_partner?: boolean
          notification_enabled?: boolean
          partners?: string
          sort_order?: number
          time_text?: string
          topic: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          community_id?: string
          contact?: string
          created_at?: string
          id?: string
          looking_for_partner?: boolean
          notification_enabled?: boolean
          partners?: string
          sort_order?: number
          time_text?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chavrutot_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      commentaries: {
        Row: {
          commentator: string
          created_at: string
          id: string
          pasuk: number
          perek: number
          sefer_id: number
          text: string
        }
        Insert: {
          commentator: string
          created_at?: string
          id?: string
          pasuk: number
          perek: number
          sefer_id: number
          text: string
        }
        Update: {
          commentator?: string
          created_at?: string
          id?: string
          pasuk?: number
          perek?: number
          sefer_id?: number
          text?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      home_widgets: {
        Row: {
          community_id: string
          created_at: string
          id: string
          key: string
          kind: string
          label: string
          layout_width: string
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          community_id?: string
          created_at?: string
          id?: string
          key: string
          kind?: string
          label: string
          layout_width?: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          key?: string
          kind?: string
          label?: string
          layout_width?: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "home_widgets_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
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
      logo_library: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          path: string | null
          path_dark: string | null
          url: string
          url_dark: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          path?: string | null
          path_dark?: string | null
          url: string
          url_dark?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          path?: string | null
          path_dark?: string | null
          url?: string
          url_dark?: string | null
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
          statements_count: number
          success: boolean
        }
        Insert: {
          error?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          name: string
          statements_count?: number
          success?: boolean
        }
        Update: {
          error?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          name?: string
          statements_count?: number
          success?: boolean
        }
        Relationships: []
      }
      minyan_categories: {
        Row: {
          active: boolean
          community_id: string
          created_at: string
          display_mode: string
          id: string
          name: string
          sort_order: number
          subcategories: Json
          system_key: string | null
          updated_at: string
          visible_from: string | null
          visible_until: string | null
        }
        Insert: {
          active?: boolean
          community_id?: string
          created_at?: string
          display_mode?: string
          id?: string
          name: string
          sort_order?: number
          subcategories?: Json
          system_key?: string | null
          updated_at?: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Update: {
          active?: boolean
          community_id?: string
          created_at?: string
          display_mode?: string
          id?: string
          name?: string
          sort_order?: number
          subcategories?: Json
          system_key?: string | null
          updated_at?: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "minyan_categories_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      minyan_overrides: {
        Row: {
          at_time: string | null
          cancelled: boolean
          community_id: string
          created_at: string
          id: string
          minyan_id: string
          note: string
          on_date: string
          updated_at: string
        }
        Insert: {
          at_time?: string | null
          cancelled?: boolean
          community_id: string
          created_at?: string
          id?: string
          minyan_id: string
          note?: string
          on_date: string
          updated_at?: string
        }
        Update: {
          at_time?: string | null
          cancelled?: boolean
          community_id?: string
          created_at?: string
          id?: string
          minyan_id?: string
          note?: string
          on_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "minyan_overrides_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minyan_overrides_minyan_id_same_community_fkey"
            columns: ["minyan_id", "community_id"]
            isOneToOne: false
            referencedRelation: "minyanim"
            referencedColumns: ["id", "community_id"]
          },
        ]
      }
      minyanim: {
        Row: {
          active: boolean
          active_from: string | null
          active_until: string | null
          category_id: string | null
          community_id: string
          created_at: string
          day_type: string
          fixed_time: string | null
          id: string
          label: string
          note: string
          notification_enabled: boolean
          offset_minutes: number
          prayer: string
          relative_to: string | null
          reminder_minutes: number
          room: string
          sort_order: number
          time_mode: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          active_from?: string | null
          active_until?: string | null
          category_id?: string | null
          community_id?: string
          created_at?: string
          day_type?: string
          fixed_time?: string | null
          id?: string
          label?: string
          note?: string
          notification_enabled?: boolean
          offset_minutes?: number
          prayer?: string
          relative_to?: string | null
          reminder_minutes?: number
          room?: string
          sort_order?: number
          time_mode?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          active_from?: string | null
          active_until?: string | null
          category_id?: string | null
          community_id?: string
          created_at?: string
          day_type?: string
          fixed_time?: string | null
          id?: string
          label?: string
          note?: string
          notification_enabled?: boolean
          offset_minutes?: number
          prayer?: string
          relative_to?: string | null
          reminder_minutes?: number
          room?: string
          sort_order?: number
          time_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "minyanim_category_id_same_community_fkey"
            columns: ["category_id", "community_id"]
            isOneToOne: false
            referencedRelation: "minyan_categories"
            referencedColumns: ["id", "community_id"]
          },
          {
            foreignKeyName: "minyanim_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          announcements_enabled: boolean
          browser_enabled: boolean
          chavrutot_enabled: boolean
          enabled: boolean
          minyanim_enabled: boolean
          selected_minyan_ids: string[]
          selected_shiur_ids: string[]
          shiurim_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          announcements_enabled?: boolean
          browser_enabled?: boolean
          chavrutot_enabled?: boolean
          enabled?: boolean
          minyanim_enabled?: boolean
          selected_minyan_ids?: string[]
          selected_shiur_ids?: string[]
          shiurim_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          announcements_enabled?: boolean
          browser_enabled?: boolean
          chavrutot_enabled?: boolean
          enabled?: boolean
          minyanim_enabled?: boolean
          selected_minyan_ids?: string[]
          selected_shiur_ids?: string[]
          shiurim_enabled?: boolean
          updated_at?: string
          user_id?: string
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
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
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
      rashi_commentary: {
        Row: {
          created_at: string
          id: string
          pasuk: number
          perek: number
          sefer_id: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          pasuk: number
          perek: number
          sefer_id: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          pasuk?: number
          perek?: number
          sefer_id?: number
          text?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          address: string
          candle_offset_minutes: number
          city: string
          community_id: string
          created_at: string
          elevation: number
          header_logo: string | null
          home_header_variant: string
          home_hero: Json
          id: string
          karovim_logo_desktop_height: number
          karovim_logo_desktop_offset_x: number
          karovim_logo_desktop_offset_y: number
          karovim_logo_desktop_width: number
          karovim_logo_mobile_height: number
          karovim_logo_mobile_offset_x: number
          karovim_logo_mobile_offset_y: number
          karovim_logo_mobile_width: number
          latitude: number
          logos: Json
          longitude: number
          minyan_days: string
          minyan_layout: string | null
          name: string
          phone: string
          shabbat_end_minutes: number
          subtitle: string
          theme: string
          tzeit_offset_minutes: number
          updated_at: string
        }
        Insert: {
          address?: string
          candle_offset_minutes?: number
          city?: string
          community_id?: string
          created_at?: string
          elevation?: number
          header_logo?: string | null
          home_header_variant?: string
          home_hero?: Json
          id?: string
          karovim_logo_desktop_height?: number
          karovim_logo_desktop_offset_x?: number
          karovim_logo_desktop_offset_y?: number
          karovim_logo_desktop_width?: number
          karovim_logo_mobile_height?: number
          karovim_logo_mobile_offset_x?: number
          karovim_logo_mobile_offset_y?: number
          karovim_logo_mobile_width?: number
          latitude?: number
          logos?: Json
          longitude?: number
          minyan_days?: string
          minyan_layout?: string | null
          name?: string
          phone?: string
          shabbat_end_minutes?: number
          subtitle?: string
          theme?: string
          tzeit_offset_minutes?: number
          updated_at?: string
        }
        Update: {
          address?: string
          candle_offset_minutes?: number
          city?: string
          community_id?: string
          created_at?: string
          elevation?: number
          header_logo?: string | null
          home_header_variant?: string
          home_hero?: Json
          id?: string
          karovim_logo_desktop_height?: number
          karovim_logo_desktop_offset_x?: number
          karovim_logo_desktop_offset_y?: number
          karovim_logo_desktop_width?: number
          karovim_logo_mobile_height?: number
          karovim_logo_mobile_offset_x?: number
          karovim_logo_mobile_offset_y?: number
          karovim_logo_mobile_width?: number
          latitude?: number
          logos?: Json
          longitude?: number
          minyan_days?: string
          minyan_layout?: string | null
          name?: string
          phone?: string
          shabbat_end_minutes?: number
          subtitle?: string
          theme?: string
          tzeit_offset_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      shiur_categories: {
        Row: {
          active: boolean
          community_id: string
          created_at: string
          description: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          community_id?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          community_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shiur_categories_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      shiurim: {
        Row: {
          active: boolean
          category_id: string | null
          community_id: string
          created_at: string
          day_of_week: number
          description: string
          id: string
          location: string
          notification_enabled: boolean
          reminder_minutes: number
          schedule_type: string
          sort_order: number
          teacher: string
          time_text: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          community_id?: string
          created_at?: string
          day_of_week?: number
          description?: string
          id?: string
          location?: string
          notification_enabled?: boolean
          reminder_minutes?: number
          schedule_type?: string
          sort_order?: number
          teacher?: string
          time_text?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          community_id?: string
          created_at?: string
          day_of_week?: number
          description?: string
          id?: string
          location?: string
          notification_enabled?: boolean
          reminder_minutes?: number
          schedule_type?: string
          sort_order?: number
          teacher?: string
          time_text?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shiurim_category_id_same_community_fkey"
            columns: ["category_id", "community_id"]
            isOneToOne: false
            referencedRelation: "shiur_categories"
            referencedColumns: ["id", "community_id"]
          },
          {
            foreignKeyName: "shiurim_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
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
      tv_commands: {
        Row: {
          command: string
          created_at: string
          created_by: string | null
          device_id: string | null
          id: number
          payload: Json
        }
        Insert: {
          command: string
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: never
          payload?: Json
        }
        Update: {
          command?: string
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: never
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tv_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "tv_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_config: {
        Row: {
          community_id: string
          config: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          community_id?: string
          config?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          community_id?: string
          config?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_config_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_devices: {
        Row: {
          app_version: string | null
          approved: boolean
          approved_at: string | null
          community_id: string | null
          created_at: string
          id: string
          info: Json
          last_boot_at: string | null
          last_seen_at: string | null
          name: string
          pairing_code: string | null
          pairing_expires_at: string | null
          secret_hash: string
          state: Json
        }
        Insert: {
          app_version?: string | null
          approved?: boolean
          approved_at?: string | null
          community_id?: string | null
          created_at?: string
          id: string
          info?: Json
          last_boot_at?: string | null
          last_seen_at?: string | null
          name?: string
          pairing_code?: string | null
          pairing_expires_at?: string | null
          secret_hash: string
          state?: Json
        }
        Update: {
          app_version?: string | null
          approved?: boolean
          approved_at?: string | null
          community_id?: string | null
          created_at?: string
          id?: string
          info?: Json
          last_boot_at?: string | null
          last_seen_at?: string | null
          name?: string
          pairing_code?: string | null
          pairing_expires_at?: string | null
          secret_hash?: string
          state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tv_devices_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_events: {
        Row: {
          details: Json
          device_id: string
          id: number
          kind: string
          level: string
          message: string
          occurred_at: string
          received_at: string
        }
        Insert: {
          details?: Json
          device_id: string
          id?: never
          kind: string
          level?: string
          message?: string
          occurred_at: string
          received_at?: string
        }
        Update: {
          details?: Json
          device_id?: string
          id?: never
          kind?: string
          level?: string
          message?: string
          occurred_at?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "tv_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_snapshots: {
        Row: {
          captured_at: string
          device_id: string
          image: string
        }
        Insert: {
          captured_at?: string
          device_id: string
          image: string
        }
        Update: {
          captured_at?: string
          device_id?: string
          image?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_snapshots_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "tv_devices"
            referencedColumns: ["id"]
          },
        ]
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
          community_id: string | null
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
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
      user_ui_preferences: {
        Row: {
          created_at: string
          preferences: Json
          preferences_updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          preferences?: Json
          preferences_updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          preferences?: Json
          preferences_updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_user: {
        Args: {
          p_email: string
          p_name?: string
          p_password: string
          p_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: boolean }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          name: string
          role: string
        }[]
      }
      admin_update_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      claim_admin: { Args: never; Returns: boolean }
      communities_overview: {
        Args: never
        Returns: {
          active: boolean
          announcements: number
          created_at: string
          id: string
          minyanim: number
          name: string
          screens: number
          slug: string
        }[]
      }
      create_community: {
        Args: { p_name: string; p_slug?: string }
        Returns: string
      }
      execute_admin_migration: {
        Args: { p_name: string; p_statements: string[] }
        Returns: Json
      }
      get_migration_history: {
        Args: never
        Returns: {
          error: string
          executed_at: string
          id: string
          name: string
          statements_count: number
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
      is_admin: { Args: never; Returns: boolean }
      is_admin_of: { Args: { _community: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      list_approved_chavruta_requests: {
        Args: { p_community?: string }
        Returns: {
          availability: string
          created_at: string
          email: string
          id: string
          intent: string
          level: string
          name: string
          notes: string
          phone: string
          study_format: string
          topic: string
        }[]
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
      my_communities: {
        Args: never
        Returns: {
          active: boolean
          id: string
          name: string
          slug: string
        }[]
      }
      prune_minyan_overrides: { Args: never; Returns: number }
      set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: Json
      }
      sole_community: { Args: never; Returns: string }
      tv_authenticate: {
        Args: { p_device_id: string; p_secret: string }
        Returns: {
          app_version: string | null
          approved: boolean
          approved_at: string | null
          community_id: string | null
          created_at: string
          id: string
          info: Json
          last_boot_at: string | null
          last_seen_at: string | null
          name: string
          pairing_code: string | null
          pairing_expires_at: string | null
          secret_hash: string
          state: Json
        }
        SetofOptions: {
          from: "*"
          to: "tv_devices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tv_claim: {
        Args: { p_code: string; p_community?: string; p_name: string }
        Returns: Json
      }
      tv_community: {
        Args: { p_device_id: string; p_secret: string }
        Returns: string
      }
      tv_heartbeat: {
        Args: { p_device_id: string; p_secret: string; p_state?: Json }
        Returns: Json
      }
      tv_log: {
        Args: { p_device_id: string; p_events: Json; p_secret: string }
        Returns: number
      }
      tv_new_pairing_code: { Args: never; Returns: string }
      tv_put_snapshot: {
        Args: { p_device_id: string; p_image: string; p_secret: string }
        Returns: undefined
      }
      tv_register: {
        Args: { p_device_id: string; p_info?: Json; p_secret: string }
        Returns: Json
      }
      tv_set_community: {
        Args: { p_community_id: string; p_device_id: string; p_secret: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "gabbai" | "user" | "editor" | "viewer"
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
    Enums: {
      app_role: ["admin", "gabbai", "user", "editor", "viewer"],
    },
  },
} as const
