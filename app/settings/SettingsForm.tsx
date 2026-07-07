"use client";

import { useState, useTransition, type FormEvent } from "react";
import { saveSettings } from "./actions";

export interface SettingsFormInitial {
  daily_budget_usd: number;
  discovery_rounds: number;
  discovery_target_survivors: number;
  preference_summary: string;
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
  const [summary, setSummary] = useState(initial.preference_summary);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await saveSettings({
        daily_budget_usd: Number(budget),
        discovery_rounds: Number(rounds),
        discovery_target_survivors: Number(survivors),
        preference_summary: summary.trim() || null,
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

      <div className="field">
        <label htmlFor="preference_summary">Preference summary</label>
        <textarea
          id="preference_summary"
          value={summary}
          placeholder="Distilled guidance for the agents — what to favor, what to avoid."
          onChange={(e) => setSummary(e.target.value)}
        />
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
