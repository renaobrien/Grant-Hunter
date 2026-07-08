import React from "react";

/**
 * Card — the base surface. White, 1px --line border, --radius corners, soft
 * --shadow, --s3 padding. Pass className="card-ethos" for the accent left-border
 * variant used by the trust-anchor card on grant detail.
 */
export function Card({ children, className, style }) {
  return (
    <div className={className ? `card ${className}` : "card"} style={style}>
      {children}
    </div>
  );
}
