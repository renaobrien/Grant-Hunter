"use client";

import { useState, useTransition, type FormEvent } from "react";
import { saveSettings, regeneratePreferenceSummary } from "./actions";

export interface SettingsFormInitial {
  daily_budget_usd: number;
  discovery_rounds: number;
  discovery_target_survivors: number;
  discovery_min_fit: number;
  discovery_min_alignment: number;
  preference_summary: string;
  speed_mode: "thorough" | "fast";
}

export default function SettingsForm({
  initial,
}: {
  initial: SettingsFormInitial;
}) {
  const [budget, setBudget] = useState(String(initial.daily_budget_usd));
  const [rounds, setRounds] = useState(String(initial.discovery_rounds));
  const [survivors, setSurvivors] = useState(
    String(initial.discovery_target_survivors),
  );
  const [minFit, setMinFit] = useState(String(initial.discovery_min_fit));
  const [minAlignment, setMinAlignment] = useState(
    String(initial.discovery_min_alignment),
  );
  const [summary, setSummary] = useState(initial.preference_summary);
  const [speed, setSpeed] = useState<"thorough" | "fast">(initial.speed_mode);
  const [pending, startTransition] = useTransition();
  const [distilling, startDistill] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [distillMsg, setDistillMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function regenerate() {
    setDistillMsg(null);
    startDistill(async () => {
      const res = await regeneratePreferenceSummary();
      if (res.ok) {
        setSummary(res.summary);
        setDistillMsg({ ok: true, text: "Regenerated from your ratings ✓" });
      } else {
        setDistillMsg({ ok: false, text: res.error });
      }
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await saveSettings({
        daily_budget_usd: Number(budget),
        discovery_rounds: Number(rounds),
        discovery_target_survivors: Number(survivors),
        discovery_min_fit: Number(minFit),
        discovery_min_alignment: Number(minAlignment),
        preference_summary: summary.trim() || null,
        speed_mode: speed,
      });
      setMsg(
        res.ok
          ? { ok: true, text: "Saved." }
          : { ok: false, text: res.error },
      );
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="daily_budget_usd">Daily budget (USD)</label>
          <input
            id="daily_budget_usd"
            type="number"
            min={0}
            step={0.5}
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <span className="field-hint">Hard cap on agent spend per day.</span>
        </div>

        <div className="field">
          <label htmlFor="discovery_rounds">Discovery rounds</label>
          <input
            id="discovery_rounds"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={rounds}
            onChange={(e) => setRounds(e.target.value)}
          />
          <span className="field-hint">Debate rounds per discovery run.</span>
        </div>

        <div className="field">
          <label htmlFor="discovery_target_survivors">Target survivors</label>
          <input
            id="discovery_target_survivors"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={survivors}
            onChange={(e) => setSurvivors(e.target.value)}
          />
          <span className="field-hint">Candidates to carry past filtering.</span>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="discovery_min_fit">Minimum fit to reach the board</label>
          <input
            id="discovery_min_fit"
            type="number"
            min={1}
            max={5}
            step={1}
            inputMode="numeric"
            value={minFit}
            onChange={(e) => setMinFit(e.target.value)}
          />
          <span className="field-hint">
            1-5. Raise to 4 to keep &ldquo;maybe&rdquo; grants off the board.
          </span>
        </div>

        <div className="field">
          <label htmlFor="discovery_min_alignment">Minimum ethos alignment</label>
          <input
            id="discovery_min_alignment"
            type="number"
            min={1}
            max={5}
            step={1}
            inputMode="numeric"
            value={minAlignment}
            onChange={(e) => setMinAlignment(e.target.value)}
          />
          <span className="field-hint">
            1-5. Grants below this are cut even if the fit is high.
          </span>
        </div>
      </div>

      <div className="field">
        <span className="field-label" style={{ fontWeight: 600 }}>
          Discovery speed
        </span>
        <label className="row" style={{ gap: "var(--s2)", fontWeight: 400 }}>
          <input
            type="radio"
            name="speed_mode"
            value="thorough"
            checked={speed === "thorough"}
            onChange={() => setSpeed("thorough")}
          />
          Thorough - strongest vetting, slower and pricier
        </label>
        <label className="row" style={{ gap: "var(--s2)", fontWeight: 400 }}>
          <input
            type="radio"
            name="speed_mode"
            value="fast"
            checked={speed === "fast"}
            onChange={() => setSpeed("fast")}
          />
          Fast - quicker and cheaper, lighter fact-checking
        </label>
      </div>

      <div className="field">
        <label htmlFor="preference_summary">Preference summary</label>
        <textarea
          id="preference_summary"
          value={summary}
          placeholder="Distilled guidance for the agents - what to favor, what to avoid. Rate a few grants, then Regenerate to fill this from your ratings."
          onChange={(e) => setSummary(e.target.value)}
        />
        <div className="row" style={{ marginTop: "var(--s2)" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={regenerate}
            disabled={distilling}
          >
            {distilling ? "Regenerating…" : "Regenerate from ratings"}
          </button>
          {distillMsg ? (
            <span
              className="saved-note"
              style={{ color: distillMsg.ok ? "var(--tone-good)" : "var(--tone-bad)" }}
            >
              {distillMsg.text}
            </span>
          ) : null}
        </div>
        <span className="field-hint">
          The agents read this on every run. Regenerate distills your ratings and
          board activity into it (one cheap AI call); you can also edit it by hand.
        </span>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {msg ? (
          <span
            className={`form-msg ${msg.ok ? "form-msg-ok" : "form-msg-err"}`}
            role="status"
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
