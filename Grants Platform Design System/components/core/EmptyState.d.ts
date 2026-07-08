import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** Primary line — what's empty. */
  title: string;
  /** Optional secondary line — how to fill it. */
  hint?: string;
  /** Optional action, usually a Button. */
  action?: ReactNode;
}

/**
 * Centered empty-list placeholder. Mandatory on every list, board column, and
 * table — the product never renders a bare empty container.
 *
 * @startingPoint section="Feedback" subtitle="Mandatory empty-list placeholder" viewport="700x200"
 */
export function EmptyState(props: EmptyStateProps): JSX.Element;
