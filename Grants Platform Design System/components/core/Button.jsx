import React from "react";

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
export function Button({
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
  const classes = [
    "btn",
    variant === "primary" ? "btn-primary" : null,
    size === "sm" ? "btn-sm" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <a className={classes} href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button
      className={classes}
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
