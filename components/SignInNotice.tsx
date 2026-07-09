"use client";

// A compact, dismissible version of the "no sign-in on this instance" notice.
// The old version was a full card of text on every Settings visit. This keeps
// the security point one line, tucks the how-to behind an expander, and lets the
// operator dismiss it for good (persisted in a cookie the server reads).
import { useState } from "react";
import { Card } from "@/components/ui";

export default function SignInNotice() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function dismiss() {
    document.cookie = "signin_notice_dismissed=1; path=/; max-age=31536000; samesite=lax";
    setHidden(true);
  }

  return (
    <Card>
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "var(--s3)" }}
      >
        <div>
          <strong>No sign-in on this instance</strong>{" "}
          <span className="muted">Fine for localhost.</span>
          <details style={{ marginTop: "var(--s2)" }}>
            <summary className="muted">How to turn on sign-in</summary>
            <p className="muted" style={{ marginTop: "var(--s2)", marginBottom: 0 }}>
              If this app is ever reachable from another machine, set{" "}
              <code>REQUIRE_LOGIN=true</code> in <code>.env.local</code> and add your
              email to the <code>members</code> table (DEPLOY.md has the steps).
              Without it, anyone who can open this page controls your keys, spend,
              and data.
            </p>
          </details>
        </div>
        <button type="button" className="btn btn-sm" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </Card>
  );
}
