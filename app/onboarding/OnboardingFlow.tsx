"use client";

// Four-step web onboarding: (1) interview → AI-compiled profile, (2) review + edit
// the compiled profile, (3) how the engine runs, (4) you're set. White-label.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_QUESTIONS } from "@/engine/onboarding-questions";
import type { RunMode } from "@/lib/types";
import { saveAnthropicKey } from "@/app/settings/actions";
import { startDiscovery } from "@/app/runs/actions";
import {
  runOnboardingCompile,
  prefillFromUrl,
  saveRunMode,
  saveProfileReview,
  finishOnboarding,
  type CompiledReview,
} from "./actions";

// The review step edits arrays of objects; encode them as one-per-line text so
// the operator can edit them in a plain textarea, then parse back on save.
const anglesToText = (a: { name: string; description: string }[]) =>
  a.map((x) => `${x.name}: ${x.description}`).join("\n");
const textToAngles = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      return i > 0
        ? { name: l.slice(0, i).trim(), description: l.slice(i + 1).trim() }
        : { name: l, description: "" };
    })
    .filter((x) => x.name);
const constraintsToText = (c: { label: string; detail: string }[]) =>
  c.map((x) => `${x.label}: ${x.detail}`).join("\n");
const textToConstraints = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      return i > 0
        ? { label: l.slice(0, i).trim(), detail: l.slice(i + 1).trim() }
        : { label: l, detail: "" };
    })
    .filter((x) => x.label);
const linesToList = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const RUN_MODES: {
  value: RunMode;
  title: string;
  blurb: string;
  note: string;
}[] = [
  {
    value: "github",
    title: "Automatic (recommended)",
    blurb:
      "Your grant engine runs in the cloud on a schedule - even when your computer is off.",
    note: "Needs a free GitHub account and a ~2-minute one-time secret setup.",
  },
  {
    value: "local",
    title: "On my computer",
    blurb:
      "No GitHub. You run a command (or schedule it on your machine) to find grants.",
    note: "Only runs while your computer is on and awake.",
  },
  {
    value: "manual",
    title: "Manually for now",
    blurb:
      "Nothing runs on its own - press Run discovery on the board or Runs page whenever you want.",
    note: "You can switch to automatic later in Settings.",
  },
];

export default function OnboardingFlow({
  initialMode,
  hasKey,
}: {
  initialMode: RunMode;
  hasKey: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<RunMode>(initialMode);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [prefillMsg, setPrefillMsg] = useState<string | null>(null);
  // Anthropic key, collected here when none is configured. Without it the AI
  // compile can't run, and the middleware won't let the user reach Settings to
  // add it later - so onboarding is the one place that must not assume a key.
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  // Review-step fields (seeded from the AI-compiled profile, editable before finishing).
  const [rOrg, setROrg] = useState("");
  const [rOneLiner, setROneLiner] = useState("");
  const [rMinAmount, setRMinAmount] = useState("");
  const [rAngles, setRAngles] = useState("");
  const [rAnti, setRAnti] = useState("");
  const [rElig, setRElig] = useState("");
  const [isPending, startTransition] = useTransition();

  const chosen = RUN_MODES.find((m) => m.value === mode);
  const requiredMissing = ONBOARDING_QUESTIONS.some(
    (q) => q.required && !answers[q.key]?.trim(),
  );
  const needsKey = !hasKey && !keySaved;
  const keyMissing = needsKey && !apiKey.trim();

  function setAnswer(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  /** Persist the entered key before the first AI call. Returns false (and sets
   *  an error) when a key is required but missing or rejected. */
  async function ensureKey(): Promise<boolean> {
    if (!needsKey) return true;
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("Add your Anthropic API key to continue.");
      return false;
    }
    const res = await saveAnthropicKey(trimmed);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setKeySaved(true);
    return true;
  }

  function prefill() {
    setError(null);
    setPrefillMsg(null);
    startTransition(async () => {
      if (!(await ensureKey())) return;
      const res = await prefillFromUrl(url);
      if (res.ok) {
        const n = Object.keys(res.answers).length;
        setAnswers((a) => ({ ...a, ...res.answers }));
        setPrefillMsg(
          n > 0
            ? `Filled in ${n} field${n === 1 ? "" : "s"} from your site - review and edit below.`
            : "Couldn't find much on that page - fill it in below.",
        );
      } else {
        setPrefillMsg(res.error);
      }
    });
  }

  function hydrateReview(p: CompiledReview) {
    setROrg(p.org_name);
    setROneLiner(p.one_liner);
    setRMinAmount(p.min_amount != null ? String(p.min_amount) : "");
    setRAngles(anglesToText(p.framing_angles));
    setRAnti(p.anti_patterns.join("\n"));
    setRElig(constraintsToText(p.eligibility_constraints));
  }

  function compile() {
    setError(null);
    startTransition(async () => {
      if (!(await ensureKey())) return;
      // Pass the website URL along so the compiler can consult it to fill gaps.
      const res = await runOnboardingCompile({ ...answers, url });
      if (res.ok) {
        setOrgName(res.orgName);
        setVoice(res.voice);
        hydrateReview(res.profile);
        setStep(2);
      } else {
        setError(res.error);
      }
    });
  }

  function saveReview() {
    setError(null);
    startTransition(async () => {
      const minAmount = rMinAmount.trim() ? Number(rMinAmount) : null;
      if (minAmount != null && !Number.isFinite(minAmount)) {
        setError("Minimum amount must be a number (or blank).");
        return;
      }
      const res = await saveProfileReview({
        org_name: rOrg,
        one_liner: rOneLiner,
        min_amount: minAmount,
        anti_patterns: linesToList(rAnti),
        framing_angles: textToAngles(rAngles),
        eligibility_constraints: textToConstraints(rElig),
      });
      if (res.ok) {
        if (res.voice) setVoice(res.voice);
        if (rOrg.trim()) setOrgName(rOrg.trim());
        setStep(3);
      } else {
        setError(res.error ?? "Couldn't save your edits.");
      }
    });
  }

  function chooseMode() {
    setError(null);
    startTransition(async () => {
      const res = await saveRunMode(mode);
      if (res.ok) setStep(4);
      else setError(res.error ?? "Couldn't save that.");
    });
  }

  function finish() {
    startTransition(async () => {
      await finishOnboarding();
      // Kick off the first discovery so the board fills itself instead of showing
      // an empty state. Best-effort: on a hosted instance this no-ops with a hint
      // the board surfaces, and the budget cap stops it if there's no budget.
      try {
        await startDiscovery();
      } catch {
        // Board shows how to run manually if the auto-start couldn't fire.
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="onb">
      <ol className="onb-steps" aria-label="Onboarding progress">
        {["Your organization", "Review profile", "How it runs", "You're set"].map((label, i) => {
          const n = i + 1;
          const state = step === n ? "on" : step > n ? "done" : "todo";
          return (
            <li key={label} className={`onb-step onb-step-${state}`}>
              <span className="onb-step-num">{step > n ? "✓" : n}</span>
              <span className="onb-step-label">{label}</span>
            </li>
          );
        })}
      </ol>

      {/* Step 1 - interview */}
      {step === 1 && (
        <div className="card stack">
          <div>
            <h1>Tell us about your organization</h1>
            <p className="muted">
              We turn your answers into the profile your grant agents search and
              write with. Fields marked <span className="req">*</span> are
              required; the rest sharpen results. You can edit all of it later.
            </p>
          </div>

          {/* Anthropic key - shown only when none is configured. Required before
              any AI step so the user is never stuck without a way to add it. */}
          {needsKey ? (
            <div className="field">
              <label htmlFor="anthropic-key">
                Anthropic API key <span className="req" aria-label="required">*</span>
              </label>
              <input
                id="anthropic-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                disabled={isPending}
              />
              <span className="field-hint">
                Your agents use this to search and write. Stored in your own
                database, never shown back. Get one at console.anthropic.com,
                and set a monthly usage limit on it there (Settings, Limits) so
                Anthropic caps your bill no matter what.
              </span>
            </div>
          ) : null}

          {/* Optional: auto-fill from the org's website */}
          <div className="field onb-prefill">
            <label htmlFor="prefill-url">
              Have a website? Paste it and we&rsquo;ll fill this in for you
            </label>
            <div className="row" style={{ gap: "var(--s2)" }}>
              <input
                id="prefill-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourorg.org"
                disabled={isPending}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn"
                onClick={prefill}
                disabled={isPending || !url.trim() || keyMissing}
              >
                {isPending ? "Reading…" : "Fill from site"}
              </button>
            </div>
            {prefillMsg ? (
              <span className="field-hint">{prefillMsg}</span>
            ) : (
              <span className="field-hint">
                Optional. We read your public site and draft the answers below -
                you review and edit before continuing.
              </span>
            )}
          </div>

          {ONBOARDING_QUESTIONS.map((q) => (
            <div key={q.key} className="field">
              <label htmlFor={`q-${q.key}`}>
                {q.label}{" "}
                {q.required ? (
                  <span className="req" aria-label="required">
                    *
                  </span>
                ) : (
                  <span className="muted">(optional)</span>
                )}
              </label>
              {q.multiline ? (
                <textarea
                  id={`q-${q.key}`}
                  value={answers[q.key] ?? ""}
                  onChange={(e) => setAnswer(q.key, e.target.value)}
                  rows={3}
                  placeholder={q.example}
                  disabled={isPending}
                />
              ) : (
                <input
                  id={`q-${q.key}`}
                  type="text"
                  value={answers[q.key] ?? ""}
                  onChange={(e) => setAnswer(q.key, e.target.value)}
                  placeholder={q.example}
                  disabled={isPending}
                />
              )}
            </div>
          ))}

          {error ? <p className="form-msg form-msg-err">{error}</p> : null}

          <div className="onb-actions">
            <span className="muted onb-hint">
              {isPending
                ? "Working with AI - this takes a few seconds…"
                : keyMissing
                ? "Add your Anthropic API key to continue."
                : requiredMissing
                ? "Fill in the required (*) fields to continue."
                : ""}
            </span>
            <button
              className="btn btn-primary"
              onClick={compile}
              disabled={isPending || requiredMissing || keyMissing}
            >
              {isPending ? "Setting up…" : "Set up my profile"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2 - review + edit the AI-compiled profile */}
      {step === 2 && (
        <div className="card stack">
          <div>
            <h1>Review your profile{orgName ? `, ${orgName}` : ""}</h1>
            <p className="muted">
              The AI compiled these from your answers. They drive every search and
              draft, so fix anything off before continuing. Everything stays
              editable later under <strong>Profile</strong>.
            </p>
          </div>

          <div className="field">
            <label htmlFor="r-org">Organization name</label>
            <input
              id="r-org"
              type="text"
              value={rOrg}
              onChange={(e) => setROrg(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="r-oneliner">One-liner</label>
            <input
              id="r-oneliner"
              type="text"
              value={rOneLiner}
              onChange={(e) => setROneLiner(e.target.value)}
              placeholder="a nonprofit building X"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="r-min">Smallest grant worth tracking (USD)</label>
            <input
              id="r-min"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={rMinAmount}
              onChange={(e) => setRMinAmount(e.target.value)}
              placeholder="e.g. 10000 (blank = no minimum)"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="r-angles">Framing angles (one per line, &ldquo;Name: description&rdquo;)</label>
            <textarea
              id="r-angles"
              rows={4}
              value={rAngles}
              onChange={(e) => setRAngles(e.target.value)}
              placeholder="Open-source infrastructure: we build public tools anyone can reuse"
              disabled={isPending}
            />
            <span className="field-hint">How the agents pitch you, chosen per funder.</span>
          </div>

          <div className="field">
            <label htmlFor="r-anti">Never frame us as (one per line)</label>
            <textarea
              id="r-anti"
              rows={3}
              value={rAnti}
              onChange={(e) => setRAnti(e.target.value)}
              placeholder="a defense contractor"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="r-elig">Eligibility facts (one per line, &ldquo;Label: detail&rdquo;)</label>
            <textarea
              id="r-elig"
              rows={3}
              value={rElig}
              onChange={(e) => setRElig(e.target.value)}
              placeholder="Entity: 501(c)(3) nonprofit, United States"
              disabled={isPending}
            />
            <span className="field-hint">Facts the agents must reason from, not assume.</span>
          </div>

          {error ? <p className="form-msg form-msg-err">{error}</p> : null}

          <div className="onb-actions">
            <button className="btn" onClick={() => setStep(1)} disabled={isPending}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={saveReview} disabled={isPending}>
              {isPending ? "Saving…" : "Looks good, continue"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 - run mode */}
      {step === 3 && (
        <div className="card stack">
          <div>
            <h1>How should your grant engine run?</h1>
            {orgName ? (
              <p className="muted">
                Profile ready for <strong>{orgName}</strong>. Now pick how it
                should look for grants.
              </p>
            ) : (
              <p className="muted">Pick how your engine should look for grants.</p>
            )}
          </div>

          <div className="onb-modes">
            {RUN_MODES.map((m) => (
              <label
                key={m.value}
                className={`onb-mode ${mode === m.value ? "onb-mode-on" : ""}`}
              >
                <input
                  type="radio"
                  name="run-mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  disabled={isPending}
                />
                <span className="onb-mode-body">
                  <span className="onb-mode-title">{m.title}</span>
                  <span className="onb-mode-blurb">{m.blurb}</span>
                  <span className="onb-mode-note muted">{m.note}</span>
                </span>
              </label>
            ))}
          </div>

          {error ? <p className="form-msg form-msg-err">{error}</p> : null}

          <div className="onb-actions">
            <button className="btn" onClick={() => setStep(2)} disabled={isPending}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={chooseMode} disabled={isPending}>
              {isPending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 - done + help */}
      {step === 4 && (
        <div className="card stack">
          <div>
            <h1>You&rsquo;re all set{orgName ? `, ${orgName}` : ""} 🎉</h1>
            <p className="muted">Here&rsquo;s how to get the most out of it.</p>
          </div>

          <div className="onb-help">
            <div className="onb-help-item">
              <strong>Found a bug or have an idea?</strong>
              <p className="muted">
                Hit the <strong>Feedback</strong> button in the bottom-right corner
                on any page. It files a ticket (with a screenshot) straight to the
                project - no email needed.
              </p>
            </div>
            <div className="onb-help-item">
              <strong>Your engine: {chosen?.title.replace(" (recommended)", "")}</strong>
              <p className="muted">{chosen?.note}</p>
            </div>
            <div className="onb-help-item">
              <strong>Everything&rsquo;s editable.</strong>
              <p className="muted">
                Tweak your org profile any time under <strong>Profile</strong>, and
                budgets/scheduling under <strong>Settings</strong>.
              </p>
            </div>
          </div>

          {voice ? (
            <details className="transcript">
              <summary>Preview the profile your agents will use</summary>
              <pre className="voice-preview">{voice}</pre>
            </details>
          ) : null}

          <div className="onb-actions">
            <button className="btn" onClick={() => setStep(3)} disabled={isPending}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={finish} disabled={isPending}>
              {isPending ? "Finishing…" : "Go to my board →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
