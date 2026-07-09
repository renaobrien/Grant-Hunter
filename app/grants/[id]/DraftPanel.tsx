"use client";

import { useState, useTransition } from "react";
import { Chip, type ChipTone } from "@/components/ui";
import type { DraftRow, DraftRoundRow, DraftStatus } from "@/lib/types";
import { startDraft, saveDraftContent } from "./actions";

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

/** Editable draft body: edit + save, copy to clipboard, download as Markdown. */
function EditableDraft({ draftId, initialContent }: { draftId: string; initialContent: string }) {
  const [content, setContent] = useState(initialContent);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (pending) return;
    setNote(null);
    startTransition(async () => {
      const res = await saveDraftContent(draftId, content);
      setNote(res.ok ? "Saved ✓" : (res.error ?? "Could not save."));
      if (res.ok) setDirty(false);
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setNote("Copied to clipboard ✓");
    } catch {
      setNote("Couldn't copy - select the text and copy manually.");
    }
  }

  function download() {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `application-draft-${draftId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack" style={{ gap: "var(--s2)" }}>
      <textarea
        className="draft-edit"
        value={content}
        rows={16}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
          setNote(null);
        }}
      />
      <div className="row">
        <button type="button" className="btn btn-sm btn-primary" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save edits"}
        </button>
        <button type="button" className="btn btn-sm" onClick={copy}>
          Copy
        </button>
        <button type="button" className="btn btn-sm" onClick={download}>
          Download .md
        </button>
        {note ? <span className="saved-note">{note}</span> : null}
      </div>
    </div>
  );
}

/** The Critic's verdict on the final round, or null when never critiqued. */
function lastVerdict(draft: DraftWithRounds): Record<string, unknown> | null {
  if (!draft.roundRows.length) return null;
  const last = draft.roundRows.reduce((a, b) => (b.round > a.round ? b : a));
  return last.critic_verdict;
}

function DraftItem({ draft }: { draft: DraftWithRounds }) {
  // A 'ready' draft is only trustworthy if the Critic actually signed off on the
  // last round. The loop can also stop at the round cap unapproved, or run out
  // of budget before any critique - don't paint those green.
  const verdict = lastVerdict(draft);
  const criticApproved = verdict?.approved === true;
  const needsReview = draft.status === "ready" && !criticApproved;
  const openIssues =
    needsReview && Array.isArray(verdict?.issues)
      ? (verdict!.issues as unknown[]).filter((x): x is string => typeof x === "string")
      : [];

  return (
    <div className="draft-item">
      <div className="card-head">
        {needsReview ? (
          <Chip label="Needs review" tone="warn" />
        ) : (
          <Chip label={statusLabel(draft.status)} tone={statusTone(draft.status)} />
        )}
        <span className="muted">{draft.created_at.slice(0, 10)}</span>
      </div>

      {needsReview ? (
        <p className="saved-note" style={{ color: "var(--tone-warn)" }}>
          The Critic did not sign off on this draft. Read it before you use it.
          {openIssues.length ? " Open issues:" : ""}
        </p>
      ) : null}
      {openIssues.length ? (
        <ul className="mini-list">
          {openIssues.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : null}

      {draft.status === "error" && draft.error ? (
        <p className="saved-note" style={{ color: "var(--tone-bad)" }}>
          {draft.error}
        </p>
      ) : null}

      {draft.status === "ready" && draft.content ? (
        <EditableDraft draftId={draft.id} initialContent={draft.content} />
      ) : draft.status !== "error" ? (
        <p className="muted">
          {draft.status === "ready"
            ? "Draft completed but no content was returned."
            : "Drafting - this page updates as the Drafter and Critic finish each round."}
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
      const res = await startDraft(grantId);
      if (res.ok) setRequested(true);
      else setError(res.error ?? "Could not start a draft.");
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
          {pending ? "Starting…" : "Draft application"}
        </button>
        {queued ? (
          <span className="muted">
            Drafting started - refresh in a minute to see it (or ~30 min on a
            hosted instance that drains the queue on a schedule).
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
