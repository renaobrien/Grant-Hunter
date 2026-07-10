// Row types mirroring the Supabase schema (supabase/migrations 0001+0002+0003)
// plus board layout constants. These are the shapes the dashboard reads/writes.

import type {
  GrantStatus,
  Recommendation,
  Confidence,
  RejectionReason,
  Profile,
} from "@/engine/types";

export type {
  GrantStatus,
  Recommendation,
  Confidence,
  RejectionReason,
  Profile,
};

// ---------------------------------------------------------------------------
// grants
// ---------------------------------------------------------------------------
export interface GrantRow {
  id: string;
  legacy_sheet_id: string | null;
  /** Soft delete: hidden everywhere user-facing, kept for dedup so discovery
   * never resurfaces it. Set by deleteGrant. */
  deleted_at: string | null;
  human_score: number | null;
  rejection_reason: RejectionReason | null;
  date_added: string | null;
  funder: string;
  program_name: string | null;
  amount: string | null;
  amount_numeric: number | null;
  deadline: string | null; // 'YYYY-MM-DD' | 'rolling' | 'unknown'
  fit_score: number | null;
  recommendation: Recommendation | null;
  confidence: Confidence | null;
  status: GrantStatus;
  framing_angle: string | null;
  eligibility_notes: string | null;
  blockers: string | null;
  notes: string | null;
  contacts: string | null;
  source_url: string | null;
  application_url: string | null;
  alignment_score: number | null;
  alignment_rationale: string | null;
  application_spec: string | null;
  outcome: GrantOutcome | null;
  human_notes: string | null;
  last_deadline_ping: string | null;
  last_verified: string | null;
  last_weekly_digest: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// grant_ratings
// ---------------------------------------------------------------------------
export interface GrantRatingRow {
  id: string;
  grant_id: string;
  rated_by: string | null;
  score: number | null;
  rejection_reason: RejectionReason | null;
  feedback: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// agent_debate
// ---------------------------------------------------------------------------
export interface DebateRow {
  id: string;
  run_id: string;
  round: number;
  candidate_key: string | null;
  finder_claim: Record<string, unknown> | null;
  skeptic_verdict: Record<string, unknown> | null;
  judge_ruling: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// drafts + draft_rounds
// ---------------------------------------------------------------------------
export type DraftStatus = "queued" | "running" | "ready" | "error";

export interface DraftRow {
  id: string;
  grant_id: string | null;
  status: DraftStatus;
  content: string | null;
  rounds: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftRoundRow {
  id: string;
  draft_id: string;
  round: number;
  draft_text: string | null;
  critic_verdict: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------
export type JobType = "narrative_draft" | "research" | "brief" | "refresh";
export type JobStatus = "queued" | "running" | "done" | "error";

export interface JobRow {
  id: string;
  type: JobType;
  payload: Record<string, unknown> | null;
  status: JobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// profile (DB row = engine Profile + branding + onboarding + compiled cache)
// ---------------------------------------------------------------------------
export interface ProfileRow extends Profile {
  id: number;
  logo_url: string | null;
  brand_primary: string | null;
  brand_accent: string | null;
  brand_bg: string | null;
  onboarding_complete: boolean | null;
  compiled_voice: string | null;
  compiled_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------
export type RunMode = "github" | "local" | "manual";
export type SpeedMode = "thorough" | "fast";
export type LlmProvider = "anthropic" | "ollama";

export interface SettingsRow {
  id: number;
  discovery_rounds: number;
  discovery_target_survivors: number;
  discovery_min_fit: number;
  discovery_min_alignment: number;
  daily_budget_usd: number;
  run_budget_usd: number;
  preference_summary: string | null;
  weekly_cron: string;
  run_mode: RunMode;
  speed_mode: SpeedMode;
  anthropic_api_key: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// agent_runs
// ---------------------------------------------------------------------------
export type AgentRunStatus = "running" | "success" | "error";
export type AgentTriggerType = "scheduled" | "manual" | "webhook";

export interface AgentRunRow {
  id: string;
  agent_type: string;
  trigger_type: AgentTriggerType;
  status: AgentRunStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  tokens_used: number | null;
  cost_cents: number | null;
}

// ---------------------------------------------------------------------------
// members
// ---------------------------------------------------------------------------
export type MemberRole = "owner" | "member";

export interface MemberRow {
  email: string;
  role: MemberRole;
  created_at: string;
}

// ---------------------------------------------------------------------------
// notification_channels
// ---------------------------------------------------------------------------
export type NotificationChannel = "email" | "slack" | "telegram" | "discord";

export interface NotificationChannelRow {
  id: string;
  channel: NotificationChannel;
  config: Record<string, unknown>;
  enabled: boolean;
  events: string[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Enum const arrays (source of truth for selects / validation in the UI)
// ---------------------------------------------------------------------------
// Five statuses, one per real-world state. (2026-07 simplification: the old
// researching/applied/passed/discarded values collapsed into these - migration
// 0009 remaps existing rows.)
export const GRANT_STATUSES = [
  "found", // discovered, not yet worked on
  "drafting", // actively working the application
  "submitted", // application is in
  "awarded", // won
  "dead", // not pursuing / lost / expired
] as const satisfies readonly GrantStatus[];

export type GrantOutcome = "awarded" | "rejected" | "withdrawn";

export const GRANT_OUTCOMES = [
  "awarded",
  "rejected",
  "withdrawn",
] as const satisfies readonly GrantOutcome[];

export const REJECTION_REASONS = [
  "stale",
  "eligibility",
  "misaligned",
  "invite-only",
  "size",
  "timing",
] as const satisfies readonly RejectionReason[];

// ---------------------------------------------------------------------------
// Board layout: ordered columns grouping grant statuses into pipeline stages.
// ---------------------------------------------------------------------------
export interface StatusColumn {
  key: string;
  label: string;
  statuses: GrantStatus[];
}

export const STATUS_COLUMNS: StatusColumn[] = [
  { key: "searched", label: "Searched", statuses: ["found"] },
  { key: "active", label: "Working on", statuses: ["drafting"] },
  { key: "pending", label: "Submitted", statuses: ["submitted"] },
  { key: "closed", label: "Closed", statuses: ["awarded", "dead"] },
];
