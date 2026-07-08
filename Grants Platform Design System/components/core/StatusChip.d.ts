export type GrantStatus =
  | "found"
  | "researching"
  | "drafting"
  | "applied"
  | "submitted"
  | "awarded"
  | "passed"
  | "discarded"
  | "dead";

export interface StatusChipProps {
  /** One of the nine grant statuses; tone + label are derived automatically. */
  status: GrantStatus;
}

/**
 * A Chip whose color + label are mapped from a grant status. Use everywhere a
 * grant's status is displayed so the status↔tone mapping stays consistent.
 *
 * @startingPoint section="Data display" subtitle="Grant-status pill (auto tone)" viewport="700x140"
 */
export function StatusChip(props: StatusChipProps): JSX.Element;
