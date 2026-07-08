/* Grants App UI kit — screens.
   Recreates the real product surfaces (app/page.tsx, app/grants/[id]/page.tsx,
   app/runs/page.tsx) using the design-system primitives + globals.css classes.
   Org-neutral sample data — nothing here is tied to any organization. */

const { Card, Chip, StatusChip, ScorePips, EmptyState, FieldRow, Button } =
  window.GrantsPlatformDesignSystem_a27f23;

// ---- board layout: status -> column (lib/types.ts STATUS_COLUMNS) ----
const STATUS_COLUMNS = [
  { key: "searched", label: "Searched", statuses: ["found"] },
  { key: "active", label: "Active", statuses: ["researching", "drafting"] },
  { key: "pending", label: "Pending", statuses: ["applied", "submitted"] },
  { key: "closed", label: "Closed", statuses: ["awarded", "passed", "discarded", "dead"] },
];
const GRANT_STATUSES = ["found","researching","drafting","applied","submitted","awarded","passed","discarded","dead"];
const STATUS_LABELS = { found:"Found", researching:"Researching", drafting:"Drafting", applied:"Applied", submitted:"Submitted", awarded:"Awarded", passed:"Passed", discarded:"Discarded", dead:"Dead" };
const REC_TONE = { pursue: "good", maybe: "warn", pass: "muted" };
const REC_LABEL = { pursue: "Pursue", maybe: "Maybe", pass: "Pass" };

// ---- sample grants (org-neutral) ----
const GRANTS = [
  { id:"g1", funder:"Open Horizon Foundation", program_name:"Emerging Technology Fund", amount:"$150,000", deadline:"2026-03-01", fit_score:5, alignment_score:4, recommendation:"pursue", status:"found",
    alignment_rationale:"Directly funds applied research in the program area with an explicit preference for small, independent teams — a strong structural match for our mandate.",
    framing_angle:"Lead with the field-building angle; this funder rewards ecosystem effects over single-project outputs.",
    eligibility_notes:"Open to registered non-profits and fiscally-sponsored projects. No geographic restriction.",
    confidence:"high", source_url:"https://example.org/fund", application_url:"https://example.org/apply" },
  { id:"g2", funder:"Meridian Trust", program_name:"Public Interest Research", amount:"$75,000", deadline:"rolling", fit_score:4, alignment_score:4, recommendation:"pursue", status:"researching",
    alignment_rationale:"Rolling deadline and mission overlap make this a low-risk pursue; prior grantees resemble our profile.",
    framing_angle:"Emphasize measurable public-interest outcomes in year one.",
    eligibility_notes:"US-based organizations only.", confidence:"medium", source_url:"https://example.org/meridian" },
  { id:"g3", funder:"Lattice Science Initiative", program_name:"Trustworthy Systems RFP", amount:"$300,000", deadline:"2026-05-15", fit_score:4, alignment_score:3, recommendation:"maybe", status:"drafting",
    alignment_rationale:"Scope is adjacent; the alignment case is real but requires framing to fit the RFP's stated priorities.",
    framing_angle:"Position our work as the evaluation layer their portfolio is missing.",
    eligibility_notes:"Requires a named PI with relevant publications.", confidence:"medium", source_url:"https://example.org/lattice" },
  { id:"g4", funder:"Cedar & Vale Fund", program_name:"Capacity Grants", amount:"$40,000", deadline:"2026-02-10", fit_score:3, alignment_score:3, recommendation:"maybe", status:"applied",
    alignment_rationale:"General operating support — useful but not mission-defining.", framing_angle:"Frame as runway to de-risk the larger program bets.", confidence:"medium" },
  { id:"g5", funder:"Northwind Philanthropies", program_name:"Annual Open Call", amount:"$120,000", deadline:"2026-01-31", fit_score:4, alignment_score:4, recommendation:"pursue", status:"submitted",
    alignment_rationale:"Submitted; strong fit, awaiting review.", confidence:"high" },
  { id:"g6", funder:"The Aster Foundation", program_name:"Innovation Prize", amount:"$250,000", deadline:"2025-11-01", fit_score:5, alignment_score:5, recommendation:"pursue", status:"awarded",
    alignment_rationale:"Awarded — our clearest alignment win to date.", confidence:"high" },
  { id:"g7", funder:"Granite Community Fund", program_name:"Local Grants", amount:"$15,000", deadline:"unknown", fit_score:2, alignment_score:2, recommendation:"pass", status:"passed",
    alignment_rationale:"Geographic scope excludes most of our work.", confidence:"high" },
  { id:"g8", funder:"Pinnacle Ventures Grant", program_name:"Seed Awards", amount:"$50,000", deadline:"2025-09-15", fit_score:1, alignment_score:1, recommendation:"pass", status:"dead",
    alignment_rationale:"Invite-only and now closed.", confidence:"high" },
];

function formatDeadline(d) {
  if (!d || d === "unknown") return "No deadline";
  if (d === "rolling") return "Rolling";
  return d;
}

// ---------------------------------------------------------------------------
// Chrome: nav + health bar
// ---------------------------------------------------------------------------
function Nav({ view, onNav }) {
  const links = [["board","Board"],["runs","Runs"],["profile","Profile"],["settings","Settings"]];
  return (
    <nav className="app-nav">
      <a className="brand" href="#" onClick={(e)=>{e.preventDefault();onNav("board");}}>
        <span className="brand-dot" aria-hidden="true"></span>
        <span>Grants</span>
      </a>
      <div className="nav-links">
        {links.map(([k,label]) => (
          <a key={k} href="#" onClick={(e)=>{e.preventDefault();onNav(k);}}
             style={k===view ? {color:"var(--brand-primary)"} : undefined}>{label}</a>
        ))}
      </div>
    </nav>
  );
}

function HealthBar() {
  return (
    <div className="health-bar">
      <span><strong>Last run:</strong> 2h ago</span>
      <span className="health-sep">·</span>
      <span><strong>Today:</strong> $1.20 / $5.00</span>
      <span className="health-sep">·</span>
      <span><strong>{GRANTS.length}</strong> grants tracked</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------
function StatusSelect({ value, onChange }) {
  return (
    <select className="status-select" value={value}
      onClick={(e)=>e.stopPropagation()}
      onChange={(e)=>{e.stopPropagation();onChange(e.target.value);}} aria-label="Grant status">
      {GRANT_STATUSES.map((s)=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
    </select>
  );
}

function GrantCard({ g, onOpen, onStatus }) {
  return (
    <a className="grant-card" href="#" onClick={(e)=>{e.preventDefault();onOpen(g.id);}}>
      <div className="gc-funder">{g.funder}</div>
      {g.program_name ? <div className="gc-program">{g.program_name}</div> : null}
      <div className="gc-meta">
        {g.amount ? <span className="gc-amount">{g.amount}</span> : null}
        <span>{formatDeadline(g.deadline)}</span>
      </div>
      <div className="gc-meta">
        <span className="gc-scores"><span className="gc-score-label">Fit</span><ScorePips score={g.fit_score} /></span>
        <span className="gc-scores"><span className="gc-score-label">Align</span><ScorePips score={g.alignment_score} /></span>
        {g.recommendation ? <Chip label={REC_LABEL[g.recommendation]} tone={REC_TONE[g.recommendation]} /> : null}
      </div>
      <div className="gc-meta gc-status-row">
        <StatusSelect value={g.status} onChange={(s)=>onStatus(g.id, s)} />
      </div>
    </a>
  );
}

function BoardScreen({ grants, onOpen, onStatus }) {
  const byStatus = {};
  for (const g of grants) (byStatus[g.status] ||= []).push(g);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">{grants.length} grants across the board</p>
        </div>
      </div>
      <div className="board">
        {STATUS_COLUMNS.map((col) => {
          const items = col.statuses.flatMap((s)=>byStatus[s] ?? []);
          return (
            <section key={col.key} className="board-col">
              <header className="board-col-head">
                <span className="col-title">{col.label}</span>
                <span className="col-count">{items.length}</span>
              </header>
              <div className="board-col-body">
                {items.length === 0
                  ? <EmptyState title="Nothing here yet" hint="Grants land here as they move through the pipeline." />
                  : items.map((g)=><GrantCard key={g.id} g={g} onOpen={onOpen} onStatus={onStatus} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grant detail
// ---------------------------------------------------------------------------
function DField({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return <FieldRow label={label}>{value}</FieldRow>;
}

function DetailScreen({ g, onBack }) {
  const [score, setScore] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const title = g.program_name ? `${g.funder} — ${g.program_name}` : g.funder;
  return (
    <>
      <div className="page-head">
        <div className="detail-title">
          <h1>{title}</h1>
          <div className="row">
            <StatusChip status={g.status} />
            {g.amount ? <span className="gc-amount">{g.amount}</span> : null}
            {g.deadline ? <Chip label={`Deadline: ${formatDeadline(g.deadline)}`} tone="neutral" /> : null}
          </div>
        </div>
        <Button size="sm" href="#" onClick={(e)=>{e.preventDefault();onBack();}}>← Board</Button>
      </div>

      <div className="stack">
        <Card className="card-ethos">
          <div className="card-head">
            <h2>Ethos alignment</h2>
            <span className="row"><ScorePips score={g.alignment_score} /><strong>{g.alignment_score ?? "—"} / 5</strong></span>
          </div>
          {g.alignment_rationale
            ? <p className="prose">{g.alignment_rationale}</p>
            : <p className="muted">No alignment rationale recorded yet.</p>}
        </Card>

        <Card>
          <h2 className="section-head">Assessment</h2>
          <DField label="Recommendation" value={g.recommendation ? <Chip label={g.recommendation} tone={REC_TONE[g.recommendation]} /> : null} />
          <DField label="Confidence" value={g.confidence} />
          <DField label="Fit score" value={g.fit_score != null ? <ScorePips score={g.fit_score} /> : null} />
          <DField label="Framing angle" value={g.framing_angle} />
          <DField label="Eligibility" value={g.eligibility_notes ? <span className="prose">{g.eligibility_notes}</span> : null} />
          <DField label="Source" value={g.source_url ? <a href={g.source_url} target="_blank" rel="noreferrer">{g.source_url}</a> : null} />
          <DField label="Application" value={g.application_url ? <a href={g.application_url} target="_blank" rel="noreferrer">{g.application_url}</a> : null} />
        </Card>

        <section>
          <h2 className="section-head">Adjudication debate</h2>
          <details className="debate-round">
            <summary className="dr-head"><span>Round 1</span><Chip label="survived" tone="good" /></summary>
            <div className="dr-col">
              <div className="dr-role">Finder claim</div>
              <DField label="Fit score" value={<ScorePips score={g.fit_score} />} />
              <DField label="Framing angle" value={g.framing_angle} />
            </div>
            <div className="dr-col">
              <div className="dr-role">Skeptic verdict</div>
              <div className="row" style={{marginBottom:"var(--s2)"}}>
                <Chip label="survives" tone="good" />
                <Chip label="eligibility ok" tone="good" />
                <Chip label="deadline ok" tone="good" />
              </div>
              <p className="prose">No disqualifying eligibility or timing issue found; the fit claim holds up against the live program page.</p>
            </div>
            <div className="dr-col">
              <div className="dr-role">Judge ruling</div>
              <div className="row" style={{marginBottom:"var(--s2)"}}>
                <Chip label="survives" tone="good" />
                <Chip label={g.recommendation} tone={REC_TONE[g.recommendation]} />
                <Chip label={`confidence: ${g.confidence}`} tone="neutral" />
              </div>
              <DField label="Alignment" value={<ScorePips score={g.alignment_score} />} />
              <DField label="Alignment rationale" value={<span className="prose">{g.alignment_rationale}</span>} />
            </div>
          </details>
        </section>

        <Card>
          <h2 className="section-head">Your rating</h2>
          <div className="stack">
            <div className="field">
              <label>Score</label>
              <div className="row" role="group" aria-label="Rate this grant from 1 to 5">
                {[1,2,3,4,5].map((n)=>(
                  <button key={n} type="button" className={`btn btn-sm${score===n?" btn-primary":""}`}
                    aria-pressed={score===n} onClick={()=>{setScore(n);setSaved(false);}}>{n}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="why">Why? (optional)</label>
              <textarea id="why" placeholder="What made this a strong or weak fit? This teaches the scoring."></textarea>
            </div>
            <div className="row">
              <Button variant="primary" onClick={()=>setSaved(true)} disabled={score==null}>Save rating</Button>
              {saved ? <span className="saved-note">Saved ✓</span> : null}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="section-head">Notes</h2>
          <div className="field" style={{marginBottom:0}}>
            <label htmlFor="notes">Operator notes</label>
            <textarea id="notes" placeholder="Context, contacts, next steps — human-owned, never touched by the engine."></textarea>
          </div>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------
const RUNS = [
  { id:"r1", agent:"discovery", trigger:"scheduled", status:"success", started:"Jul 7, 2026, 12:04 PM UTC", duration:"48.2s", tokens:184203, cost:"$1.20", error:null },
  { id:"r2", agent:"draft", trigger:"manual", status:"success", started:"Jul 6, 2026, 3:11 PM UTC", duration:"22.6s", tokens:61240, cost:"$0.44", error:null },
  { id:"r3", agent:"deadline-sweep", trigger:"scheduled", status:"success", started:"Jul 6, 2026, 12:00 PM UTC", duration:"1.8s", tokens:0, cost:"$0.00", error:null },
  { id:"r4", agent:"discovery", trigger:"scheduled", status:"error", started:"Jun 30, 2026, 12:03 PM UTC", duration:"12.4s", tokens:24010, cost:"$0.18", error:"Web search rate-limited after 3 retries; run aborted before judging." },
  { id:"r5", agent:"draft", trigger:"webhook", status:"running", started:"Jul 7, 2026, 12:31 PM UTC", duration:"—", tokens:null, cost:"—", error:null },
];
const RUN_TONE = { running:"info", success:"good", error:"bad" };
const RUN_LABEL = { running:"Running", success:"Success", error:"Error" };

function RunsScreen() {
  return (
    <div className="stack">
      <div className="page-head"><h1>Runs</h1></div>
      <Card className="note-panel">
        <h3>Run discovery now</h3>
        <p>Discovery runs automatically on a weekly schedule. To trigger a run by hand, open the repo&apos;s <a href="#">GitHub Actions tab</a> and choose <code>Actions → Weekly grant discovery → Run workflow</code>.</p>
      </Card>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent</th><th>Trigger</th><th>Status</th><th>Started</th>
              <th className="num">Duration</th><th className="num">Tokens</th><th className="num">Cost</th><th>Error</th>
            </tr>
          </thead>
          <tbody>
            {RUNS.map((r)=>(
              <tr key={r.id}>
                <td className="nowrap">{r.agent}</td>
                <td className="nowrap"><span className="muted">{r.trigger}</span></td>
                <td><Chip label={RUN_LABEL[r.status]} tone={RUN_TONE[r.status]} /></td>
                <td className="nowrap">{r.started}</td>
                <td className="num">{r.duration}</td>
                <td className="num">{r.tokens == null ? "—" : r.tokens.toLocaleString("en-US")}</td>
                <td className="num">{r.cost}</td>
                <td className="cell-error">{r.error ? <span title={r.error}>{r.error}</span> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
function GrantsApp() {
  const [view, setView] = React.useState("board");
  const [openId, setOpenId] = React.useState(null);
  const [grants, setGrants] = React.useState(GRANTS);

  function onStatus(id, status) {
    setGrants((gs)=>gs.map((g)=>g.id===id ? {...g, status} : g));
  }
  function openGrant(id) { setOpenId(id); setView("detail"); }

  const openGrantObj = grants.find((g)=>g.id===openId) ?? grants[0];

  return (
    <div>
      <Nav view={view==="detail" ? "board" : view} onNav={(v)=>{setView(v);}} />
      <HealthBar />
      <main>
        {view === "board" && <BoardScreen grants={grants} onOpen={openGrant} onStatus={onStatus} />}
        {view === "detail" && <DetailScreen g={openGrantObj} onBack={()=>setView("board")} />}
        {view === "runs" && <RunsScreen />}
        {view === "profile" && <PlaceholderScreen title="Organization profile" hint="The white-label voice your agents speak in." />}
        {view === "settings" && <PlaceholderScreen title="Settings" hint="Discovery cadence, spend guardrails, and where alerts go." />}
      </main>
    </div>
  );
}

function PlaceholderScreen({ title, hint }) {
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{title}</h1><p className="muted" style={{marginBottom:0}}>{hint}</p></div></div>
      <Card><EmptyState title="Form omitted in this kit" hint="See the Board, Grant detail, and Runs screens for the full component set." /></Card>
    </div>
  );
}

window.GrantsApp = GrantsApp;
