// The agents reference table: role, model, search budget, typical cost per
// agent. Server-safe (no state, no positioning) - renders as a collapsible
// block inside the Settings "Your agents" card. Data comes from
// lib/agent-info.ts; docs/AGENTS.md is the repo copy of the same table.
import { AGENT_INFO } from "@/lib/agent-info";

export default function AgentInfo() {
  return (
    <details>
      <summary style={{ cursor: "pointer" }}>
        <span aria-hidden="true">&#9432;</span> Models and costs
      </summary>
      <div className="table-wrap" style={{ marginTop: "var(--s3)" }}>
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
        Estimates at list price. A discovery run is Finder, Skeptic, Judge for
        up to 2 rounds. It stops starting new rounds once it has enough
        survivors, once spend reaches your per-run budget, or when a worst-case
        call no longer fits in the daily budget - but a started round always
        finishes, so paid-for searches become judged results.
      </p>
    </details>
  );
}
