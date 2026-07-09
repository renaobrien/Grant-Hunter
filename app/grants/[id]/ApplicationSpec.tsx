"use client";

// The funder's actual application requirements. Paste-first: drop the real
// questions/limits here and the Drafter answers them (and the Critic checks
// coverage) instead of writing a generic essay. Optional: pull them from the
// application URL with one AI call, then review/edit before saving.
import { useState, useTransition } from "react";
import { saveApplicationSpec, extractApplicationSpec } from "./actions";

export default function ApplicationSpec({
  grantId,
  initialSpec,
  hasUrl,
}: {
  grantId: string;
  initialSpec: string | null;
  hasUrl: boolean;
}) {
  const [spec, setSpec] = useState(initialSpec ?? "");
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (pending) return;
    setMsg(null);
    startTransition(async () => {
      const res = await saveApplicationSpec(grantId, spec);
      if (res.ok) {
        setSaved(true);
      } else {
        setMsg({ ok: false, text: res.error ?? "Could not save." });
      }
    });
  }

  function pull() {
    if (pending) return;
    setMsg(null);
    startTransition(async () => {
      const res = await extractApplicationSpec(grantId);
      if (res.ok) {
        setSpec(res.spec);
        setSaved(true);
        setMsg({ ok: true, text: "Pulled from the URL - review and edit, then save any changes." });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="stack">
      <p className="muted" style={{ marginTop: 0 }}>
        Paste the funder&rsquo;s real application questions and limits here. The
        Drafter answers these directly; the Critic checks the draft against them.
      </p>
      <div className="field">
        <label htmlFor="application-spec">Application requirements</label>
        <textarea
          id="application-spec"
          value={spec}
          rows={8}
          placeholder={
            "e.g.\nQUESTIONS:\n- Describe the problem you address (250 words)\n- Your proposed activities and timeline (500 words)\nLIMITS:\n- 2 pages max\nREQUIRED: budget, one letter of support"
          }
          onChange={(e) => {
            setSpec(e.target.value);
            setSaved(false);
          }}
          disabled={pending}
        />
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Working…" : "Save requirements"}
        </button>
        {hasUrl ? (
          <button type="button" className="btn" onClick={pull} disabled={pending}>
            {pending ? "Reading…" : "Pull from application URL"}
          </button>
        ) : null}
        {saved && !msg ? <span className="saved-note">Saved ✓</span> : null}
        {msg ? (
          <span
            className="saved-note"
            style={{ color: msg.ok ? "var(--tone-good)" : "var(--tone-bad)" }}
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
