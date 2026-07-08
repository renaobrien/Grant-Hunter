import React from "react";

/**
 * FieldRow — a labeled row for detail views: a 160px label column and a value
 * column, divided by a hairline. Collapses to stacked single-column under 900px.
 * The building block of the grant-detail Assessment card and Settings.
 */
export function FieldRow({ label, children }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value">{children}</span>
    </div>
  );
}
