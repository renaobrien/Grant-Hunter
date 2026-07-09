// Seed a realistic-looking demo pipeline for screenshots and product tours.
// Everything is fictional and org-neutral, tagged so it can be removed:
//   grants:       legacy_sheet_id = 'demo-NNN'  (upsert -> idempotent re-runs)
//   agent_debate: run_id = DEMO_RUN_ID
//   agent_runs:   input_data.demo = true
//
//   npm run seed:demo             # insert/update the demo data
//   npm run seed:demo -- --clean  # remove it all (drafts/ratings cascade)

import "../engine/load-env";
import { getServiceClient } from "../engine/db";

const DEMO_RUN_ID = "00000000-0000-4000-8000-00000000d390";
const DEMO_PREFIX = "demo-";
const clean = process.argv.includes("--clean");

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const daysOut = (d: number) =>
  new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

// All fictional funders. notes carry a "[demo data]" marker.
const GRANTS = [
  {
    legacy_sheet_id: "demo-001",
    funder: "Meridian Open Web Fund",
    program_name: "Infrastructure Grants 2026",
    amount: "$50K-$100K",
    amount_numeric: 75000,
    deadline: daysOut(45),
    fit_score: 5,
    alignment_score: 5,
    recommendation: "pursue",
    confidence: "high",
    status: "found",
    framing_angle: "Public-interest infrastructure the ecosystem depends on",
    eligibility_notes: "Open to nonprofits and fiscally sponsored projects.",
    alignment_rationale:
      "Mission-level match: funds maintenance of critical open infrastructure.",
    source_url: "https://example.org/demo/meridian",
    notes: "[demo data] Strong fit; program officer welcomes cold outreach.",
  },
  {
    legacy_sheet_id: "demo-002",
    funder: "Northlight Digital Commons Foundation",
    program_name: "Commons Builders",
    amount: "$25K-$60K",
    amount_numeric: 40000,
    deadline: daysOut(30),
    fit_score: 4,
    alignment_score: 4,
    recommendation: "pursue",
    confidence: "medium",
    status: "found",
    framing_angle: "Community-governed digital commons",
    eligibility_notes: "Requires open-source license on funded work.",
    alignment_rationale: "Values overlap on openness; program size fits.",
    source_url: "https://example.org/demo/northlight",
    notes: "[demo data]",
  },
  {
    legacy_sheet_id: "demo-003",
    funder: "Harborview Civic Tech Trust",
    program_name: "Rapid Grants",
    amount: "$10K-$25K",
    amount_numeric: 15000,
    deadline: "rolling",
    fit_score: 4,
    alignment_score: 3,
    recommendation: "pursue",
    confidence: "high",
    status: "found",
    framing_angle: "Fast, small-dollar support for shipping teams",
    eligibility_notes: "Rolling review, decisions in ~3 weeks.",
    alignment_rationale: "Quick win; low effort application.",
    source_url: "https://example.org/demo/harborview",
    notes: "[demo data]",
  },
  {
    legacy_sheet_id: "demo-004",
    funder: "Blue Lattice Research Initiative",
    program_name: "Applied Research Track",
    amount: "$80K-$150K",
    amount_numeric: 120000,
    deadline: daysOut(60),
    fit_score: 4,
    alignment_score: 4,
    recommendation: "pursue",
    confidence: "medium",
    status: "found",
    framing_angle: "Research with a deployed-artifact requirement",
    eligibility_notes: "Needs a named PI; partner university optional.",
    alignment_rationale: "Larger award justifies the heavier application.",
    source_url: "https://example.org/demo/bluelattice",
    notes: "[demo data] Waiting on eligibility clarification re: fiscal sponsor.",
  },
  {
    legacy_sheet_id: "demo-005",
    funder: "Cascadia Resilience Collaborative",
    program_name: "Community Capacity",
    amount: "$30K",
    amount_numeric: 30000,
    deadline: daysOut(21),
    fit_score: 3,
    alignment_score: 4,
    recommendation: "maybe",
    confidence: "medium",
    status: "found",
    framing_angle: "Capacity building for volunteer-run programs",
    eligibility_notes: "Regional preference; remote teams eligible.",
    alignment_rationale: "Good values fit, mid-size award.",
    source_url: "https://example.org/demo/cascadia",
    notes: "[demo data]",
  },
  {
    legacy_sheet_id: "demo-006",
    funder: "Foundry Works Philanthropy",
    program_name: "Tools for Makers",
    amount: "$40K-$75K",
    amount_numeric: 55000,
    deadline: daysOut(14),
    fit_score: 5,
    alignment_score: 5,
    recommendation: "pursue",
    confidence: "high",
    status: "drafting",
    framing_angle: "Tooling that multiplies practitioner impact",
    eligibility_notes: "Two-stage: LOI then invited full proposal.",
    alignment_rationale: "Flagship-quality fit; deadline is close.",
    source_url: "https://example.org/demo/foundry",
    application_url: "https://example.org/demo/foundry/apply",
    notes: "[demo data] Draft in progress - see Application drafts.",
  },
  {
    legacy_sheet_id: "demo-007",
    funder: "Signal Route Fund",
    program_name: "Open Knowledge",
    amount: "$20K",
    amount_numeric: 20000,
    deadline: daysOut(-10),
    fit_score: 4,
    alignment_score: 4,
    recommendation: "pursue",
    confidence: "high",
    status: "submitted",
    framing_angle: "Open knowledge distribution",
    eligibility_notes: "Submitted before the cycle closed.",
    alignment_rationale: "Applied last cycle window.",
    source_url: "https://example.org/demo/signalroute",
    notes: "[demo data] Application submitted; decision expected in 6 weeks.",
  },
  {
    legacy_sheet_id: "demo-008",
    funder: "Aldergrove Family Foundation",
    program_name: "Small Grants",
    amount: "$15K",
    amount_numeric: 15000,
    deadline: daysOut(-25),
    fit_score: 3,
    alignment_score: 3,
    recommendation: "maybe",
    confidence: "medium",
    status: "submitted",
    framing_angle: "General operating support",
    eligibility_notes: "Board reviews quarterly.",
    alignment_rationale: "Modest but unrestricted.",
    source_url: "https://example.org/demo/aldergrove",
    notes: "[demo data]",
  },
  {
    legacy_sheet_id: "demo-009",
    funder: "Kestrel Impact Fund",
    program_name: "Catalyst Awards",
    amount: "$50K",
    amount_numeric: 50000,
    deadline: daysOut(-90),
    fit_score: 5,
    alignment_score: 5,
    recommendation: "pursue",
    confidence: "high",
    status: "awarded",
    framing_angle: "Early-stage catalytic funding",
    eligibility_notes: "Won - reporting due annually.",
    alignment_rationale: "Awarded last quarter.",
    source_url: "https://example.org/demo/kestrel",
    notes: "[demo data] AWARDED - $50K over 12 months.",
  },
  {
    legacy_sheet_id: "demo-010",
    funder: "Pinebrook Community Trust",
    program_name: "Neighborhood Micro-grants",
    amount: "$5K",
    amount_numeric: 5000,
    deadline: "rolling",
    fit_score: 2,
    alignment_score: 2,
    recommendation: "pass",
    confidence: "high",
    status: "dead",
    framing_angle: "Hyper-local projects",
    eligibility_notes: "Local-first; we're out of scope.",
    alignment_rationale: "Too small and geography-restricted.",
    source_url: "https://example.org/demo/pinebrook",
    notes: "[demo data] Passed - award size below our floor.",
  },
  {
    legacy_sheet_id: "demo-011",
    funder: "Vantage Horizon Program",
    program_name: "Enterprise Pilots",
    amount: "$200K",
    amount_numeric: 200000,
    deadline: daysOut(90),
    fit_score: 2,
    alignment_score: 1,
    recommendation: "pass",
    confidence: "medium",
    status: "dead",
    framing_angle: "Commercial pilot funding",
    eligibility_notes: "For-profit pilots only.",
    alignment_rationale: "Mission mismatch despite the big number.",
    source_url: "https://example.org/demo/vantage",
    notes: "[demo data] Discarded - misaligned with mission.",
  },
  {
    legacy_sheet_id: "demo-012",
    funder: "Old Mill Legacy Fund",
    program_name: "Heritage Grants",
    amount: "$35K",
    amount_numeric: 35000,
    deadline: daysOut(-120),
    fit_score: 3,
    alignment_score: 3,
    recommendation: "maybe",
    confidence: "low",
    status: "dead",
    framing_angle: "Preservation projects",
    eligibility_notes: "Cycle closed before we could apply.",
    alignment_rationale: "Deadline passed.",
    source_url: "https://example.org/demo/oldmill",
    notes: "[demo data] Dead - missed the window.",
  },
];

// Debate transcript rows: three survivors matching demo grants + one cut, so
// the grant detail pages and the Runs page "Recently cut" card have content.
const DEBATE = [
  ...[
    ["demo-001", "Meridian Open Web Fund", "Infrastructure Grants 2026", 5],
    ["demo-002", "Northlight Digital Commons Foundation", "Commons Builders", 4],
    ["demo-003", "Harborview Civic Tech Trust", "Rapid Grants", 4],
  ].map(([id, funder, program, fit], i) => {
    const g = GRANTS.find((x) => x.legacy_sheet_id === id)!;
    return {
      run_id: DEMO_RUN_ID,
      round: 1,
      candidate_key: g.source_url,
      finder_claim: {
        funder,
        program_name: program,
        amount: g.amount,
        deadline: g.deadline,
        fit_score: fit,
        framing_angle: g.framing_angle,
        eligibility_notes: g.eligibility_notes,
        notes: "[demo data] Proposed by the Finder.",
        source_url: g.source_url,
      },
      skeptic_verdict: {
        verdict: "survives",
        kill_shot:
          i === 0
            ? "Could not refute: program page confirms open call and eligibility."
            : "Deadline and eligibility verified on the funder's own page.",
        eligibility_ok: true,
        deadline_ok: true,
      },
      judge_ruling: {
        survives: true,
        funder,
        program_name: program,
        fit_score: fit,
        recommendation: "pursue",
        confidence: "high",
        alignment_score: fit,
        alignment_rationale: "[demo data] Clear mission overlap; worth pursuing.",
      },
      created_at: hoursAgo(3),
    };
  }),
  {
    run_id: DEMO_RUN_ID,
    round: 1,
    candidate_key: "https://example.org/demo/gildedgate",
    finder_claim: {
      funder: "Gilded Gate Initiative",
      program_name: "Innovation Challenge",
      amount: "$100K",
      deadline: daysOut(-30),
      fit_score: 4,
      framing_angle: "Innovation prize",
      notes: "[demo data] Looked promising at first glance.",
      source_url: "https://example.org/demo/gildedgate",
    },
    skeptic_verdict: {
      verdict: "refuted",
      kill_shot:
        "The 2026 cycle closed last month - the Finder read a stale listing page.",
      eligibility_ok: true,
      deadline_ok: false,
    },
    judge_ruling: {
      survives: false,
      funder: "Gilded Gate Initiative",
      program_name: "Innovation Challenge",
      fit_score: 2,
      recommendation: "pass",
      confidence: "high",
      alignment_score: 3,
      alignment_rationale:
        "[demo data] Skeptic's deadline objection stands; cut this round.",
    },
    created_at: hoursAgo(3),
  },
];

const DRAFT_TEXT = `# Application draft - Foundry Works Philanthropy, Tools for Makers

*[demo data - generated for product screenshots]*

## Why this work matters

Our tools sit in the critical path of hundreds of practitioners' daily work.
This grant would fund the two highest-leverage improvements our community has
asked for: a stable plugin interface and an accessibility pass across the core
workflows.

## What we will do

1. Ship a versioned plugin API with migration guides.
2. Audit and fix the top accessibility gaps (target: WCAG 2.1 AA).
3. Publish quarterly maintenance reports for transparency.

## Budget summary

$55,000 over 9 months: 70% engineering time, 20% accessibility consulting,
10% community documentation.`;

const AGENT_RUNS = [
  {
    agent_type: "finder",
    trigger_type: "manual",
    status: "success",
    started_at: hoursAgo(3.2),
    completed_at: hoursAgo(3.15),
    duration_ms: 178_000,
    tokens_used: 42_000,
    cost_cents: 30,
    input_data: { demo: true, runId: DEMO_RUN_ID, round: 1 },
  },
  {
    agent_type: "skeptic",
    trigger_type: "manual",
    status: "success",
    started_at: hoursAgo(3.1),
    completed_at: hoursAgo(3.05),
    duration_ms: 142_000,
    tokens_used: 31_000,
    cost_cents: 25,
    input_data: { demo: true, runId: DEMO_RUN_ID, round: 1, n: 4 },
  },
  {
    agent_type: "judge",
    trigger_type: "manual",
    status: "success",
    started_at: hoursAgo(3.0),
    completed_at: hoursAgo(2.97),
    duration_ms: 96_000,
    tokens_used: 24_000,
    cost_cents: 20,
    input_data: { demo: true, runId: DEMO_RUN_ID, round: 1, n: 4 },
  },
  {
    agent_type: "drafter",
    trigger_type: "scheduled",
    status: "success",
    started_at: hoursAgo(8 * 24),
    completed_at: hoursAgo(8 * 24 - 0.05),
    duration_ms: 121_000,
    tokens_used: 18_000,
    cost_cents: 15,
    input_data: { demo: true },
  },
];

async function main(): Promise<void> {
  const sb = getServiceClient();

  if (clean) {
    // Order matters only for clarity - grants cascade to drafts/ratings.
    const { error: dErr } = await sb.from("agent_debate").delete().eq("run_id", DEMO_RUN_ID);
    const { error: rErr } = await sb
      .from("agent_runs")
      .delete()
      .filter("input_data->>demo", "eq", "true");
    const { error: gErr } = await sb
      .from("grants")
      .delete()
      .like("legacy_sheet_id", `${DEMO_PREFIX}%`);
    for (const [what, err] of [
      ["agent_debate", dErr],
      ["agent_runs", rErr],
      ["grants", gErr],
    ] as const) {
      if (err) throw new Error(`cleaning ${what}: ${err.message}`);
    }
    console.log("Demo data removed.");
    return;
  }

  // 1) grants (idempotent via unique legacy_sheet_id)
  const { data: grantRows, error: gErr } = await sb
    .from("grants")
    .upsert(GRANTS, { onConflict: "legacy_sheet_id" })
    .select("id, legacy_sheet_id");
  if (gErr) throw new Error(`grants: ${gErr.message}`);

  // 2) one ready draft + its rounds on the 'drafting' grant
  const draftingGrant = grantRows?.find((g) => g.legacy_sheet_id === "demo-006");
  if (draftingGrant) {
    await sb.from("drafts").delete().eq("grant_id", draftingGrant.id); // idempotent re-run
    const { data: draft, error: dErr } = await sb
      .from("drafts")
      .insert({ grant_id: draftingGrant.id, status: "ready", content: DRAFT_TEXT, rounds: 2 })
      .select("id")
      .single();
    if (dErr) throw new Error(`drafts: ${dErr.message}`);
    const { error: rndErr } = await sb.from("draft_rounds").insert([
      {
        draft_id: draft.id,
        round: 1,
        draft_text: DRAFT_TEXT.replace("## Budget summary", "## Budget\n\nTBD.\n\n## Budget summary"),
        critic_verdict: {
          approved: false,
          issues: ["Budget section is a placeholder.", "No measurable outcomes stated."],
          suggestions: ["Add a concrete budget split.", "State WCAG target explicitly."],
        },
      },
      {
        draft_id: draft.id,
        round: 2,
        draft_text: DRAFT_TEXT,
        critic_verdict: { approved: true, issues: [], suggestions: [] },
      },
    ]);
    if (rndErr) throw new Error(`draft_rounds: ${rndErr.message}`);
  }

  // 3) debate transcript (delete-then-insert for idempotency)
  await sb.from("agent_debate").delete().eq("run_id", DEMO_RUN_ID);
  const { error: dbErr } = await sb.from("agent_debate").insert(DEBATE);
  if (dbErr) throw new Error(`agent_debate: ${dbErr.message}`);

  // 4) finished agent runs so the Runs page + health strip look alive
  await sb.from("agent_runs").delete().filter("input_data->>demo", "eq", "true");
  const { error: arErr } = await sb.from("agent_runs").insert(AGENT_RUNS);
  if (arErr) throw new Error(`agent_runs: ${arErr.message}`);

  console.log(
    `Seeded ${GRANTS.length} demo grants across all board columns, 1 ready draft, ` +
      `${DEBATE.length} debate rows (1 cut candidate), ${AGENT_RUNS.length} finished runs.\n` +
      "Remove later with: npm run seed:demo -- --clean",
  );
}

main().catch((err) => {
  console.error("[seed-demo] failed:", (err as Error).message);
  process.exit(1);
});
