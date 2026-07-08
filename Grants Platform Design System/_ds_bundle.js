/* @ds-bundle: {"format":4,"namespace":"GrantsPlatformDesignSystem_a27f23","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"EmptyState","sourcePath":"components/core/EmptyState.jsx"},{"name":"FieldRow","sourcePath":"components/core/FieldRow.jsx"},{"name":"ScorePips","sourcePath":"components/core/ScorePips.jsx"},{"name":"StatusChip","sourcePath":"components/core/StatusChip.jsx"}],"sourceHashes":{"components/core/Button.jsx":"ba5736688f4b","components/core/Card.jsx":"27d0736e7ff2","components/core/Chip.jsx":"669f33367fa9","components/core/EmptyState.jsx":"54d617546244","components/core/FieldRow.jsx":"492e1fa42fad","components/core/ScorePips.jsx":"c04b9456efbb","components/core/StatusChip.jsx":"fa2869b6c258","ui_kits/grants-app/screens.jsx":"9d699001806b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.GrantsPlatformDesignSystem_a27f23 = window.GrantsPlatformDesignSystem_a27f23 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — wraps the .btn class family. Default is the bordered secondary
 * button; variant="primary" is the brand-filled action. size="sm" is the
 * compact form used inline (board "← Board", rating 1–5, channel save).
 * Pass href to render as an anchor styled identically (the product uses .btn on
 * Next <Link> too).
 *
 * NOTE (intentional addition): the source ships no <Button> component — buttons
 * are hand-written <button className="btn …">. This primitive standardizes that
 * markup. It is presentational only; wire real interactivity in a client island.
 */
function Button({
  children,
  variant = "secondary",
  size = "md",
  href,
  type = "button",
  disabled = false,
  onClick,
  className,
  ...rest
}) {
  const classes = ["btn", variant === "primary" ? "btn-primary" : null, size === "sm" ? "btn-sm" : null, className].filter(Boolean).join(" ");
  if (href) {
    return /*#__PURE__*/React.createElement("a", _extends({
      className: classes,
      href: href
    }, rest), children);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    className: classes,
    type: type,
    disabled: disabled,
    onClick: onClick
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
/**
 * Card — the base surface. White, 1px --line border, --radius corners, soft
 * --shadow, --s3 padding. Pass className="card-ethos" for the accent left-border
 * variant used by the trust-anchor card on grant detail.
 */
function Card({
  children,
  className,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: className ? `card ${className}` : "card",
    style: style
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
/**
 * Chip — small pill label with a tone. Tones: neutral, muted, info, good, warn,
 * bad, brand. Default is a bare muted pill; "neutral" is the bordered surface
 * variant. Used for recommendations, verdicts, statuses, and cron summaries.
 */
function Chip({
  label,
  tone = "neutral"
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: `chip chip-${tone}`
  }, label);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/EmptyState.jsx
try { (() => {
/**
 * EmptyState — the mandatory placeholder for any empty list, board column, or
 * table. Centered title + optional hint + optional action button. Every list in
 * the product renders one of these instead of showing nothing.
 */
function EmptyState({
  title,
  hint,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("p", {
    className: "empty-title"
  }, title), hint ? /*#__PURE__*/React.createElement("p", {
    className: "empty-hint"
  }, hint) : null, action ? /*#__PURE__*/React.createElement("div", {
    className: "empty-action"
  }, action) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/FieldRow.jsx
try { (() => {
/**
 * FieldRow — a labeled row for detail views: a 160px label column and a value
 * column, divided by a hairline. Collapses to stacked single-column under 900px.
 * The building block of the grant-detail Assessment card and Settings.
 */
function FieldRow({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "field-value"
  }, children));
}
Object.assign(__ds_scope, { FieldRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/FieldRow.jsx", error: String((e && e.message) || e) }); }

// components/core/ScorePips.jsx
try { (() => {
/**
 * ScorePips — a 1..max row of filled/empty square pips for a score (Fit,
 * Alignment/Ethos, human rating). Renders an em-dash placeholder when the score
 * is null/0. Filled pips use --brand-primary; empty use --line.
 */
function ScorePips({
  score,
  max = 5
}) {
  const filled = Math.max(0, Math.min(max, Math.round(score ?? 0)));
  if (!score) {
    return /*#__PURE__*/React.createElement("span", {
      className: "pips pips-empty"
    }, "\u2014");
  }
  return /*#__PURE__*/React.createElement("span", {
    className: "pips",
    "aria-label": `${filled} of ${max}`
  }, Array.from({
    length: max
  }, (_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: i < filled ? "pip pip-on" : "pip pip-off",
    "aria-hidden": "true"
  })));
}
Object.assign(__ds_scope, { ScorePips });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ScorePips.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusChip.jsx
try { (() => {
const STATUS_TONE = {
  found: "neutral",
  researching: "info",
  drafting: "info",
  applied: "warn",
  submitted: "warn",
  awarded: "good",
  passed: "muted",
  discarded: "muted",
  dead: "bad"
};
const STATUS_LABEL = {
  found: "Found",
  researching: "Researching",
  drafting: "Drafting",
  applied: "Applied",
  submitted: "Submitted",
  awarded: "Awarded",
  passed: "Passed",
  discarded: "Discarded",
  dead: "Dead"
};

/**
 * StatusChip — a Chip whose tone + label are derived from one of the nine grant
 * statuses. This is the single source of truth for how a status looks anywhere
 * in the app (board cards, detail header, pipeline).
 */
function StatusChip({
  status
}) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return /*#__PURE__*/React.createElement("span", {
    className: `chip chip-${tone}`
  }, STATUS_LABEL[status] ?? status);
}
Object.assign(__ds_scope, { StatusChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusChip.jsx", error: String((e && e.message) || e) }); }

// ui_kits/grants-app/screens.jsx
try { (() => {
/* Grants App UI kit — screens.
   Recreates the real product surfaces (app/page.tsx, app/grants/[id]/page.tsx,
   app/runs/page.tsx) using the design-system primitives + globals.css classes.
   Org-neutral sample data — nothing here is tied to any organization. */

const {
  Card,
  Chip,
  StatusChip,
  ScorePips,
  EmptyState,
  FieldRow,
  Button
} = window.GrantsPlatformDesignSystem_a27f23;

// ---- board layout: status -> column (lib/types.ts STATUS_COLUMNS) ----
const STATUS_COLUMNS = [{
  key: "searched",
  label: "Searched",
  statuses: ["found"]
}, {
  key: "active",
  label: "Active",
  statuses: ["researching", "drafting"]
}, {
  key: "pending",
  label: "Pending",
  statuses: ["applied", "submitted"]
}, {
  key: "closed",
  label: "Closed",
  statuses: ["awarded", "passed", "discarded", "dead"]
}];
const GRANT_STATUSES = ["found", "researching", "drafting", "applied", "submitted", "awarded", "passed", "discarded", "dead"];
const STATUS_LABELS = {
  found: "Found",
  researching: "Researching",
  drafting: "Drafting",
  applied: "Applied",
  submitted: "Submitted",
  awarded: "Awarded",
  passed: "Passed",
  discarded: "Discarded",
  dead: "Dead"
};
const REC_TONE = {
  pursue: "good",
  maybe: "warn",
  pass: "muted"
};
const REC_LABEL = {
  pursue: "Pursue",
  maybe: "Maybe",
  pass: "Pass"
};

// ---- sample grants (org-neutral) ----
const GRANTS = [{
  id: "g1",
  funder: "Open Horizon Foundation",
  program_name: "Emerging Technology Fund",
  amount: "$150,000",
  deadline: "2026-03-01",
  fit_score: 5,
  alignment_score: 4,
  recommendation: "pursue",
  status: "found",
  alignment_rationale: "Directly funds applied research in the program area with an explicit preference for small, independent teams — a strong structural match for our mandate.",
  framing_angle: "Lead with the field-building angle; this funder rewards ecosystem effects over single-project outputs.",
  eligibility_notes: "Open to registered non-profits and fiscally-sponsored projects. No geographic restriction.",
  confidence: "high",
  source_url: "https://example.org/fund",
  application_url: "https://example.org/apply"
}, {
  id: "g2",
  funder: "Meridian Trust",
  program_name: "Public Interest Research",
  amount: "$75,000",
  deadline: "rolling",
  fit_score: 4,
  alignment_score: 4,
  recommendation: "pursue",
  status: "researching",
  alignment_rationale: "Rolling deadline and mission overlap make this a low-risk pursue; prior grantees resemble our profile.",
  framing_angle: "Emphasize measurable public-interest outcomes in year one.",
  eligibility_notes: "US-based organizations only.",
  confidence: "medium",
  source_url: "https://example.org/meridian"
}, {
  id: "g3",
  funder: "Lattice Science Initiative",
  program_name: "Trustworthy Systems RFP",
  amount: "$300,000",
  deadline: "2026-05-15",
  fit_score: 4,
  alignment_score: 3,
  recommendation: "maybe",
  status: "drafting",
  alignment_rationale: "Scope is adjacent; the alignment case is real but requires framing to fit the RFP's stated priorities.",
  framing_angle: "Position our work as the evaluation layer their portfolio is missing.",
  eligibility_notes: "Requires a named PI with relevant publications.",
  confidence: "medium",
  source_url: "https://example.org/lattice"
}, {
  id: "g4",
  funder: "Cedar & Vale Fund",
  program_name: "Capacity Grants",
  amount: "$40,000",
  deadline: "2026-02-10",
  fit_score: 3,
  alignment_score: 3,
  recommendation: "maybe",
  status: "applied",
  alignment_rationale: "General operating support — useful but not mission-defining.",
  framing_angle: "Frame as runway to de-risk the larger program bets.",
  confidence: "medium"
}, {
  id: "g5",
  funder: "Northwind Philanthropies",
  program_name: "Annual Open Call",
  amount: "$120,000",
  deadline: "2026-01-31",
  fit_score: 4,
  alignment_score: 4,
  recommendation: "pursue",
  status: "submitted",
  alignment_rationale: "Submitted; strong fit, awaiting review.",
  confidence: "high"
}, {
  id: "g6",
  funder: "The Aster Foundation",
  program_name: "Innovation Prize",
  amount: "$250,000",
  deadline: "2025-11-01",
  fit_score: 5,
  alignment_score: 5,
  recommendation: "pursue",
  status: "awarded",
  alignment_rationale: "Awarded — our clearest alignment win to date.",
  confidence: "high"
}, {
  id: "g7",
  funder: "Granite Community Fund",
  program_name: "Local Grants",
  amount: "$15,000",
  deadline: "unknown",
  fit_score: 2,
  alignment_score: 2,
  recommendation: "pass",
  status: "passed",
  alignment_rationale: "Geographic scope excludes most of our work.",
  confidence: "high"
}, {
  id: "g8",
  funder: "Pinnacle Ventures Grant",
  program_name: "Seed Awards",
  amount: "$50,000",
  deadline: "2025-09-15",
  fit_score: 1,
  alignment_score: 1,
  recommendation: "pass",
  status: "dead",
  alignment_rationale: "Invite-only and now closed.",
  confidence: "high"
}];
function formatDeadline(d) {
  if (!d || d === "unknown") return "No deadline";
  if (d === "rolling") return "Rolling";
  return d;
}

// ---------------------------------------------------------------------------
// Chrome: nav + health bar
// ---------------------------------------------------------------------------
function Nav({
  view,
  onNav
}) {
  const links = [["board", "Board"], ["runs", "Runs"], ["profile", "Profile"], ["settings", "Settings"]];
  return /*#__PURE__*/React.createElement("nav", {
    className: "app-nav"
  }, /*#__PURE__*/React.createElement("a", {
    className: "brand",
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav("board");
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand-dot",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", null, "Grants")), /*#__PURE__*/React.createElement("div", {
    className: "nav-links"
  }, links.map(([k, label]) => /*#__PURE__*/React.createElement("a", {
    key: k,
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav(k);
    },
    style: k === view ? {
      color: "var(--brand-primary)"
    } : undefined
  }, label))));
}
function HealthBar() {
  return /*#__PURE__*/React.createElement("div", {
    className: "health-bar"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, "Last run:"), " 2h ago"), /*#__PURE__*/React.createElement("span", {
    className: "health-sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, "Today:"), " $1.20 / $5.00"), /*#__PURE__*/React.createElement("span", {
    className: "health-sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, GRANTS.length), " grants tracked"));
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------
function StatusSelect({
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("select", {
    className: "status-select",
    value: value,
    onClick: e => e.stopPropagation(),
    onChange: e => {
      e.stopPropagation();
      onChange(e.target.value);
    },
    "aria-label": "Grant status"
  }, GRANT_STATUSES.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, STATUS_LABELS[s])));
}
function GrantCard({
  g,
  onOpen,
  onStatus
}) {
  return /*#__PURE__*/React.createElement("a", {
    className: "grant-card",
    href: "#",
    onClick: e => {
      e.preventDefault();
      onOpen(g.id);
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "gc-funder"
  }, g.funder), g.program_name ? /*#__PURE__*/React.createElement("div", {
    className: "gc-program"
  }, g.program_name) : null, /*#__PURE__*/React.createElement("div", {
    className: "gc-meta"
  }, g.amount ? /*#__PURE__*/React.createElement("span", {
    className: "gc-amount"
  }, g.amount) : null, /*#__PURE__*/React.createElement("span", null, formatDeadline(g.deadline))), /*#__PURE__*/React.createElement("div", {
    className: "gc-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gc-scores"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gc-score-label"
  }, "Fit"), /*#__PURE__*/React.createElement(ScorePips, {
    score: g.fit_score
  })), /*#__PURE__*/React.createElement("span", {
    className: "gc-scores"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gc-score-label"
  }, "Align"), /*#__PURE__*/React.createElement(ScorePips, {
    score: g.alignment_score
  })), g.recommendation ? /*#__PURE__*/React.createElement(Chip, {
    label: REC_LABEL[g.recommendation],
    tone: REC_TONE[g.recommendation]
  }) : null), /*#__PURE__*/React.createElement("div", {
    className: "gc-meta gc-status-row"
  }, /*#__PURE__*/React.createElement(StatusSelect, {
    value: g.status,
    onChange: s => onStatus(g.id, s)
  })));
}
function BoardScreen({
  grants,
  onOpen,
  onStatus
}) {
  const byStatus = {};
  for (const g of grants) (byStatus[g.status] ||= []).push(g);
  return /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Pipeline"), /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, grants.length, " grants across the board"))), /*#__PURE__*/React.createElement("div", {
    className: "board"
  }, STATUS_COLUMNS.map(col => {
    const items = col.statuses.flatMap(s => byStatus[s] ?? []);
    return /*#__PURE__*/React.createElement("section", {
      key: col.key,
      className: "board-col"
    }, /*#__PURE__*/React.createElement("header", {
      className: "board-col-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "col-title"
    }, col.label), /*#__PURE__*/React.createElement("span", {
      className: "col-count"
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      className: "board-col-body"
    }, items.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
      title: "Nothing here yet",
      hint: "Grants land here as they move through the pipeline."
    }) : items.map(g => /*#__PURE__*/React.createElement(GrantCard, {
      key: g.id,
      g: g,
      onOpen: onOpen,
      onStatus: onStatus
    }))));
  })));
}

// ---------------------------------------------------------------------------
// Grant detail
// ---------------------------------------------------------------------------
function DField({
  label,
  value
}) {
  if (value === null || value === undefined || value === "") return null;
  return /*#__PURE__*/React.createElement(FieldRow, {
    label: label
  }, value);
}
function DetailScreen({
  g,
  onBack
}) {
  const [score, setScore] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const title = g.program_name ? `${g.funder} — ${g.program_name}` : g.funder;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail-title"
  }, /*#__PURE__*/React.createElement("h1", null, title), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(StatusChip, {
    status: g.status
  }), g.amount ? /*#__PURE__*/React.createElement("span", {
    className: "gc-amount"
  }, g.amount) : null, g.deadline ? /*#__PURE__*/React.createElement(Chip, {
    label: `Deadline: ${formatDeadline(g.deadline)}`,
    tone: "neutral"
  }) : null)), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    href: "#",
    onClick: e => {
      e.preventDefault();
      onBack();
    }
  }, "\u2190 Board")), /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "card-ethos"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h2", null, "Ethos alignment"), /*#__PURE__*/React.createElement("span", {
    className: "row"
  }, /*#__PURE__*/React.createElement(ScorePips, {
    score: g.alignment_score
  }), /*#__PURE__*/React.createElement("strong", null, g.alignment_score ?? "—", " / 5"))), g.alignment_rationale ? /*#__PURE__*/React.createElement("p", {
    className: "prose"
  }, g.alignment_rationale) : /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, "No alignment rationale recorded yet.")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h2", {
    className: "section-head"
  }, "Assessment"), /*#__PURE__*/React.createElement(DField, {
    label: "Recommendation",
    value: g.recommendation ? /*#__PURE__*/React.createElement(Chip, {
      label: g.recommendation,
      tone: REC_TONE[g.recommendation]
    }) : null
  }), /*#__PURE__*/React.createElement(DField, {
    label: "Confidence",
    value: g.confidence
  }), /*#__PURE__*/React.createElement(DField, {
    label: "Fit score",
    value: g.fit_score != null ? /*#__PURE__*/React.createElement(ScorePips, {
      score: g.fit_score
    }) : null
  }), /*#__PURE__*/React.createElement(DField, {
    label: "Framing angle",
    value: g.framing_angle
  }), /*#__PURE__*/React.createElement(DField, {
    label: "Eligibility",
    value: g.eligibility_notes ? /*#__PURE__*/React.createElement("span", {
      className: "prose"
    }, g.eligibility_notes) : null
  }), /*#__PURE__*/React.createElement(DField, {
    label: "Source",
    value: g.source_url ? /*#__PURE__*/React.createElement("a", {
      href: g.source_url,
      target: "_blank",
      rel: "noreferrer"
    }, g.source_url) : null
  }), /*#__PURE__*/React.createElement(DField, {
    label: "Application",
    value: g.application_url ? /*#__PURE__*/React.createElement("a", {
      href: g.application_url,
      target: "_blank",
      rel: "noreferrer"
    }, g.application_url) : null
  })), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h2", {
    className: "section-head"
  }, "Adjudication debate"), /*#__PURE__*/React.createElement("details", {
    className: "debate-round"
  }, /*#__PURE__*/React.createElement("summary", {
    className: "dr-head"
  }, /*#__PURE__*/React.createElement("span", null, "Round 1"), /*#__PURE__*/React.createElement(Chip, {
    label: "survived",
    tone: "good"
  })), /*#__PURE__*/React.createElement("div", {
    className: "dr-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dr-role"
  }, "Finder claim"), /*#__PURE__*/React.createElement(DField, {
    label: "Fit score",
    value: /*#__PURE__*/React.createElement(ScorePips, {
      score: g.fit_score
    })
  }), /*#__PURE__*/React.createElement(DField, {
    label: "Framing angle",
    value: g.framing_angle
  })), /*#__PURE__*/React.createElement("div", {
    className: "dr-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dr-role"
  }, "Skeptic verdict"), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      marginBottom: "var(--s2)"
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    label: "survives",
    tone: "good"
  }), /*#__PURE__*/React.createElement(Chip, {
    label: "eligibility ok",
    tone: "good"
  }), /*#__PURE__*/React.createElement(Chip, {
    label: "deadline ok",
    tone: "good"
  })), /*#__PURE__*/React.createElement("p", {
    className: "prose"
  }, "No disqualifying eligibility or timing issue found; the fit claim holds up against the live program page.")), /*#__PURE__*/React.createElement("div", {
    className: "dr-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dr-role"
  }, "Judge ruling"), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      marginBottom: "var(--s2)"
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    label: "survives",
    tone: "good"
  }), /*#__PURE__*/React.createElement(Chip, {
    label: g.recommendation,
    tone: REC_TONE[g.recommendation]
  }), /*#__PURE__*/React.createElement(Chip, {
    label: `confidence: ${g.confidence}`,
    tone: "neutral"
  })), /*#__PURE__*/React.createElement(DField, {
    label: "Alignment",
    value: /*#__PURE__*/React.createElement(ScorePips, {
      score: g.alignment_score
    })
  }), /*#__PURE__*/React.createElement(DField, {
    label: "Alignment rationale",
    value: /*#__PURE__*/React.createElement("span", {
      className: "prose"
    }, g.alignment_rationale)
  })))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h2", {
    className: "section-head"
  }, "Your rating"), /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Score"), /*#__PURE__*/React.createElement("div", {
    className: "row",
    role: "group",
    "aria-label": "Rate this grant from 1 to 5"
  }, [1, 2, 3, 4, 5].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    type: "button",
    className: `btn btn-sm${score === n ? " btn-primary" : ""}`,
    "aria-pressed": score === n,
    onClick: () => {
      setScore(n);
      setSaved(false);
    }
  }, n)))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "why"
  }, "Why? (optional)"), /*#__PURE__*/React.createElement("textarea", {
    id: "why",
    placeholder: "What made this a strong or weak fit? This teaches the scoring."
  })), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => setSaved(true),
    disabled: score == null
  }, "Save rating"), saved ? /*#__PURE__*/React.createElement("span", {
    className: "saved-note"
  }, "Saved \u2713") : null))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h2", {
    className: "section-head"
  }, "Notes"), /*#__PURE__*/React.createElement("div", {
    className: "field",
    style: {
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "notes"
  }, "Operator notes"), /*#__PURE__*/React.createElement("textarea", {
    id: "notes",
    placeholder: "Context, contacts, next steps \u2014 human-owned, never touched by the engine."
  })))));
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------
const RUNS = [{
  id: "r1",
  agent: "discovery",
  trigger: "scheduled",
  status: "success",
  started: "Jul 7, 2026, 12:04 PM UTC",
  duration: "48.2s",
  tokens: 184203,
  cost: "$1.20",
  error: null
}, {
  id: "r2",
  agent: "draft",
  trigger: "manual",
  status: "success",
  started: "Jul 6, 2026, 3:11 PM UTC",
  duration: "22.6s",
  tokens: 61240,
  cost: "$0.44",
  error: null
}, {
  id: "r3",
  agent: "deadline-sweep",
  trigger: "scheduled",
  status: "success",
  started: "Jul 6, 2026, 12:00 PM UTC",
  duration: "1.8s",
  tokens: 0,
  cost: "$0.00",
  error: null
}, {
  id: "r4",
  agent: "discovery",
  trigger: "scheduled",
  status: "error",
  started: "Jun 30, 2026, 12:03 PM UTC",
  duration: "12.4s",
  tokens: 24010,
  cost: "$0.18",
  error: "Web search rate-limited after 3 retries; run aborted before judging."
}, {
  id: "r5",
  agent: "draft",
  trigger: "webhook",
  status: "running",
  started: "Jul 7, 2026, 12:31 PM UTC",
  duration: "—",
  tokens: null,
  cost: "—",
  error: null
}];
const RUN_TONE = {
  running: "info",
  success: "good",
  error: "bad"
};
const RUN_LABEL = {
  running: "Running",
  success: "Success",
  error: "Error"
};
function RunsScreen() {
  return /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("h1", null, "Runs")), /*#__PURE__*/React.createElement(Card, {
    className: "note-panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Run discovery now"), /*#__PURE__*/React.createElement("p", null, "Discovery runs automatically on a weekly schedule. To trigger a run by hand, open the repo's ", /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "GitHub Actions tab"), " and choose ", /*#__PURE__*/React.createElement("code", null, "Actions \u2192 Weekly grant discovery \u2192 Run workflow"), ".")), /*#__PURE__*/React.createElement("div", {
    className: "table-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Agent"), /*#__PURE__*/React.createElement("th", null, "Trigger"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Started"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Duration"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Tokens"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Cost"), /*#__PURE__*/React.createElement("th", null, "Error"))), /*#__PURE__*/React.createElement("tbody", null, RUNS.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "nowrap"
  }, r.agent), /*#__PURE__*/React.createElement("td", {
    className: "nowrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, r.trigger)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Chip, {
    label: RUN_LABEL[r.status],
    tone: RUN_TONE[r.status]
  })), /*#__PURE__*/React.createElement("td", {
    className: "nowrap"
  }, r.started), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.duration), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.tokens == null ? "—" : r.tokens.toLocaleString("en-US")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.cost), /*#__PURE__*/React.createElement("td", {
    className: "cell-error"
  }, r.error ? /*#__PURE__*/React.createElement("span", {
    title: r.error
  }, r.error) : /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "\u2014"))))))));
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
function GrantsApp() {
  const [view, setView] = React.useState("board");
  const [openId, setOpenId] = React.useState(null);
  const [grants, setGrants] = React.useState(GRANTS);
  function onStatus(id, status) {
    setGrants(gs => gs.map(g => g.id === id ? {
      ...g,
      status
    } : g));
  }
  function openGrant(id) {
    setOpenId(id);
    setView("detail");
  }
  const openGrantObj = grants.find(g => g.id === openId) ?? grants[0];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Nav, {
    view: view === "detail" ? "board" : view,
    onNav: v => {
      setView(v);
    }
  }), /*#__PURE__*/React.createElement(HealthBar, null), /*#__PURE__*/React.createElement("main", null, view === "board" && /*#__PURE__*/React.createElement(BoardScreen, {
    grants: grants,
    onOpen: openGrant,
    onStatus: onStatus
  }), view === "detail" && /*#__PURE__*/React.createElement(DetailScreen, {
    g: openGrantObj,
    onBack: () => setView("board")
  }), view === "runs" && /*#__PURE__*/React.createElement(RunsScreen, null), view === "profile" && /*#__PURE__*/React.createElement(PlaceholderScreen, {
    title: "Organization profile",
    hint: "The white-label voice your agents speak in."
  }), view === "settings" && /*#__PURE__*/React.createElement(PlaceholderScreen, {
    title: "Settings",
    hint: "Discovery cadence, spend guardrails, and where alerts go."
  })));
}
function PlaceholderScreen({
  title,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, title), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      marginBottom: 0
    }
  }, hint))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(EmptyState, {
    title: "Form omitted in this kit",
    hint: "See the Board, Grant detail, and Runs screens for the full component set."
  })));
}
window.GrantsApp = GrantsApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/grants-app/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.FieldRow = __ds_scope.FieldRow;

__ds_ns.ScorePips = __ds_scope.ScorePips;

__ds_ns.StatusChip = __ds_scope.StatusChip;

})();
