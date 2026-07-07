"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <div style={{ maxWidth: 420, margin: "48px auto" }}>
      <div className="card stack">
        {state.status === "sent" ? (
          <>
            <h1>Check your email</h1>
            <p className="muted">
              We sent a magic sign-in link to{" "}
              <strong style={{ color: "var(--ink)" }}>{state.email}</strong>.
              Open it on this device to finish signing in.
            </p>
          </>
        ) : (
          <>
            <h1>Sign in</h1>
            <p className="muted">
              Enter your email and we&rsquo;ll send you a magic link. No
              password to remember.
            </p>
            <form action={formAction}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@org.com"
                  required
                  autoFocus
                />
              </div>
              {state.status === "error" ? (
                <p
                  role="alert"
                  style={{ color: "var(--tone-bad)", marginBottom: "16px" }}
                >
                  {state.error}
                </p>
              ) : null}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={pending}
              >
                {pending ? "Sending…" : "Send magic link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
