"use server";

// Server Actions for the web onboarding flow. Profile writes go through the
// request-scoped authed client (RLS enforces the members allowlist); the Claude
// compile uses the Anthropic key from Settings (falling back to the env var).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { renderVoice } from "@/engine/render-profile";
import { compileProfile } from "@/engine/compile-profile";
import { draftAnswersFromUrl } from "@/engine/prefill-from-url";
import { friendlyClaudeError } from "@/engine/anthropic";
import { loadProfile, resolveAnthropicKey } from "@/engine/db";
import type { Profile } from "@/engine/types";
import type { RunMode } from "@/lib/types";

/** The compiled fields we surface for human review before finishing onboarding. */
export interface CompiledReview {
  org_name: string;
  one_liner: string;
  min_amount: number | null;
  anti_patterns: string[];
  framing_angles: { name: string; description: string }[];
  eligibility_constraints: { label: string; detail: string }[];
}

export type CompileResult =
  | { ok: true; orgName: string | null; voice: string; profile: CompiledReview }
  | { ok: false; error: string };

export type PrefillResult =
  | { ok: true; answers: Record<string, string> }
  | { ok: false; error: string };

/** Read the org's website and draft answers to pre-fill the onboarding form. */
export async function prefillFromUrl(url: string): Promise<PrefillResult> {
  const clean = url.trim();
  if (!/^https?:\/\/.+\..+/.test(clean)) {
    return { ok: false, error: "Enter a full website URL, like https://yourorg.org" };
  }
  const supabase = await createClient();
  let apiKey: string;
  try {
    apiKey = await resolveAnthropicKey(supabase);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const answers = await draftAnswersFromUrl(clean, apiKey);
    return { ok: true, answers };
  } catch (e) {
    return { ok: false, error: friendlyClaudeError(e) };
  }
}

/** Step 1: compile the interview answers into a profile + save it (not yet marked complete). */
export async function runOnboardingCompile(
  answers: Record<string, string>,
): Promise<CompileResult> {
  const supabase = await createClient();

  let apiKey: string;
  try {
    apiKey = await resolveAnthropicKey(supabase);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  let profile;
  try {
    profile = await compileProfile(answers, apiKey);
  } catch (e) {
    return { ok: false, error: friendlyClaudeError(e) };
  }

  const voice = renderVoice(profile);
  const { error } = await supabase.from("profile").upsert(
    { id: 1, ...profile, compiled_voice: voice, compiled_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return {
    ok: true,
    orgName: profile.org_name,
    voice,
    profile: {
      org_name: profile.org_name ?? "",
      one_liner: profile.one_liner ?? "",
      min_amount: profile.min_amount ?? null,
      anti_patterns: profile.anti_patterns ?? [],
      framing_angles: profile.framing_angles ?? [],
      eligibility_constraints: profile.eligibility_constraints ?? [],
    },
  };
}

/**
 * Save the operator's edits to the AI-compiled profile (the review step). Merges
 * onto the stored profile and re-renders the compiled voice so the change takes
 * effect on the next run. Garbage-in caught here weakens no downstream agent.
 */
export async function saveProfileReview(
  edits: CompiledReview,
): Promise<{ ok: boolean; error?: string; voice?: string }> {
  const supabase = await createClient();

  let current: Profile;
  try {
    current = await loadProfile(supabase);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const merged: Profile = {
    ...current,
    org_name: edits.org_name.trim() || current.org_name,
    one_liner: edits.one_liner.trim() || current.one_liner,
    min_amount: edits.min_amount,
    anti_patterns: edits.anti_patterns,
    framing_angles: edits.framing_angles,
    eligibility_constraints: edits.eligibility_constraints,
  };
  const voice = renderVoice(merged);

  const { error } = await supabase.from("profile").upsert(
    {
      id: 1,
      org_name: merged.org_name,
      one_liner: merged.one_liner,
      min_amount: merged.min_amount,
      anti_patterns: merged.anti_patterns,
      framing_angles: merged.framing_angles,
      eligibility_constraints: merged.eligibility_constraints,
      compiled_voice: voice,
      compiled_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true, voice };
}

/** Step 2: record how the org wants the engine to run. */
export async function saveRunMode(
  mode: RunMode,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ id: 1, run_mode: mode }, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Step 3: mark onboarding done so the gate stops redirecting here. */
export async function finishOnboarding(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profile")
    .upsert({ id: 1, onboarding_complete: true }, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
