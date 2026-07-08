import React from "react";

/**
 * EmptyState — the mandatory placeholder for any empty list, board column, or
 * table. Centered title + optional hint + optional action button. Every list in
 * the product renders one of these instead of showing nothing.
 */
export function EmptyState({ title, hint, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {hint ? <p className="empty-hint">{hint}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}
