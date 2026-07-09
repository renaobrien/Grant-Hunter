"use client";

// Three-step web onboarding: (1) interview → AI-compiled profile, (2) how the
// engine runs, (3) you're set + where to get help. Org-neutral / white-label.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_QUESTIONS } from "@/engine/onboarding-questions";
import type { RunMode } from "@/lib/types";
import {
  runOnboardingCompile,
  prefillFromUrl,
  saveRunMode,
  finishOnboarding,
} from "./actions";

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

export default function OnboardingFlow({ initialMode }: { initialMode: RunMode }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<RunMode>(initialMode);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [prefillMsg, setPrefillMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const chosen = RUN_MODES.find((m) => m.value === mode);
  const requiredMissing = ONBOARDING_QUESTIONS.some(
    (q) => q.required && !answers[q.key]?.trim(),
  );

  function setAnswer(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  function prefill() {
    setError(null);
    setPrefillMsg(null);
    startTransition(async () => {
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

  function compile() {
    setError(null);
    startTransition(async () => {
      // Pass the website URL along so the compiler can consult it to fill gaps.
      const res = await runOnboardingCompile({ ...answers, url });
      if (res.ok) {
        setOrgName(res.orgName);
        setVoice(res.voice);
        setStep(2);
      } else {
        setError(res.error);
      }
    });
  }

  function chooseMode() {
    setError(null);
    startTransition(async () => {
      const res = await saveRunMode(mode);
      if (res.ok) setStep(3);
      else setError(res.error ?? "Couldn't save that.");
    });
  }

  function finish() {
    startTransition(async () => {
      await finishOnboarding();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="onb">
      <ol className="onb-steps" aria-label="Onboarding progress">
        {["Your organization", "How it runs", "You're set"].map((label, i) => {
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
                disabled={isPending || !url.trim()}
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
                : requiredMissing
                ? "Fill in the required (*) fields to continue."
                : ""}
            </span>
            <button
              className="btn btn-primary"
              onClick={compile}
              disabled={isPending || requiredMissing}
            >
              {isPending ? "Setting up…" : "Set up my profile"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2 - run mode */}
      {step === 2 && (
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
            <button className="btn" onClick={() => setStep(1)} disabled={isPending}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={chooseMode} disabled={isPending}>
              {isPending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 - done + help */}
      {step === 3 && (
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
            <button className="btn" onClick={() => setStep(2)} disabled={isPending}>
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
