/**
 * Supabase database types for typed client. Matches supabase/migrations schema.
 */

import type { ReactFlowNode, ReactFlowEdge } from "@/lib/types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type DbProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  tokens: number;
  created_at: string;
  updated_at: string;
};

export type DbProfileInsert = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  tokens?: number;
  created_at?: string;
  updated_at?: string;
};

export type DbProfileUpdate = {
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  updated_at?: string;
};

export type DbInterviewSession = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type DbInterviewSessionInsert = {
  id?: string;
  user_id: string;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DbInterviewSessionUpdate = {
  title?: string | null;
  updated_at?: string;
};

export type DbSessionTranscript = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type DbSessionTranscriptInsert = {
  id?: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export type DbCanvasState = {
  id: string;
  session_id: string;
  nodes: ReadonlyArray<ReactFlowNode>;
  edges: ReadonlyArray<ReactFlowEdge>;
  viewport: Json | null;
  created_at: string;
  updated_at: string;
};

export type DbCanvasStateInsert = {
  id?: string;
  session_id: string;
  nodes?: ReadonlyArray<ReactFlowNode>;
  edges?: ReadonlyArray<ReactFlowEdge>;
  viewport?: Json | null;
  created_at?: string;
  updated_at?: string;
};

export type DbCanvasStateUpdate = {
  nodes?: ReadonlyArray<ReactFlowNode>;
  edges?: ReadonlyArray<ReactFlowEdge>;
  viewport?: Json | null;
  updated_at?: string;
};

export type DbSessionSettings = {
  session_id: string;
  auto_review_enabled: boolean;
  updated_at: string;
};

export type DbSessionSettingsInsert = {
  session_id: string;
  auto_review_enabled?: boolean;
  updated_at?: string;
};

export type DbSessionSettingsUpdate = {
  auto_review_enabled?: boolean;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: DbProfile;
        Insert: DbProfileInsert;
        Update: DbProfileUpdate;
      };
      interview_sessions: {
        Row: DbInterviewSession;
        Insert: DbInterviewSessionInsert;
        Update: DbInterviewSessionUpdate;
      };
      session_transcripts: {
        Row: DbSessionTranscript;
        Insert: DbSessionTranscriptInsert;
        Update: Partial<DbSessionTranscript>;
      };
      canvas_states: {
        Row: DbCanvasState;
        Insert: DbCanvasStateInsert;
        Update: DbCanvasStateUpdate;
      };
      session_settings: {
        Row: DbSessionSettings;
        Insert: DbSessionSettingsInsert;
        Update: DbSessionSettingsUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
