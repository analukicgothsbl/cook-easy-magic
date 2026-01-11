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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      credit_bonus: {
        Row: {
          daily_bonus: number
          id: string
          updated_at: string
          usage: number
          user_id: string
        }
        Insert: {
          daily_bonus?: number
          id?: string
          updated_at?: string
          usage?: number
          user_id: string
        }
        Update: {
          daily_bonus?: number
          id?: string
          updated_at?: string
          usage?: number
          user_id?: string
        }
        Relationships: []
      }
      credit_usage: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: Database["public"]["Enums"]["credit_reason"]
          recipe_id: string | null
          type: Database["public"]["Enums"]["credit_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: Database["public"]["Enums"]["credit_reason"]
          recipe_id?: string | null
          type: Database["public"]["Enums"]["credit_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: Database["public"]["Enums"]["credit_reason"]
          recipe_id?: string | null
          type?: Database["public"]["Enums"]["credit_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_usage_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_wallet: {
        Row: {
          balance: number
          daily_remaining: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          daily_remaining?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          daily_remaining?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      guest_recipe_allowance: {
        Row: {
          first_used_at: string | null
          guest_id: string
          last_payload: Json | null
          used: boolean
        }
        Insert: {
          first_used_at?: string | null
          guest_id: string
          last_payload?: Json | null
          used?: boolean
        }
        Update: {
          first_used_at?: string | null
          guest_id?: string
          last_payload?: Json | null
          used?: boolean
        }
        Relationships: []
      }
      recipe: {
        Row: {
          budget_level: Database["public"]["Enums"]["budget_level"] | null
          cost_usd: number | null
          created_at: string
          cuisine: Database["public"]["Enums"]["cuisine_type"] | null
          description_long: string | null
          description_short: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          id: string
          ingredients: Json[] | null
          input_ingredients: string[] | null
          input_tokens: number | null
          instructions: string | null
          kids_friendly: boolean | null
          meal_category: Database["public"]["Enums"]["meal_category"] | null
          nutrition_estimate: Json | null
          output_tokens: number | null
          servings: number | null
          time_minutes: number | null
          tips: string | null
          title: string
          total_tokens: number | null
        }
        Insert: {
          budget_level?: Database["public"]["Enums"]["budget_level"] | null
          cost_usd?: number | null
          created_at?: string
          cuisine?: Database["public"]["Enums"]["cuisine_type"] | null
          description_long?: string | null
          description_short?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          id?: string
          ingredients?: Json[] | null
          input_ingredients?: string[] | null
          input_tokens?: number | null
          instructions?: string | null
          kids_friendly?: boolean | null
          meal_category?: Database["public"]["Enums"]["meal_category"] | null
          nutrition_estimate?: Json | null
          output_tokens?: number | null
          servings?: number | null
          time_minutes?: number | null
          tips?: string | null
          title: string
          total_tokens?: number | null
        }
        Update: {
          budget_level?: Database["public"]["Enums"]["budget_level"] | null
          cost_usd?: number | null
          created_at?: string
          cuisine?: Database["public"]["Enums"]["cuisine_type"] | null
          description_long?: string | null
          description_short?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          id?: string
          ingredients?: Json[] | null
          input_ingredients?: string[] | null
          input_tokens?: number | null
          instructions?: string | null
          kids_friendly?: boolean | null
          meal_category?: Database["public"]["Enums"]["meal_category"] | null
          nutrition_estimate?: Json | null
          output_tokens?: number | null
          servings?: number | null
          time_minutes?: number | null
          tips?: string | null
          title?: string
          total_tokens?: number | null
        }
        Relationships: []
      }
      recipe_favorites: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_image: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          recipe_id: string
          usd_costs: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          recipe_id: string
          usd_costs?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          recipe_id?: string
          usd_costs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_image_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_review: {
        Row: {
          created_at: string
          id: string
          rating: number | null
          recipe_id: string
          review: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating?: number | null
          recipe_id: string
          review?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number | null
          recipe_id?: string
          review?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_review_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_user: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_user_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_extended: {
        Row: {
          created_at: string
          id: string
          name: string | null
          profile_picture: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          profile_picture?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          profile_picture?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_options: {
        Row: {
          budget_level: Database["public"]["Enums"]["budget_level"] | null
          created_at: string
          cuisine: Database["public"]["Enums"]["cuisine_type"] | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          id: string
          kids_friendly: boolean | null
          meal_category: Database["public"]["Enums"]["meal_category"] | null
          servings: number | null
          time_available: Database["public"]["Enums"]["time_available"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_level?: Database["public"]["Enums"]["budget_level"] | null
          created_at?: string
          cuisine?: Database["public"]["Enums"]["cuisine_type"] | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          id?: string
          kids_friendly?: boolean | null
          meal_category?: Database["public"]["Enums"]["meal_category"] | null
          servings?: number | null
          time_available?: Database["public"]["Enums"]["time_available"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_level?: Database["public"]["Enums"]["budget_level"] | null
          created_at?: string
          cuisine?: Database["public"]["Enums"]["cuisine_type"] | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          id?: string
          kids_friendly?: boolean | null
          meal_category?: Database["public"]["Enums"]["meal_category"] | null
          servings?: number | null
          time_available?: Database["public"]["Enums"]["time_available"] | null
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
      [_ in never]: never
    }
    Enums: {
      app_role: "cook_master" | "admin"
      budget_level: "cheap" | "normal" | "doesnt_matter"
      credit_reason:
        | "signup_bonus"
        | "friend_bonus"
        | "generate_recipe"
        | "generate_recipe_image"
        | "bonus_credit"
        | "donate_bonus"
        | "purchased_credit"
        | "admin_bonus"
      credit_type: "income" | "cost"
      cuisine_type:
        | "any_surprise_me"
        | "home_style_traditional"
        | "italian"
        | "mediterranean"
        | "mexican"
        | "asian"
        | "balkan"
        | "healthy_light"
        | "comfort_food"
      difficulty_level: "easy" | "medium" | "hard"
      meal_category: "breakfast" | "lunch" | "dinner" | "dessert" | "snack"
      time_available: "minimum" | "enough"
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
      app_role: ["cook_master", "admin"],
      budget_level: ["cheap", "normal", "doesnt_matter"],
      credit_reason: [
        "signup_bonus",
        "friend_bonus",
        "generate_recipe",
        "generate_recipe_image",
        "bonus_credit",
        "donate_bonus",
        "purchased_credit",
        "admin_bonus",
      ],
      credit_type: ["income", "cost"],
      cuisine_type: [
        "any_surprise_me",
        "home_style_traditional",
        "italian",
        "mediterranean",
        "mexican",
        "asian",
        "balkan",
        "healthy_light",
        "comfort_food",
      ],
      difficulty_level: ["easy", "medium", "hard"],
      meal_category: ["breakfast", "lunch", "dinner", "dessert", "snack"],
      time_available: ["minimum", "enough"],
    },
  },
} as const
