"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { ProfileRow } from "@/lib/types";
import { saveProfile } from "./actions";

// ---------------------------------------------------------------------------
// Shared form shape. actions.ts imports this type (type-only, erased at build).
// Scalar text fields + number-as-string, array fields carried as raw newline
// text (the server action splits them), and structured repeatable rows.
// ---------------------------------------------------------------------------
export interface AngleRow {
  name: string;
  description: string;
}
export interface ConstraintRow {
  label: string;
  detail: string;
}

export interface ProfileFormState {
  org_name: string;
  one_liner: string;
  mission: string;
  problem: string;
  stage: string;
  entity_type: string;
  jurisdiction: string;
  team_summary: string;
  traction: string;
  revenue_model: string;
  ethos: string;
  open_source_posture: string;
  calibration_notes: string;
  min_amount: string;
  max_amount: string;
  capabilities: string;
  geographies: string;
  target_grant_types: string;
  anti_patterns: string;
  framing_angles: AngleRow[];
  eligibility_constraints: ConstraintRow[];
  brand_primary: string;
  brand_accent: string;
  brand_bg: string;
}

const DEFAULT_COLORS = {
  brand_primary: "#3B5BDB",
  brand_accent: "#1D9E75",
  brand_bg: "#F7F5F0",
};

function toState(p: ProfileRow | null): ProfileFormState {
  return {
    org_name: p?.org_name ?? "",
    one_liner: p?.one_liner ?? "",
    mission: p?.mission ?? "",
    problem: p?.problem ?? "",
    stage: p?.stage ?? "",
    entity_type: p?.entity_type ?? "",
    jurisdiction: p?.jurisdiction ?? "",
    team_summary: p?.team_summary ?? "",
    traction: p?.traction ?? "",
    revenue_model: p?.revenue_model ?? "",
    ethos: p?.ethos ?? "",
    open_source_posture: p?.open_source_posture ?? "",
    calibration_notes: p?.calibration_notes ?? "",
    min_amount: p?.min_amount != null ? String(p.min_amount) : "",
    max_amount: p?.max_amount != null ? String(p.max_amount) : "",
    capabilities: (p?.capabilities ?? []).join("\n"),
    geographies: (p?.geographies ?? []).join("\n"),
    target_grant_types: (p?.target_grant_types ?? []).join("\n"),
    anti_patterns: (p?.anti_patterns ?? []).join("\n"),
    framing_angles: (p?.framing_angles ?? []).map((a) => ({
      name: a?.name ?? "",
      description: a?.description ?? "",
    })),
    eligibility_constraints: (p?.eligibility_constraints ?? []).map((c) => ({
      label: c?.label ?? "",
      detail: c?.detail ?? "",
    })),
    brand_primary: p?.brand_primary ?? DEFAULT_COLORS.brand_primary,
    brand_accent: p?.brand_accent ?? DEFAULT_COLORS.brand_accent,
    brand_bg: p?.brand_bg ?? DEFAULT_COLORS.brand_bg,
  };
}

// ---------------------------------------------------------------------------
// Presentational helpers (module scope, no state of their own)
// ---------------------------------------------------------------------------
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="card form-section">
      <h2>{title}</h2>
      {hint ? <p className="muted">{hint}</p> : null}
      {children}
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {hint ? <span className="field-hint">{hint}</span> : null}
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // The native color input only accepts #rrggbb; guard against partial hex the
  // user may be typing so it doesn't throw a React warning.
  const swatchValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="field">
      <label>{label}</label>
      <div className="swatch-row">
        <input
          type="color"
          className="swatch"
          value={swatchValue}
          aria-label={`${label} color picker`}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          value={value}
          spellCheck={false}
          aria-label={`${label} hex value`}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
export default function ProfileForm({ profile }: { profile: ProfileRow | null }) {
  const [state, setState] = useState<ProfileFormState>(() => toState(profile));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  function set<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) {
    setState((s) => ({ ...s, [key]: value }));
    setStatus("idle");
  }

  // --- repeatable: framing angles ---
  function addAngle() {
    set("framing_angles", [...state.framing_angles, { name: "", description: "" }]);
  }
  function updateAngle(i: number, patch: Partial<AngleRow>) {
    set(
      "framing_angles",
      state.framing_angles.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );
  }
  function removeAngle(i: number) {
    set(
      "framing_angles",
      state.framing_angles.filter((_, idx) => idx !== i),
    );
  }

  // --- repeatable: eligibility constraints ---
  function addConstraint() {
    set("eligibility_constraints", [
      ...state.eligibility_constraints,
      { label: "", detail: "" },
    ]);
  }
  function updateConstraint(i: number, patch: Partial<ConstraintRow>) {
    set(
      "eligibility_constraints",
      state.eligibility_constraints.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    );
  }
  function removeConstraint(i: number) {
    set(
      "eligibility_constraints",
      state.eligibility_constraints.filter((_, idx) => idx !== i),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    startTransition(async () => {
      const res = await saveProfile(state);
      if (res.ok) {
        setStatus("ok");
      } else {
        setStatus("err");
        setErrMsg(res.error);
      }
    });
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Section
        title="Identity & mission"
        hint="Who the organization is. This anchors every agent prompt."
      >
        <TextField
          label="Organization name"
          value={state.org_name}
          onChange={(v) => set("org_name", v)}
          placeholder="Acme Public Goods"
        />
        <TextField
          label="One-liner"
          hint="Completes the sentence: “{Org} is …”."
          value={state.one_liner}
          onChange={(v) => set("one_liner", v)}
          placeholder="a nonprofit building open climate data infrastructure"
        />
        <TextField
          label="Mission"
          value={state.mission}
          onChange={(v) => set("mission", v)}
          multiline
        />
        <TextField
          label="Problem"
          hint="The core problem the org solves."
          value={state.problem}
          onChange={(v) => set("problem", v)}
          multiline
        />
      </Section>

      <Section
        title="Current state"
        hint="Be honest — agents weigh fit against reality, not aspiration."
      >
        <div className="form-grid-2">
          <TextField
            label="Stage"
            value={state.stage}
            onChange={(v) => set("stage", v)}
            placeholder="early / growth / established"
          />
          <TextField
            label="Entity type"
            value={state.entity_type}
            onChange={(v) => set("entity_type", v)}
            placeholder="501(c)(3) / for-profit / DAO"
          />
          <TextField
            label="Jurisdiction"
            value={state.jurisdiction}
            onChange={(v) => set("jurisdiction", v)}
            placeholder="Delaware, USA"
          />
          <TextField
            label="Revenue model"
            value={state.revenue_model}
            onChange={(v) => set("revenue_model", v)}
            placeholder="grants + services"
          />
        </div>
        <TextField
          label="Team summary"
          value={state.team_summary}
          onChange={(v) => set("team_summary", v)}
          multiline
        />
        <TextField
          label="Traction"
          value={state.traction}
          onChange={(v) => set("traction", v)}
          multiline
        />
      </Section>

      <Section
        title="Capabilities & ethos"
        hint="What the org can credibly claim, and what it weighs alignment against."
      >
        <TextField
          label="Capabilities"
          hint="One per line."
          value={state.capabilities}
          onChange={(v) => set("capabilities", v)}
          placeholder={"Open-source data pipelines\nPeer-reviewed research\nCommunity governance"}
          multiline
        />
        <TextField
          label="Ethos"
          value={state.ethos}
          onChange={(v) => set("ethos", v)}
          multiline
        />
      </Section>

      <Section
        title="Eligibility & constraints"
        hint="Hard facts the agents reason from — they won't assume beyond these."
      >
        <label>Eligibility constraints</label>
        <span className="field-hint">
          A short label plus the detail the agent should reason from.
        </span>
        <div className="repeat-list">
          {state.eligibility_constraints.map((c, i) => (
            <div className="repeat-row" key={i}>
              <input
                type="text"
                value={c.label}
                placeholder="Label (e.g. Geography)"
                onChange={(e) => updateConstraint(i, { label: e.target.value })}
              />
              <input
                type="text"
                value={c.detail}
                placeholder="Detail (e.g. Must operate in the EU)"
                onChange={(e) => updateConstraint(i, { detail: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => removeConstraint(i)}
                aria-label="Remove constraint"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm" onClick={addConstraint}>
          + Add constraint
        </button>

        <div className="form-grid-2" style={{ marginTop: "var(--s3)" }}>
          <div className="field">
            <label>Minimum amount (USD)</label>
            <input
              type="number"
              value={state.min_amount}
              placeholder="25000"
              onChange={(e) => set("min_amount", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Maximum amount (USD)</label>
            <input
              type="number"
              value={state.max_amount}
              placeholder="500000"
              onChange={(e) => set("max_amount", e.target.value)}
            />
          </div>
        </div>
        <TextField
          label="Geographies"
          hint="One per line."
          value={state.geographies}
          onChange={(v) => set("geographies", v)}
          placeholder={"Global\nEU\nUnited States"}
          multiline
        />
        <TextField
          label="Open-source posture"
          value={state.open_source_posture}
          onChange={(v) => set("open_source_posture", v)}
          placeholder="all code MIT-licensed"
        />
      </Section>

      <Section
        title="Positioning"
        hint="How to frame the org to funders — and how never to frame it."
      >
        <label>Framing angles</label>
        <span className="field-hint">
          A name plus how the agent should deploy it for the right funder.
        </span>
        <div className="repeat-list">
          {state.framing_angles.map((a, i) => (
            <div className="repeat-row" key={i}>
              <input
                type="text"
                value={a.name}
                placeholder="Name (e.g. Public goods)"
                onChange={(e) => updateAngle(i, { name: e.target.value })}
              />
              <input
                type="text"
                value={a.description}
                placeholder="When and how to use this angle"
                onChange={(e) => updateAngle(i, { description: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => removeAngle(i)}
                aria-label="Remove framing angle"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm" onClick={addAngle}>
          + Add framing angle
        </button>

        <div style={{ marginTop: "var(--s3)" }}>
          <TextField
            label="Target grant types"
            hint="One per line."
            value={state.target_grant_types}
            onChange={(v) => set("target_grant_types", v)}
            placeholder={"Climate tech R&D\nOpen-source infrastructure\nCivic technology"}
            multiline
          />
          <TextField
            label="Anti-patterns"
            hint="One per line — framings the agents must never use."
            value={state.anti_patterns}
            onChange={(v) => set("anti_patterns", v)}
            placeholder={"a for-profit startup\na consultancy"}
            multiline
          />
        </div>
      </Section>

      <Section
        title="Calibration"
        hint="Notes from prior human review that steer the agents' judgment."
      >
        <TextField
          label="Calibration notes"
          value={state.calibration_notes}
          onChange={(v) => set("calibration_notes", v)}
          multiline
        />
      </Section>

      <Section
        title="Branding"
        hint="White-label colors for this instance. Applied on the next page load."
      >
        <div className="form-grid">
          <ColorField
            label="Primary"
            value={state.brand_primary}
            onChange={(v) => set("brand_primary", v)}
          />
          <ColorField
            label="Accent"
            value={state.brand_accent}
            onChange={(v) => set("brand_accent", v)}
          />
          <ColorField
            label="Background"
            value={state.brand_bg}
            onChange={(v) => set("brand_bg", v)}
          />
        </div>
      </Section>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        {status === "ok" ? (
          <span className="form-msg form-msg-ok">
            Saved — compiled voice regenerated.
          </span>
        ) : null}
        {status === "err" ? (
          <span className="form-msg form-msg-err">
            {errMsg ?? "Save failed."}
          </span>
        ) : null}
        {status === "idle" ? (
          <span className="muted field-hint">
            Saving rebuilds the compiled voice below.
          </span>
        ) : null}
      </div>
    </form>
  );
}
