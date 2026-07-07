// db.ts — service-role Supabase access for the engine: profile/settings loading,
// the daily budget cap, agent_runs logging, grant upsert, and debate writes.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentUsage, JudgeRuling, Profile } from "./types";
import { estimateCostCents } from "./anthropic";

export function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Set them in the environment (or .env.local).",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function requireAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY.");
  return key;
}

const arr = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

export async function loadProfile(sb: SupabaseClient): Promise<Profile> {
  const { data, error } = await sb.from("profile").select("*").eq("id", 1).single();
  if (error || !data) throw new Error(`Could not load profile: ${error?.message ?? "no row"}`);
  return {
    org_name: data.org_name,
    one_liner: data.one_liner,
    mission: data.mission,
    problem: data.problem,
    stage: data.stage,
    entity_type: data.entity_type,
    jurisdiction: data.jurisdiction,
    team_summary: data.team_summary,
    traction: data.traction,
    revenue_model: data.revenue_model,
    capabilities: arr(data.capabilities),
    ethos: data.ethos,
    eligibility_constraints: arr(data.eligibility_constraints),
    min_amount: data.min_amount,
    max_amount: data.max_amount,
    geographies: arr(data.geographies),
    open_source_posture: data.open_source_posture,
    framing_angles: arr(data.framing_angles),
    target_grant_types: arr(data.target_grant_types),
    anti_patterns: arr(data.anti_patterns),
    calibration_notes: data.calibration_notes,
    compiled_voice: data.compiled_voice,
  };
}

export interface Settings {
  discovery_rounds: number;
  discovery_target_survivors: number;
  daily_budget_usd: number;
}

export async function loadSettings(sb: SupabaseClient): Promise<Settings> {
  const { data } = await sb
    .from("settings")
    .select("discovery_rounds, discovery_target_survivors, daily_budget_usd")
    .eq("id", 1)
    .single();
  return {
    discovery_rounds: data?.discovery_rounds ?? 2,
    discovery_target_survivors: data?.discovery_target_survivors ?? 5,
    daily_budget_usd: Number(data?.daily_budget_usd ?? 5),
  };
}

/** Cents already spent by agents today (via the SQL helper). Fails closed:
 * if the helper can't be read, agents must not run — the cap is a safety promise. */
export async function spentCentsToday(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.rpc("spent_cents_today");
  if (error) {
    throw new Error(
      `spent_cents_today() failed (${error.message}) — cannot enforce the daily budget cap. ` +
        "Check that supabase/migrations/0001_init.sql was applied.",
    );
  }
  return Number(data ?? 0);
}

/** Cents of budget left today. <= 0 means the cap is hit and agents must not run. */
export async function budgetRemainingCents(
  sb: SupabaseClient,
  dailyBudgetUsd: number,
): Promise<number> {
  const spent = await spentCentsToday(sb);
  return Math.round(dailyBudgetUsd * 100) - spent;
}

// --------------------------------------------------------------------------
// agent_runs logging
// --------------------------------------------------------------------------
export interface RunHandle {
  id: string;
  startedMs: number;
}

export async function startRun(
  sb: SupabaseClient,
  agentType: string,
  triggerType: "scheduled" | "manual" | "webhook",
  input?: unknown,
): Promise<RunHandle> {
  const { data, error } = await sb
    .from("agent_runs")
    .insert({ agent_type: agentType, trigger_type: triggerType, status: "running", input_data: input ?? null })
    .select("id")
    .single();
  if (error || !data) throw new Error(`startRun failed: ${error?.message}`);
  return { id: data.id, startedMs: Date.now() };
}

export async function finishRun(
  sb: SupabaseClient,
  run: RunHandle,
  opts: {
    status: "success" | "error";
    usage?: AgentUsage;
    output?: unknown;
    error?: string;
  },
): Promise<void> {
  const cost = opts.usage
    ? estimateCostCents(
        opts.usage.inputTokens,
        opts.usage.outputTokens,
        opts.usage.model,
        opts.usage.webSearchRequests ?? 0,
      )
    : null;
  const { error } = await sb
    .from("agent_runs")
    .update({
      status: opts.status,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - run.startedMs,
      tokens_used: opts.usage ? opts.usage.inputTokens + opts.usage.outputTokens : null,
      cost_cents: cost,
      output_data: opts.output ?? null,
      error_message: opts.error ?? null,
    })
    .eq("id", run.id);
  if (error) console.error(`[db] finishRun update failed: ${error.message}`);
}

export async function writeDebate(
  sb: SupabaseClient,
  row: {
    run_id: string;
    round: number;
    candidate_key: string;
    finder_claim: unknown;
    skeptic_verdict: unknown;
    judge_ruling: unknown;
  },
): Promise<void> {
  const { error } = await sb.from("agent_debate").insert(row);
  if (error) console.error(`[db] agent_debate insert failed: ${error.message}`);
}

// --------------------------------------------------------------------------
// grants upsert (matches by URL, else funder+program; preserves human triage)
// --------------------------------------------------------------------------
interface GrantIndexRow {
  id: string;
  funder: string | null;
  program_name: string | null;
  source_url: string | null;
  application_url: string | null;
  human_score: number | null;
}

const isHttp = (u?: string | null) => !!u && /^https?:\/\//i.test(u);
const eq = (a?: string | null, b?: string | null) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export function parseAmount(amount?: string | null): number | null {
  if (!amount) return null;
  const m = String(amount).replace(/,/g, "").match(/\$?\s*([\d.]+)\s*([kKmM])?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit === "k") n *= 1e3;
  else if (unit === "m") n *= 1e6;
  return Math.round(n);
}

export async function loadGrantsIndex(sb: SupabaseClient): Promise<GrantIndexRow[]> {
  const { data, error } = await sb
    .from("grants")
    .select("id, funder, program_name, source_url, application_url, human_score");
  // Fail loudly: an empty index from a silent error would disable dedup AND the
  // "don't resurface human-rejected grants" protection.
  if (error) throw new Error(`Could not load grants index: ${error.message}`);
  return (data ?? []) as GrantIndexRow[];
}

function findMatch(index: GrantIndexRow[], r: JudgeRuling): GrantIndexRow | undefined {
  const urls = [r.application_url, r.source_url].filter(isHttp) as string[];
  if (urls.length) {
    const byUrl = index.find((g) =>
      [g.application_url, g.source_url].filter(isHttp).some((u) => urls.includes(u as string)),
    );
    if (byUrl) return byUrl;
  }
  return index.find((g) => eq(g.funder, r.funder) && eq(g.program_name, r.program_name));
}

export type UpsertResult = { action: "created" | "updated" | "skipped"; id?: string };

/**
 * Insert or update a grant from a Judge ruling. Preserves any existing human_score,
 * rejection_reason, and status. Skips grants the human already scored <= 2 (don't resurface).
 */
export async function upsertRuling(
  sb: SupabaseClient,
  r: JudgeRuling,
  index: GrantIndexRow[],
): Promise<UpsertResult> {
  const existing = findMatch(index, r);

  if (existing && existing.human_score != null && existing.human_score <= 2) {
    return { action: "skipped" };
  }

  const fields = {
    funder: r.funder,
    program_name: r.program_name,
    amount: r.amount || "unknown",
    amount_numeric: parseAmount(r.amount),
    deadline: r.deadline || "unknown",
    fit_score: r.fit_score,
    recommendation: r.recommendation,
    confidence: r.confidence,
    framing_angle: r.framing_angle,
    eligibility_notes: r.eligibility_notes,
    blockers: r.blockers,
    notes: r.notes,
    source_url: isHttp(r.source_url) ? r.source_url : null,
    application_url: isHttp(r.application_url) ? r.application_url : null,
    alignment_score: r.alignment_score,
    alignment_rationale: r.alignment_rationale,
    last_verified: new Date().toISOString(),
  };

  if (existing) {
    await sb.from("grants").update(fields).eq("id", existing.id);
    return { action: "updated", id: existing.id };
  }

  const { data, error } = await sb
    .from("grants")
    .insert({ ...fields, status: "found", date_added: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(`insert grant failed: ${error.message}`);

  // keep the in-memory index current so later rulings in the same run dedupe
  index.push({
    id: data!.id,
    funder: r.funder,
    program_name: r.program_name,
    source_url: fields.source_url,
    application_url: fields.application_url,
    human_score: null,
  });
  return { action: "created", id: data!.id };
}
