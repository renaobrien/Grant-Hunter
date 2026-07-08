"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { renderVoice } from "@/engine/render-profile";
import type { Profile } from "@/engine/types";
import type { ProfileFormState } from "./ProfileForm";

// Split a raw textarea value into a clean string[] (one item per line).
function lines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// Trim, or null when empty - nullable scalar text columns.
function nz(raw: string): string | null {
  const t = raw.trim();
  return t.length ? t : null;
}

// Parse a number-as-string to an integer, or null. Tolerates "$50,000".
function num(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Colors fall back to the seed defaults if a field was cleared/invalid.
function color(raw: string, fallback: string): string {
  const t = raw.trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? t : fallback;
}

export async function saveProfile(
  p: ProfileFormState,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const framing_angles = p.framing_angles
    .map((a) => ({ name: a.name.trim(), description: a.description.trim() }))
    .filter((a) => a.name.length > 0 || a.description.length > 0);

  const eligibility_constraints = p.eligibility_constraints
    .map((c) => ({ label: c.label.trim(), detail: c.detail.trim() }))
    .filter((c) => c.label.length > 0 || c.detail.length > 0);

  // Build the engine Profile object - this is exactly what renderVoice reads.
  const profile: Profile = {
    org_name: nz(p.org_name),
    one_liner: nz(p.one_liner),
    mission: nz(p.mission),
    problem: nz(p.problem),
    stage: nz(p.stage),
    entity_type: nz(p.entity_type),
    jurisdiction: nz(p.jurisdiction),
    team_summary: nz(p.team_summary),
    traction: nz(p.traction),
    revenue_model: nz(p.revenue_model),
    capabilities: lines(p.capabilities),
    ethos: nz(p.ethos),
    eligibility_constraints,
    min_amount: num(p.min_amount),
    max_amount: num(p.max_amount),
    geographies: lines(p.geographies),
    open_source_posture: nz(p.open_source_posture),
    framing_angles,
    target_grant_types: lines(p.target_grant_types),
    anti_patterns: lines(p.anti_patterns),
    calibration_notes: nz(p.calibration_notes),
  };

  const compiled_voice = renderVoice(profile);

  const supabase = await createClient();
  const { error } = await supabase.from("profile").upsert(
    {
      id: 1,
      ...profile,
      brand_primary: color(p.brand_primary, "#3B5BDB"),
      brand_accent: color(p.brand_accent, "#1D9E75"),
      brand_bg: color(p.brand_bg, "#F7F5F0"),
      compiled_voice,
      compiled_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true };
}
