// Auto-generated from schema.sql — update with: npx supabase gen types typescript
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          birth_date: string | null;
          gender: 'male' | 'female' | 'other' | null;
          goal: 'muscle' | 'strength' | 'weight_loss' | 'endurance' | 'general' | null;
          level: 'beginner' | 'intermediate' | 'advanced';
          palette: 'volt' | 'pulse' | 'mono';
          units: 'metric' | 'imperial';
          rest_seconds: number;
          xp: number;
          streak_days: number;
          last_workout: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          muscle_group: string;
          muscles: string[];
          equipment: string[];
          default_sets: number;
          default_reps: number;
          default_rest: number;
          is_custom: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['exercises']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['exercises']['Insert']>;
      };
      programs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          goal: string | null;
          level: string | null;
          days_per_week: number;
          source: 'manual' | 'ai';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['programs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['programs']['Insert']>;
      };
      program_sessions: {
        Row: {
          id: string;
          program_id: string;
          name: string;
          day_index: number;
          duration_min: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['program_sessions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['program_sessions']['Insert']>;
      };
      session_exercises: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          order_index: number;
          sets: number;
          reps: number;
          rest_seconds: number;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['session_exercises']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['session_exercises']['Insert']>;
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          program_session_id: string | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          notes: string | null;
          rating: number | null;
          xp_earned: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['workout_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['workout_logs']['Insert']>;
      };
      set_logs: {
        Row: {
          id: string;
          workout_log_id: string;
          exercise_id: string;
          set_index: number;
          reps: number | null;
          weight_kg: number | null;
          duration_sec: number | null;
          is_pr: boolean;
          rpe: number | null;
          completed_at: string;
        };
        Insert: Omit<Database['public']['Tables']['set_logs']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['set_logs']['Insert']>;
      };
      daily_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          body_weight_kg: number | null;
          calories: number | null;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          water_ml: number | null;
          steps: number | null;
          cardio_minutes: number | null;
          sleep_hours: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daily_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['daily_logs']['Insert']>;
      };
      achievements: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          icon: string | null;
          xp_reward: number;
          rarity: 'common' | 'rare' | 'epic' | 'legendary';
        };
        Insert: Omit<Database['public']['Tables']['achievements']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['achievements']['Insert']>;
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          earned_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_achievements']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['user_achievements']['Insert']>;
      };
      personal_records: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          weight_kg: number | null;
          reps: number | null;
          one_rm_kg: number | null;
          set_log_id: string | null;
          achieved_at: string;
        };
        Insert: Omit<Database['public']['Tables']['personal_records']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['personal_records']['Insert']>;
      };
      muscle_volume_weeks: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          muscle_id: string;
          volume_pct: number;
        };
        Insert: Omit<Database['public']['Tables']['muscle_volume_weeks']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['muscle_volume_weeks']['Insert']>;
      };
    };
  };
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type Program = Database['public']['Tables']['programs']['Row'];
export type ProgramSession = Database['public']['Tables']['program_sessions']['Row'];
export type SessionExercise = Database['public']['Tables']['session_exercises']['Row'];
export type WorkoutLog = Database['public']['Tables']['workout_logs']['Row'];
export type SetLog = Database['public']['Tables']['set_logs']['Row'];
export type DailyLog = Database['public']['Tables']['daily_logs']['Row'];
export type Achievement = Database['public']['Tables']['achievements']['Row'];
export type PersonalRecord = Database['public']['Tables']['personal_records']['Row'];
