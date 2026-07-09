// /demo - a read-only preview of the board with built-in sample data, so a new
// user can see what the product does BEFORE connecting a database. Renders no DB
// calls and writes nothing; excluded from the middleware matcher so it works on
// a fresh, unconfigured instance. White-label / org-neutral sample content.
import Link from "next/link";
import { Chip, ScorePips, type ChipTone } from "@/components/ui";
import { STATUS_COLUMNS, type GrantStatus, type Recommendation } from "@/lib/types";

export const dynamic = "force-static";

interface DemoGrant {
  id: string;
  funder: string;
  program_name: string;
  amount: string;
  deadline: string;
  fit_score: number;
  alignment_score: number;
  recommendation: Recommendation;
  status: GrantStatus;
}

// Fictional, org-neutral sample grants (not tied to any real funder or org).
const SAMPLE: DemoGrant[] = [
  { id: "d1", funder: "Open Technology Fund", program_name: "Core Infrastructure", amount: "$50K-$150K", deadline: "2026-09-30", fit_score: 5, alignment_score: 5, recommendation: "pursue", status: "found" },
  { id: "d2", funder: "Climate Innovation Trust", program_name: "Community Resilience", amount: "$25K", deadline: "rolling", fit_score: 4, alignment_score: 4, recommendation: "pursue", status: "found" },
  { id: "d3", funder: "Regional Arts Council", program_name: "Public Works Grant", amount: "$10K-$20K", deadline: "2026-08-15", fit_score: 3, alignment_score: 4, recommendation: "maybe", status: "drafting" },
  { id: "d4", funder: "National Science Foundation", program_name: "Small Business R&D", amount: "$100K", deadline: "2026-07-01", fit_score: 4, alignment_score: 3, recommendation: "pursue", status: "submitted" },
  { id: "d5", funder: "Legacy Family Foundation", program_name: "General Operating", amount: "$40K", deadline: "2026-06-01", fit_score: 4, alignment_score: 5, recommendation: "pursue", status: "awarded" },
];

const REC_TONE: Record<Recommendation, ChipTone> = { pursue: "good", maybe: "warn", pass: "muted" };
const REC_LABEL: Record<Recommendation, string> = { pursue: "Pursue", maybe: "Maybe", pass: "Pass" };

function formatDeadline(d: string): string {
  return d === "rolling" ? "Rolling" : d;
}

export default function DemoBoardPage() {
  const byStatus = new Map<GrantStatus, DemoGrant[]>();
  for (const g of SAMPLE) {
    const list = byStatus.get(g.status);
    if (list) list.push(g);
    else byStatus.set(g.status, [g]);
  }

  return (
    <div className="stack" style={{ maxWidth: 1100, margin: "24px auto", padding: "0 var(--s3)" }}>
      <div
        className="attention-strip"
        style={{ justifyContent: "space-between" }}
      >
        <span>
          <strong>This is sample data.</strong>{" "}
          <span className="muted">
            Connect your own database and fill in your org profile to make it yours.
          </span>
        </span>
        <Link className="btn btn-sm btn-primary" href="/connect">
          Connect your database →
        </Link>
      </div>

      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">{SAMPLE.length} sample grants across the board</p>
        </div>
      </div>

      <div className="board">
        {STATUS_COLUMNS.map((col) => {
          const items = col.statuses.flatMap((s) => byStatus.get(s) ?? []);
          return (
            <section key={col.key} className="board-col">
              <header className="board-col-head">
                <span className="col-title">{col.label}</span>
                <span className="col-count">{items.length}</span>
              </header>
              <div className="board-col-body">
                {items.map((g) => (
                  <div key={g.id} className="grant-card" style={{ cursor: "default" }}>
                    <div className="gc-funder">{g.funder}</div>
                    <div className="gc-program">{g.program_name}</div>
                    <div className="gc-meta">
                      <span className="gc-amount">{g.amount}</span>
                      <span>{formatDeadline(g.deadline)}</span>
                    </div>
                    <div className="gc-meta">
                      <span className="gc-scores">
                        <span className="gc-score-label">Fit</span>
                        <ScorePips score={g.fit_score} />
                      </span>
                      <span className="gc-scores">
                        <span className="gc-score-label">Align</span>
                        <ScorePips score={g.alignment_score} />
                      </span>
                      <Chip label={REC_LABEL[g.recommendation]} tone={REC_TONE[g.recommendation]} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
