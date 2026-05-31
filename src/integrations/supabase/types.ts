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
      academic_years: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_current: boolean
          name: string
          school_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          name: string
          school_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
          start_date?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          author_id: string | null
          content: string
          created_at: string
          id: string
          school_id: string
          title: string
        }
        Insert: {
          audience?: string
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          school_id: string
          title: string
        }
        Update: {
          audience?: string
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          school_id?: string
          title?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          school_id: string
          status: string
          student_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          school_id?: string
          status?: string
          student_id?: string
        }
        Relationships: []
      }
      class_subjects: {
        Row: {
          class_id: string
          coefficient: number
          created_at: string
          id: string
          name: string
          school_id: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          coefficient?: number
          created_at?: string
          id?: string
          name: string
          school_id: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          coefficient?: number
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          level: string | null
          name: string
          school_id: string
          teacher_id: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          level?: string | null
          name: string
          school_id: string
          teacher_id?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          school_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_fk"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_types: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          name: string
          school_id: string
          scope: string
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          name: string
          school_id: string
          scope?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          name?: string
          school_id?: string
          scope?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          class_id: string | null
          comment: string | null
          composition: number | null
          created_at: string
          devoir1: number | null
          devoir2: number | null
          evaluation_type: string | null
          grade: number | null
          id: string
          school_id: string
          student_id: string
          subject: string
          subject_id: string | null
          term: string
          value: number
        }
        Insert: {
          class_id?: string | null
          comment?: string | null
          composition?: number | null
          created_at?: string
          devoir1?: number | null
          devoir2?: number | null
          evaluation_type?: string | null
          grade?: number | null
          id?: string
          school_id: string
          student_id: string
          subject: string
          subject_id?: string | null
          term: string
          value?: number
        }
        Update: {
          class_id?: string | null
          comment?: string | null
          composition?: number | null
          created_at?: string
          devoir1?: number | null
          devoir2?: number | null
          evaluation_type?: string | null
          grade?: number | null
          id?: string
          school_id?: string
          student_id?: string
          subject?: string
          subject_id?: string | null
          term?: string
          value?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          date: string
          due_date: string | null
          fee_type_id: string | null
          id: string
          invoice_number: string | null
          mode: string | null
          notes: string | null
          reference: string | null
          school_id: string
          status: string
          student_id: string
          type: string | null
        }
        Insert: {
          amount?: number
          amount_paid?: number
          created_at?: string
          date?: string
          due_date?: string | null
          fee_type_id?: string | null
          id?: string
          invoice_number?: string | null
          mode?: string | null
          notes?: string | null
          reference?: string | null
          school_id: string
          status?: string
          student_id: string
          type?: string | null
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          date?: string
          due_date?: string | null
          fee_type_id?: string | null
          id?: string
          invoice_number?: string | null
          mode?: string | null
          notes?: string | null
          reference?: string | null
          school_id?: string
          status?: string
          student_id?: string
          type?: string | null
        }
        Relationships: []
      }
      parents: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_emergency_contact: boolean
          last_name: string
          phone: string | null
          profession: string | null
          relationship: string | null
          school_id: string
          student_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_emergency_contact?: boolean
          last_name: string
          phone?: string | null
          profession?: string | null
          relationship?: string | null
          school_id: string
          student_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_emergency_contact?: boolean
          last_name?: string
          phone?: string | null
          profession?: string | null
          relationship?: string | null
          school_id?: string
          student_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      payment_records: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          invoice_id: string
          mode: string
          notes: string | null
          receipt_number: string
          reference: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          invoice_id: string
          mode: string
          notes?: string | null
          receipt_number: string
          reference?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          invoice_id?: string
          mode?: string
          notes?: string | null
          receipt_number?: string
          reference?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_classes: string[] | null
          assigned_subjects: string[] | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          school_id: string | null
          student_id: string | null
        }
        Insert: {
          assigned_classes?: string[] | null
          assigned_subjects?: string[] | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          school_id?: string | null
          student_id?: string | null
        }
        Update: {
          assigned_classes?: string[] | null
          assigned_subjects?: string[] | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          school_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          director_name: string | null
          email: string | null
          enrollment_targets: Json
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          subscription_plan: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          director_name?: string | null
          email?: string | null
          enrollment_targets?: Json
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          subscription_plan?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          director_name?: string | null
          email?: string | null
          enrollment_targets?: Json
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          subscription_plan?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          birth_date: string | null
          birth_place: string | null
          class_id: string | null
          created_at: string
          enrollment_date: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          photo_url: string | null
          school_id: string
          status: string | null
          student_code: string | null
        }
        Insert: {
          birth_date?: string | null
          birth_place?: string | null
          class_id?: string | null
          created_at?: string
          enrollment_date?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          photo_url?: string | null
          school_id: string
          status?: string | null
          student_code?: string | null
        }
        Update: {
          birth_date?: string | null
          birth_place?: string | null
          class_id?: string | null
          created_at?: string
          enrollment_date?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          photo_url?: string | null
          school_id?: string
          status?: string | null
          student_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          school_id: string
          status: string | null
          subjects: string[] | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          school_id: string
          status?: string | null
          subjects?: string[] | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          school_id?: string
          status?: string | null
          subjects?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      get_user_student_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "school_admin" | "teacher" | "parent"
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
      app_role: ["school_admin", "teacher", "parent"],
    },
  },
} as const
