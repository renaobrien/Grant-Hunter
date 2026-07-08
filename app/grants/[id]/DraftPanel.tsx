"use client";

import { useState, useTransition } from "react";
import { Chip, type ChipTone } from "@/components/ui";
import type { DraftRow, DraftRoundRow, DraftStatus } from "@/lib/types";
import { requestDraft } from "./actions";

/** A draft joined with its Drafter/Critic transcript rows. */
export type DraftWithRounds = DraftRow & { roundRows: DraftRoundRow[] };

function statusTone(s: DraftStatus): ChipTone {
  return s === "ready" ? "good" : s === "error" ? "bad" : s === "running" ? "info" : "warn";
}
function statusLabel(s: DraftStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CriticVerdictView({ v }: { v: Record<string, unknown> | null }) {
  if (!v) return null;
  const approved = v.approved === true;
  const issues = Array.isArray(v.issues)
    ? v.issues.filter((x): x is string => typeof x === "string")
    : [];
  const suggestions = Array.isArray(v.suggestions)
    ? v.suggestions.filter((x): x is string => typeof x === "string")
    : [];
  return (
    <div>
      <Chip label={approved ? "approved" : "revise"} tone={approved ? "good" : "warn"} />
      {issues.length > 0 ? (
        <>
          <div className="dr-role" style={{ marginTop: "var(--s2)" }}>
            Issues
          </div>
          <ul className="mini-list">
            {issues.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      ) : null}
      {suggestions.length > 0 ? (
        <>
          <div className="dr-role" style={{ marginTop: "var(--s2)" }}>
            Suggestions
          </div>
          <ul className="mini-list">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function DraftItem({ draft }: { draft: DraftWithRounds }) {
  return (
    <div className="draft-item">
      <div className="card-head">
        <Chip label={statusLabel(draft.status)} tone={statusTone(draft.status)} />
        <span className="muted">{draft.created_at.slice(0, 10)}</span>
      </div>

      {draft.status === "error" && draft.error ? (
        <p className="saved-note" style={{ color: "var(--tone-bad)" }}>
          {draft.error}
        </p>
      ) : null}

      {draft.status === "ready" && draft.content ? (
        <div className="prose draft-body">{draft.content}</div>
      ) : draft.status !== "error" ? (
        <p className="muted">
          {draft.status === "ready"
            ? "Draft completed but no content was returned."
            : "Generating - a draft is produced within ~30 min by the jobs worker."}
        </p>
      ) : null}

      {draft.roundRows.length > 0 ? (
        <details className="transcript">
          <summary>
            Critique transcript ({draft.roundRows.length} round
            {draft.roundRows.length === 1 ? "" : "s"})
          </summary>
          {draft.roundRows.map((r) => (
            <div key={r.id} className="rating-item">
              <div className="dr-role">Round {r.round}</div>
              <CriticVerdictView v={r.critic_verdict} />
              {r.draft_text ? (
                <details style={{ marginTop: "var(--s2)" }}>
                  <summary className="muted">View draft text</summary>
                  <div className="prose draft-body">{r.draft_text}</div>
                </details>
              ) : null}
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}

export default function DraftPanel({
  grantId,
  drafts,
}: {
  grantId: string;
  drafts: DraftWithRounds[];
}) {
  const hasActive = drafts.some(
    (d) => d.status === "queued" || d.status === "running",
  );
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const queued = hasActive || requested;

  function onDraft() {
    setError(null);
    startTransition(async () => {
      const res = await requestDraft(grantId);
      if (res.ok) setRequested(true);
      else setError(res.error ?? "Could not queue a draft.");
    });
  }

  return (
    <div className="stack">
      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onDraft}
          disabled={queued || pending}
        >
          {pending ? "Queuing…" : "Draft application"}
        </button>
        {queued ? (
          <span className="muted">
            Queued - a draft is generated within ~30 min by the jobs worker.
          </span>
        ) : null}
        {error ? (
          <span className="saved-note" style={{ color: "var(--tone-bad)" }}>
            {error}
          </span>
        ) : null}
      </div>

      {drafts.length === 0 ? (
        <p className="muted">
          No drafts yet. Queue one to generate a funder-framed narrative.
        </p>
      ) : (
        <div>
          {drafts.map((d) => (
            <DraftItem key={d.id} draft={d} />
          ))}
        </div>
      )}
    </div>
  );
}
