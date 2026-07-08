// Shared types for the grant engine (Node/TypeScript, run via tsx).

export interface FramingAngle {
  name: string;
  description: string;
}

export interface EligibilityConstraint {
  label: string;
  detail: string;
}

/** The single-org profile row - the white-label "voice". Maps 1:1 to the `profile` table. */
export interface Profile {
  org_name: string | null;
  one_liner: string | null;
  mission: string | null;
  problem: string | null;
  stage: string | null;
  entity_type: string | null;
  jurisdiction: string | null;
  team_summary: string | null;
  traction: string | null;
  revenue_model: string | null;
  capabilities: string[];
  ethos: string | null;
  eligibility_constraints: EligibilityConstraint[];
  min_amount: number | null;
  max_amount: number | null;
  geographies: string[];
  open_source_posture: string | null;
  framing_angles: FramingAngle[];
  target_grant_types: string[];
  anti_patterns: string[];
  calibration_notes: string | null;
  compiled_voice?: string | null;
}

export type Recommendation = "pursue" | "maybe" | "pass";
export type Confidence = "low" | "medium" | "high";
export type RejectionReason =
  | "stale"
  | "eligibility"
  | "misaligned"
  | "invite-only"
  | "size"
  | "timing";

export type GrantStatus =
  | "found"
  | "researching"
  | "drafting"
  | "applied"
  | "submitted"
  | "awarded"
  | "passed"
  | "discarded"
  | "dead";

/** A grant candidate as proposed by the Finder (pre-adjudication). */
export interface Candidate {
  funder: string;
  program_name: string;
  amount: string;
  deadline: string; // 'YYYY-MM-DD' | 'rolling' | 'unknown'
  fit_score: number;
  framing_angle: string;
  eligibility_notes: string;
  blockers: string;
  notes: string;
  source_url: string;
  application_url: string;
}

/** The Skeptic's verdict for one candidate. */
export interface SkepticVerdict {
  verdict: "refuted" | "needs-verification" | "survives";
  kill_shot: string; // one line: why it dies, or why it survives
  eligibility_ok: boolean;
  deadline_ok: boolean;
}

/** The Judge's final adjudicated record for a candidate. */
export interface JudgeRuling {
  survives: boolean;
  funder: string;
  program_name: string;
  amount: string;
  deadline: string;
  fit_score: number;
  recommendation: Recommendation;
  confidence: Confidence;
  alignment_score: number; // 1-5 vs the org's ethos
  alignment_rationale: string;
  framing_angle: string;
  eligibility_notes: string;
  blockers: string;
  notes: string;
  source_url: string;
  application_url: string;
}

/** Token usage returned by each agent call, for cost logging. */
export interface AgentUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  webSearchRequests?: number; // web search is billed per-search on top of tokens
}
