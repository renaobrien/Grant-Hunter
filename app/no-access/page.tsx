"use client";

// Shown to a signed-in user whose email is not in this instance's `members`
// allowlist (the middleware routes them here). The only action is to sign out.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NoAccessPage() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div style={{ maxWidth: 480, margin: "48px auto" }}>
      <div className="card stack">
        <h1>You&rsquo;re not on the member list</h1>
        <p className="muted">
          You&rsquo;re signed in, but your email isn&rsquo;t on this
          instance&rsquo;s member list. Ask the owner to add your email, then
          sign in again.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
