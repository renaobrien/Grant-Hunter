import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  Chip,
  StatusChip,
  ScorePips,
  FieldRow,
  EmptyState,
  type ChipTone,
} from "@/components/ui";
import type {
  GrantRow,
  DebateRow,
  GrantRatingRow,
  DraftRow,
  DraftRoundRow,
} from "@/lib/types";
import RatingForm from "./RatingForm";
import HumanNotes from "./HumanNotes";
import DraftPanel, { type DraftWithRounds } from "./DraftPanel";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// small server-side render helpers for the debate transcript
// ---------------------------------------------------------------------------

/** Coerce an unknown JSON value into displayable text, or null when empty. */
function text(v: unknown): string | null {
  if (typeof v === "string") return v.trim() ? v : null;
  if (typeof v === "number") return String(v);
  return null;
}

function recTone(r: string | null | undefined): ChipTone {
  return r === "pursue" ? "good" : r === "maybe" ? "warn" : r === "pass" ? "bad" : "neutral";
}

/** A field row that renders nothing when the value is empty. */
function DField({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return <FieldRow label={label}>{value}</FieldRow>;
}

/** Dump any keys we did NOT explicitly render, so nothing is silently hidden. */
function RestJson({
  obj,
  known,
}: {
  obj: Record<string, unknown>;
  known: string[];
}) {
  const rest: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (known.includes(k)) continue;
    if (val === null || val === undefined || val === "") continue;
    rest[k] = val;
  }
  if (Object.keys(rest).length === 0) return null;
  return <pre>{JSON.stringify(rest, null, 2)}</pre>;
}

const FINDER_KEYS = [
  "funder",
  "program_name",
  "amount",
  "deadline",
  "fit_score",
  "framing_angle",
  "eligibility_notes",
  "blockers",
  "notes",
  "source_url",
  "application_url",
];

function FinderBlock({ c }: { c: Record<string, unknown> }) {
  const fit = typeof c.fit_score === "number" ? c.fit_score : null;
  return (
    <div className="dr-col">
      <div className="dr-role">Finder claim</div>
      <DField label="Fit score" value={fit != null ? <ScorePips score={fit} /> : null} />
      <DField label="Framing angle" value={text(c.framing_angle)} />
      <DField label="Amount" value={text(c.amount)} />
      <DField label="Deadline" value={text(c.deadline)} />
      <DField
        label="Eligibility"
        value={text(c.eligibility_notes) ? <span className="prose">{text(c.eligibility_notes)}</span> : null}
      />
      <DField
        label="Blockers"
        value={text(c.blockers) ? <span className="prose">{text(c.blockers)}</span> : null}
      />
      <DField
        label="Notes"
        value={text(c.notes) ? <span className="prose">{text(c.notes)}</span> : null}
      />
      <RestJson obj={c} known={FINDER_KEYS} />
    </div>
  );
}

const SKEPTIC_KEYS = ["verdict", "kill_shot", "eligibility_ok", "deadline_ok"];

function SkepticBlock({ s }: { s: Record<string, unknown> }) {
  const verdict = text(s.verdict);
  const vTone: ChipTone =
    verdict === "survives" ? "good" : verdict === "refuted" ? "bad" : "warn";
  const kill = text(s.kill_shot);
  return (
    <div className="dr-col">
      <div className="dr-role">Skeptic verdict</div>
      <div className="row" style={{ marginBottom: "var(--s2)" }}>
        {verdict ? <Chip label={verdict} tone={vTone} /> : null}
        {typeof s.eligibility_ok === "boolean" ? (
          <Chip
            label={`eligibility ${s.eligibility_ok ? "ok" : "fail"}`}
            tone={s.eligibility_ok ? "good" : "bad"}
          />
        ) : null}
        {typeof s.deadline_ok === "boolean" ? (
          <Chip
            label={`deadline ${s.deadline_ok ? "ok" : "fail"}`}
            tone={s.deadline_ok ? "good" : "bad"}
          />
        ) : null}
      </div>
      {kill ? <p className="prose">{kill}</p> : null}
      <RestJson obj={s} known={SKEPTIC_KEYS} />
    </div>
  );
}

const JUDGE_KEYS = [
  "survives",
  "funder",
  "program_name",
  "amount",
  "deadline",
  "fit_score",
  "recommendation",
  "confidence",
  "alignment_score",
  "alignment_rationale",
  "framing_angle",
  "eligibility_notes",
  "blockers",
  "notes",
  "source_url",
  "application_url",
];

function JudgeBlock({ j }: { j: Record<string, unknown> }) {
  const survives = j.survives === true;
  const rec = text(j.recommendation);
  const conf = text(j.confidence);
  const align = typeof j.alignment_score === "number" ? j.alignment_score : null;
  const fit = typeof j.fit_score === "number" ? j.fit_score : null;
  return (
    <div className="dr-col">
      <div className="dr-role">Judge ruling</div>
      <div className="row" style={{ marginBottom: "var(--s2)" }}>
        <Chip label={survives ? "survives" : "cut"} tone={survives ? "good" : "bad"} />
        {rec ? <Chip label={rec} tone={recTone(rec)} /> : null}
        {conf ? <Chip label={`confidence: ${conf}`} tone="neutral" /> : null}
      </div>
      <DField label="Alignment" value={align != null ? <ScorePips score={align} /> : null} />
      <DField
        label="Alignment rationale"
        value={text(j.alignment_rationale) ? <span className="prose">{text(j.alignment_rationale)}</span> : null}
      />
      <DField label="Fit score" value={fit != null ? <ScorePips score={fit} /> : null} />
      <DField label="Framing angle" value={text(j.framing_angle)} />
      <DField
        label="Eligibility"
        value={text(j.eligibility_notes) ? <span className="prose">{text(j.eligibility_notes)}</span> : null}
      />
      <DField
        label="Blockers"
        value={text(j.blockers) ? <span className="prose">{text(j.blockers)}</span> : null}
      />
      <DField
        label="Notes"
        value={text(j.notes) ? <span className="prose">{text(j.notes)}</span> : null}
      />
      <RestJson obj={j} known={JUDGE_KEYS} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------
export default async function GrantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: grantData } = await supabase
    .from("grants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const grant = grantData as GrantRow | null;
  if (!grant) notFound();

  // Candidate keys the debate rows could be filed under (see engine/discovery.ts).
  const candidateKeys = Array.from(
    new Set(
      [
        grant.application_url,
        grant.source_url,
        `${grant.funder}::${grant.program_name ?? ""}`,
      ].filter((k): k is string => !!k && k.trim().length > 0),
    ),
  );

  const [debateRes, ratingsRes, draftsRes] = await Promise.all([
    candidateKeys.length
      ? supabase
          .from("agent_debate")
          .select("*")
          .in("candidate_key", candidateKeys)
          .order("round", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as DebateRow[] }),
    supabase
      .from("grant_ratings")
      .select("*")
      .eq("grant_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("drafts")
      .select("*")
      .eq("grant_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const debateRows = (debateRes.data ?? []) as DebateRow[];
  const ratings = (ratingsRes.data ?? []) as GrantRatingRow[];
  const draftRows = (draftsRes.data ?? []) as DraftRow[];

  const draftIds = draftRows.map((d) => d.id);
  const roundsRes = draftIds.length
    ? await supabase
        .from("draft_rounds")
        .select("*")
        .in("draft_id", draftIds)
        .order("round", { ascending: true })
    : { data: [] as DraftRoundRow[] };
  const roundRows = (roundsRes.data ?? []) as DraftRoundRow[];

  const draftsWithRounds: DraftWithRounds[] = draftRows.map((d) => ({
    ...d,
    roundRows: roundRows.filter((r) => r.draft_id === d.id),
  }));

  const title = grant.program_name
    ? `${grant.funder} - ${grant.program_name}`
    : grant.funder;

  return (
    <>
      <div className="page-head">
        <div className="detail-title">
          <h1>{title}</h1>
          <div className="row">
            <StatusChip status={grant.status} />
            {grant.amount ? <span className="gc-amount">{grant.amount}</span> : null}
            {grant.deadline ? (
              <Chip label={`Deadline: ${grant.deadline}`} tone="neutral" />
            ) : null}
          </div>
        </div>
        <Link href="/" className="btn btn-sm">
          ← Board
        </Link>
      </div>

      <div className="stack">
        {/* Ethos alignment - the trust anchor, kept at the top */}
        <Card className="card-ethos">
          <div className="card-head">
            <h2>Ethos alignment</h2>
            <span className="row">
              <ScorePips score={grant.alignment_score} />
              <strong>{grant.alignment_score ?? "-"} / 5</strong>
            </span>
          </div>
          {grant.alignment_rationale ? (
            <p className="prose">{grant.alignment_rationale}</p>
          ) : (
            <p className="muted">No alignment rationale recorded yet.</p>
          )}
        </Card>

        {/* Assessment */}
        <Card>
          <h2 className="section-head">Assessment</h2>
          <DField
            label="Recommendation"
            value={
              grant.recommendation ? (
                <Chip label={grant.recommendation} tone={recTone(grant.recommendation)} />
              ) : null
            }
          />
          <DField label="Confidence" value={grant.confidence} />
          <DField
            label="Fit score"
            value={grant.fit_score != null ? <ScorePips score={grant.fit_score} /> : null}
          />
          <DField label="Framing angle" value={grant.framing_angle} />
          <DField
            label="Eligibility"
            value={
              grant.eligibility_notes ? (
                <span className="prose">{grant.eligibility_notes}</span>
              ) : null
            }
          />
          <DField
            label="Blockers"
            value={grant.blockers ? <span className="prose">{grant.blockers}</span> : null}
          />
          <DField
            label="Notes"
            value={grant.notes ? <span className="prose">{grant.notes}</span> : null}
          />
          <DField
            label="Contacts"
            value={grant.contacts ? <span className="prose">{grant.contacts}</span> : null}
          />
          <DField
            label="Source"
            value={
              grant.source_url ? (
                <a href={grant.source_url} target="_blank" rel="noreferrer">
                  {grant.source_url}
                </a>
              ) : null
            }
          />
          <DField
            label="Application"
            value={
              grant.application_url ? (
                <a href={grant.application_url} target="_blank" rel="noreferrer">
                  {grant.application_url}
                </a>
              ) : null
            }
          />
        </Card>

        {/* Adjudication debate */}
        <section>
          <h2 className="section-head">Adjudication debate</h2>
          {debateRows.length === 0 ? (
            <Card>
              <EmptyState
                title="No debate transcript"
                hint="This grant predates the Finder → Skeptic → Judge pipeline, or was added manually."
              />
            </Card>
          ) : (
            debateRows.map((d) => {
              const judge = d.judge_ruling as Record<string, unknown> | null;
              const survives = judge?.survives === true;
              return (
                <details key={d.id} className="debate-round">
                  <summary className="dr-head">
                    <span>Round {d.round}</span>
                    {judge ? (
                      <Chip
                        label={survives ? "survived" : "cut"}
                        tone={survives ? "good" : "bad"}
                      />
                    ) : null}
                  </summary>
                  {d.finder_claim ? (
                    <FinderBlock c={d.finder_claim as Record<string, unknown>} />
                  ) : null}
                  {d.skeptic_verdict ? (
                    <SkepticBlock s={d.skeptic_verdict as Record<string, unknown>} />
                  ) : null}
                  {judge ? <JudgeBlock j={judge} /> : null}
                </details>
              );
            })
          )}
        </section>

        {/* Human rating */}
        <Card>
          <h2 className="section-head">Your rating</h2>
          <RatingForm
            grantId={grant.id}
            initialScore={grant.human_score}
            initialReason={grant.rejection_reason}
          />
          {ratings.length > 0 ? (
            <div className="transcript">
              <h3>History</h3>
              {ratings.map((r) => (
                <div key={r.id} className="rating-item">
                  <div className="row">
                    <ScorePips score={r.score} />
                    {r.rejection_reason ? (
                      <Chip label={r.rejection_reason} tone="muted" />
                    ) : null}
                    <span className="muted">
                      {r.rated_by ?? "unknown"} · {r.created_at.slice(0, 10)}
                    </span>
                  </div>
                  {r.feedback ? <p className="prose">{r.feedback}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        {/* Operator notes */}
        <Card>
          <h2 className="section-head">Notes</h2>
          <HumanNotes grantId={grant.id} initialNotes={grant.human_notes} />
        </Card>

        {/* Drafts */}
        <Card>
          <h2 className="section-head">Application drafts</h2>
          <DraftPanel grantId={grant.id} drafts={draftsWithRounds} />
        </Card>
      </div>
    </>
  );
}
