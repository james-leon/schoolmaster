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
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          school_id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          school_id: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          author_id: string | null
          content: string
          created_at: string
          id: string
          pinned: boolean
          school_id: string
          target_class_id: string | null
          title: string
        }
        Insert: {
          audience?: string
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          pinned?: boolean
          school_id: string
          target_class_id?: string | null
          title: string
        }
        Update: {
          audience?: string
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean
          school_id?: string
          target_class_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_target_class_id_fkey"
            columns: ["target_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
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
      class_teachers: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_principal: boolean
          school_id: string
          subject_id: string | null
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_principal?: boolean
          school_id: string
          subject_id?: string | null
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_principal?: boolean
          school_id?: string
          subject_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_teacher_id_fkey"
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
      discipline_records: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          recorded_by: string | null
          school_id: string
          severity: string | null
          student_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          recorded_by?: string | null
          school_id: string
          severity?: string | null
          student_id: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          recorded_by?: string | null
          school_id?: string
          severity?: string | null
          student_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          assigned_vehicle_id: string | null
          created_at: string
          id: string
          license_expiry: string | null
          license_number: string | null
          name: string
          notes: string | null
          phone: string | null
          school_id: string
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_vehicle_id?: string | null
          created_at?: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          school_id: string
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_vehicle_id?: string | null
          created_at?: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          school_id?: string
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          id: string
          location: string | null
          school_id: string
          start_date: string
          start_time: string | null
          target: string
          target_class_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          school_id: string
          start_date: string
          start_time?: string | null
          target?: string
          target_class_id?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          school_id?: string
          start_date?: string
          start_time?: string | null
          target?: string
          target_class_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_target_class_id_fkey"
            columns: ["target_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
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
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          recipient_id: string
          school_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          recipient_id: string
          school_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          recipient_id?: string
          school_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_profile_id: string
          relationship: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_profile_id: string
          relationship?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_profile_id?: string
          relationship?: string | null
          school_id?: string
          student_id?: string
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
      payment_subscriptions: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_date: string
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          plan: string
          recorded_by: string | null
          reference: string | null
          school_id: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          payment_date?: string
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan: string
          recorded_by?: string | null
          reference?: string | null
          school_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_date?: string
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string
          recorded_by?: string | null
          reference?: string | null
          school_id?: string
          status?: string
        }
        Relationships: []
      }
      payroll: {
        Row: {
          base_salary: number
          bonuses: number
          created_at: string
          deductions: number
          id: string
          month: number
          net_salary: number
          payment_date: string | null
          payment_method: string | null
          school_id: string
          staff_id: string
          status: string
          transaction_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          base_salary?: number
          bonuses?: number
          created_at?: string
          deductions?: number
          id?: string
          month: number
          net_salary?: number
          payment_date?: string | null
          payment_method?: string | null
          school_id: string
          staff_id: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          base_salary?: number
          bonuses?: number
          created_at?: string
          deductions?: number
          id?: string
          month?: number
          net_salary?: number
          payment_date?: string | null
          payment_method?: string | null
          school_id?: string
          staff_id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_status: string | null
          old_status: string | null
          payroll_id: string
          reason: string | null
          school_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          payroll_id: string
          reason?: string | null
          school_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          payroll_id?: string
          reason?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_history_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
          is_active: boolean
          last_sign_in_at: string | null
          must_change_password: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          school_id: string | null
          student_id: string | null
          student_ids: string[]
        }
        Insert: {
          assigned_classes?: string[] | null
          assigned_subjects?: string[] | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_sign_in_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          school_id?: string | null
          student_id?: string | null
          student_ids?: string[]
        }
        Update: {
          assigned_classes?: string[] | null
          assigned_subjects?: string[] | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_sign_in_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          school_id?: string | null
          student_id?: string | null
          student_ids?: string[]
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
      route_stops: {
        Row: {
          created_at: string
          id: string
          order_index: number
          pickup_time: string | null
          route_id: string
          school_id: string
          stop_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          pickup_time?: string | null
          route_id: string
          school_id: string
          stop_name: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          pickup_time?: string | null
          route_id?: string
          school_id?: string
          stop_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_school_id_fkey"
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
          internal_notes: string | null
          last_activity_at: string | null
          logo_url: string | null
          name: string
          phone: string | null
          privacy_accepted_at: string | null
          privacy_accepted_by: string | null
          show_enrollment_targets: boolean
          status: string
          subscription_end: string | null
          subscription_plan: string | null
          subscription_start: string | null
          trial_ends_at: string | null
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
          internal_notes?: string | null
          last_activity_at?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          privacy_accepted_at?: string | null
          privacy_accepted_by?: string | null
          show_enrollment_targets?: boolean
          status?: string
          subscription_end?: string | null
          subscription_plan?: string | null
          subscription_start?: string | null
          trial_ends_at?: string | null
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
          internal_notes?: string | null
          last_activity_at?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          privacy_accepted_at?: string | null
          privacy_accepted_by?: string | null
          show_enrollment_targets?: boolean
          status?: string
          subscription_end?: string | null
          subscription_plan?: string | null
          subscription_start?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          address: string | null
          base_salary: number
          contract_end: string | null
          contract_start: string | null
          contract_type: string | null
          created_at: string
          date_of_birth: string | null
          diplomas: string | null
          email: string | null
          first_name: string
          gender: string | null
          hire_date: string | null
          id: string
          last_name: string
          linked_teacher_id: string | null
          notes: string | null
          phone: string | null
          role_title: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          base_salary?: number
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          diplomas?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          last_name: string
          linked_teacher_id?: string | null
          notes?: string | null
          phone?: string | null
          role_title: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          base_salary?: number
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          diplomas?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          last_name?: string
          linked_teacher_id?: string | null
          notes?: string | null
          phone?: string | null
          role_title?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_linked_teacher_id_fkey"
            columns: ["linked_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_leave: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          school_id: string
          staff_id: string
          start_date: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          school_id: string
          staff_id: string
          start_date: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          school_id?: string
          staff_id?: string
          start_date?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_leave_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leave_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      student_transport: {
        Row: {
          active: boolean
          created_at: string
          direction: string
          fee_amount: number
          id: string
          route_id: string
          school_id: string
          stop_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          direction?: string
          fee_amount?: number
          id?: string
          route_id: string
          school_id: string
          stop_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          direction?: string
          fee_amount?: number
          id?: string
          route_id?: string
          school_id?: string
          stop_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_transport_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "route_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          allergies: string | null
          birth_date: string | null
          birth_place: string | null
          blood_group: string | null
          chronic_conditions: string | null
          class_id: string | null
          consent_date: string | null
          consent_given: boolean
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          enrollment_date: string | null
          enrollment_status: string
          first_name: string
          gender: string | null
          id: string
          last_name: string
          medical_notes: string | null
          medications: string | null
          photo_url: string | null
          school_id: string
          status: string | null
          student_code: string | null
          vaccinations: string | null
        }
        Insert: {
          allergies?: string | null
          birth_date?: string | null
          birth_place?: string | null
          blood_group?: string | null
          chronic_conditions?: string | null
          class_id?: string | null
          consent_date?: string | null
          consent_given?: boolean
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          enrollment_date?: string | null
          enrollment_status?: string
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          medical_notes?: string | null
          medications?: string | null
          photo_url?: string | null
          school_id: string
          status?: string | null
          student_code?: string | null
          vaccinations?: string | null
        }
        Update: {
          allergies?: string | null
          birth_date?: string | null
          birth_place?: string | null
          blood_group?: string | null
          chronic_conditions?: string | null
          class_id?: string | null
          consent_date?: string | null
          consent_given?: boolean
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          enrollment_date?: string | null
          enrollment_status?: string
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          medical_notes?: string | null
          medications?: string | null
          photo_url?: string | null
          school_id?: string
          status?: string | null
          student_code?: string | null
          vaccinations?: string | null
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
      suppliers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          school_id: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          school_id: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          school_id?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_school_id_fkey"
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
      timetable: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: string
          end_time: string
          id: string
          room: string | null
          school_id: string
          start_time: string
          subject_id: string | null
          subject_name: string
          teacher_id: string | null
          teacher_name: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: string
          end_time: string
          id?: string
          room?: string | null
          school_id: string
          start_time: string
          subject_id?: string | null
          subject_name: string
          teacher_id?: string | null
          teacher_name?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: string
          end_time?: string
          id?: string
          room?: string | null
          school_id?: string
          start_time?: string
          subject_id?: string | null
          subject_name?: string
          teacher_id?: string | null
          teacher_name?: string | null
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          type: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          type: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          payment_method: string | null
          recorded_by: string | null
          reference: string | null
          school_id: string
          supplier_id: string | null
          type: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          school_id: string
          supplier_id?: string | null
          type: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          school_id?: string
          supplier_id?: string | null
          type?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          created_at: string
          description: string | null
          fee_amount: number
          id: string
          name: string
          notes: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          created_at?: string
          description?: string | null
          fee_amount?: number
          id?: string
          name: string
          notes?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          created_at?: string
          description?: string | null
          fee_amount?: number
          id?: string
          name?: string
          notes?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_routes_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_routes_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_routes_school_id_fkey"
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
      vehicle_documents: {
        Row: {
          amount: number | null
          created_at: string
          doc_type: string
          expiry_date: string | null
          id: string
          notes: string | null
          provider: string | null
          school_id: string
          start_date: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          doc_type: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          provider?: string | null
          school_id: string
          start_date?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          doc_type?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          provider?: string | null
          school_id?: string
          start_date?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          bus_number: string | null
          capacity: number | null
          created_at: string
          id: string
          model: string | null
          notes: string | null
          photo_url: string | null
          registration_number: string
          school_id: string
          status: string
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          bus_number?: string | null
          capacity?: number | null
          created_at?: string
          id?: string
          model?: string | null
          notes?: string | null
          photo_url?: string | null
          registration_number: string
          school_id: string
          status?: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          bus_number?: string | null
          capacity?: number | null
          created_at?: string
          id?: string
          model?: string | null
          notes?: string | null
          photo_url?: string | null
          registration_number?: string
          school_id?: string
          status?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
      is_parent_of_student: { Args: { _student_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      teacher_handles_class: { Args: { _class_id: string }; Returns: boolean }
      teacher_handles_student: {
        Args: { _student_id: string }
        Returns: boolean
      }
      touch_school_activity: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "school_admin" | "teacher" | "parent" | "super_admin"
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
      app_role: ["school_admin", "teacher", "parent", "super_admin"],
    },
  },
} as const
