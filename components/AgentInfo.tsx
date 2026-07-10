"use client";

// The "i" button on the Runs page: toggles a panel listing every agent with
// its role, model, search budget, and typical cost. Data comes from
// lib/agent-info.ts; docs/AGENTS.md is the repo copy of the same table.

import { useState } from "react";
import { AGENT_INFO } from "@/lib/agent-info";

export default function AgentInfo() {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className="btn btn-sm"
        aria-expanded={open}
        aria-label="About the agents: models and costs"
        title="About the agents: models and costs"
        onClick={() => setOpen((v) => !v)}
        style={{
          borderRadius: "50%",
          width: "1.6rem",
          height: "1.6rem",
          padding: 0,
          lineHeight: 1,
          fontStyle: "italic",
          fontFamily: "Georgia, serif",
        }}
      >
        i
      </button>
      {open ? (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            width: "min(680px, 88vw)",
            zIndex: 20,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Your agents: models and costs</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>What it does</th>
                  <th>Model</th>
                  <th>Web searches</th>
                  <th>Avg cost</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(AGENT_INFO).map(([key, a]) => (
                  <tr key={key}>
                    <td className="nowrap">
                      <strong>{a.label}</strong>
                    </td>
                    <td>{a.role}</td>
                    <td className="nowrap">{a.model}</td>
                    <td className="nowrap">{a.searches}</td>
                    <td className="nowrap">{a.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Estimates at list price. A discovery run is Finder, Skeptic, Judge
            for up to 2 rounds; it stops early once it has enough survivors,
            once its spend reaches your per-run budget, or when a worst-case
            call no longer fits in the daily budget.
          </p>
        </div>
      ) : null}
    </span>
  );
}
