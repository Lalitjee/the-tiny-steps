// Hand-written types for the rw_ tables (see supabase/migrations/001_rw_schema.sql).
// Cashbook's tables share the same project but are not used by this app, so they are not listed here.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Role = "parent" | "kid";
export type Frequency = "daily" | "weekly" | "monthly";

export type Database = {
  public: {
    Tables: {
      rw_families: {
        Row: { id: string; name: string; created_by: string; created_at: string };
        Insert: { id?: string; name: string; created_by: string; created_at?: string };
        Update: { id?: string; name?: string; created_by?: string; created_at?: string };
        Relationships: [];
      };
      rw_family_members: {
        Row: { family_id: string; user_id: string; role: Role; created_at: string };
        Insert: { family_id: string; user_id: string; role: Role; created_at?: string };
        Update: { family_id?: string; user_id?: string; role?: Role; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "rw_family_members_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "rw_families";
            referencedColumns: ["id"];
          },
        ];
      };
      rw_family_invites: {
        Row: { id: string; family_id: string; email: string; role: Role; invited_by: string; created_at: string };
        Insert: { id?: string; family_id: string; email: string; role: Role; invited_by: string; created_at?: string };
        Update: { id?: string; family_id?: string; email?: string; role?: Role; invited_by?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "rw_family_invites_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "rw_families";
            referencedColumns: ["id"];
          },
        ];
      };
      rw_kids: {
        Row: { id: string; family_id: string; name: string; created_at: string };
        Insert: { id?: string; family_id: string; name: string; created_at?: string };
        Update: { id?: string; family_id?: string; name?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "rw_kids_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "rw_families";
            referencedColumns: ["id"];
          },
        ];
      };
      rw_habits: {
        Row: {
          id: string;
          kid_id: string;
          name: string;
          points: number;
          frequency: Frequency;
          start_date: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          kid_id: string;
          name: string;
          points: number;
          frequency: Frequency;
          start_date?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          kid_id?: string;
          name?: string;
          points?: number;
          frequency?: Frequency;
          start_date?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rw_habits_kid_id_fkey";
            columns: ["kid_id"];
            isOneToOne: false;
            referencedRelation: "rw_kids";
            referencedColumns: ["id"];
          },
        ];
      };
      rw_habit_logs: {
        Row: {
          id: string;
          habit_id: string;
          period_start: string;
          status: "done" | "not_done";
          points: number;
          reviewed_by: string | null;
          reviewed_at: string;
        };
        // Rows are created only through rw_review_habit(); the app reads and deletes (undo).
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "rw_habit_logs_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "rw_habits";
            referencedColumns: ["id"];
          },
        ];
      };
      rw_transactions: {
        Row: {
          id: string;
          kid_id: string;
          points: number;
          reason: string;
          occurred_on: string;
          source: "manual" | "habit";
          habit_log_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kid_id: string;
          points: number;
          reason: string;
          occurred_on?: string;
          source?: "manual";
          habit_log_id?: null;
          created_by?: string | null;
        };
        Update: { points?: number; reason?: string; occurred_on?: string };
        Relationships: [
          {
            foreignKeyName: "rw_transactions_kid_id_fkey";
            columns: ["kid_id"];
            isOneToOne: false;
            referencedRelation: "rw_kids";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      rw_kid_totals: {
        Row: {
          kid_id: string;
          family_id: string;
          name: string;
          balance: number;
          total_earned: number;
          total_deducted: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      rw_create_family: { Args: { p_name: string }; Returns: string };
      rw_accept_invites: { Args: Record<string, never>; Returns: number };
      rw_list_members: {
        Args: { p_family: string };
        Returns: { user_id: string; email: string; full_name: string | null; role: Role }[];
      };
      rw_review_habit: {
        Args: { p_habit_id: string; p_period_start: string; p_status: "done" | "not_done" };
        Returns: string;
      };
      rw_pending_habits: {
        Args: { p_days?: number };
        Returns: {
          habit_id: string;
          kid_id: string;
          kid_name: string;
          habit_name: string;
          points: number;
          frequency: Frequency;
          period_start: string;
          period_end: string;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
