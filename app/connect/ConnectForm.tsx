"use client";

// First-run connect wizard (client side). Two modes:
//   "form"   - collect Supabase creds, verify, write .env.local
//   "schema" - env exists but tables are missing: show the SQL step directly
// White-label: brand-neutral copy; the user connects THEIR OWN Supabase.
import { useEffect, useState, useTransition } from "react";
import { verifyAndSave, recheckSchema, type ConnectResult } from "./actions";

const CONNECTED_FLAG = "gh-connected";

export default function ConnectForm({
  mode,
  initialRef = "",
  schemaSql,
}: {
  mode: "form" | "schema";
  initialRef?: string;
  schemaSql: string | null;
}) {
  const [step, setStep] = useState<"form" | "schema">(mode);
  const [refOrUrl, setRefOrUrl] = useState(initialRef);
  const [anonKey, setAnonKey] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [projectRef, setProjectRef] = useState(initialRef);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [staleEnv, setStaleEnv] = useState(false);
  const [pending, startTransition] = useTransition();

  // If we previously "connected" and still land back on this form, the dev
  // server didn't pick up the new .env.local - tell the user to restart once.
  useEffect(() => {
    if (mode === "form" && sessionStorage.getItem(CONNECTED_FLAG)) {
      setStaleEnv(true);
    }
  }, [mode]);

  function finish() {
    sessionStorage.setItem(CONNECTED_FLAG, "1");
    window.location.assign("/");
  }

  function handleResult(res: ConnectResult) {
    if (res.ref) setProjectRef(res.ref);
    if (res.status === "ok") {
      setNotice("Connected. Taking you to onboarding…");
      finish();
    } else if (res.status === "schema_missing") {
      setError(null);
      setStep("schema");
    } else {
      setError(res.message);
    }
  }

  function submit() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      handleResult(await verifyAndSave({ refOrUrl, anonKey, serviceKey, anthropicKey }));
    });
  }

  function recheck() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await recheckSchema(
        serviceKey ? { refOrUrl: projectRef || refOrUrl, serviceKey } : undefined,
      );
      if (res.status === "ok") {
        setNotice("Tables found. Taking you to onboarding…");
        finish();
      } else if (res.status === "schema_missing") {
        setError("Still can't see the tables. Did the SQL finish without errors?");
      } else {
        setError(res.message);
      }
    });
  }

  async function copySql() {
    if (!schemaSql) return;
    await navigator.clipboard.writeText(schemaSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "schema") {
    const sqlEditorUrl = projectRef
      ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
      : "https://supabase.com/dashboard";
    return (
      <div className="card stack">
        <div>
          <h1>One last step: create the tables</h1>
          <p className="muted">
            Your database is connected but empty. Copy the SQL below, paste it
            into your Supabase SQL editor, click <strong>Run</strong>, then come
            back and hit <strong>Check again</strong>.
          </p>
        </div>

        {schemaSql ? (
          <>
            <div className="row" style={{ gap: "var(--s2)" }}>
              <button type="button" className="btn" onClick={copySql}>
                {copied ? "Copied ✓" : "Copy the SQL"}
              </button>
              <a
                className="btn btn-primary"
                href={sqlEditorUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open your SQL editor ↗
              </a>
            </div>
            <textarea
              readOnly
              value={schemaSql}
              rows={12}
              style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
            />
          </>
        ) : (
          <p>
            Couldn&rsquo;t read the bundled SQL files. Fallback: in a terminal run{" "}
            <code>npx supabase link</code> then <code>npm run db:push</code>.
          </p>
        )}

        {error ? <p className="form-msg form-msg-err">{error}</p> : null}
        {notice ? <p className="form-msg form-msg-ok">{notice}</p> : null}

        <div className="onb-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={recheck}
            disabled={pending}
          >
            {pending ? "Checking…" : "I ran it - check again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card stack">
      <div>
        <h1>Connect your database</h1>
        <p className="muted">
          Everything you find and write lives in your own free Supabase project.
          Create one at{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
            supabase.com
          </a>{" "}
          (New project, any name), then copy three values from{" "}
          <strong>Project Settings</strong>. Takes about 3 minutes.
        </p>
      </div>

      {staleEnv ? (
        <p className="form-msg form-msg-err">
          Your details were saved, but the server hasn&rsquo;t picked them up.
          Stop the app (Ctrl+C in the terminal), run <code>npm run dev</code>{" "}
          again, and reload this page.
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="c-ref">
          Project ref <span className="req">*</span>
        </label>
        <input
          id="c-ref"
          type="text"
          value={refOrUrl}
          onChange={(e) => setRefOrUrl(e.target.value)}
          placeholder="e.g. abcdefghijklmnopqrst - or paste any project URL"
          disabled={pending}
        />
        <span className="field-hint">
          Project Settings -&gt; General -&gt; Reference ID. Pasting the
          dashboard URL from your browser works too.
        </span>
      </div>

      <div className="field">
        <label htmlFor="c-anon">
          anon / publishable key <span className="req">*</span>
        </label>
        <input
          id="c-anon"
          type="password"
          autoComplete="off"
          value={anonKey}
          onChange={(e) => setAnonKey(e.target.value)}
          placeholder="eyJ… (safe for browsers)"
          disabled={pending}
        />
        <span className="field-hint">
          Project Settings -&gt; API keys -&gt; <code>anon</code>{" "}
          <code>public</code> (a.k.a. Publishable).
        </span>
      </div>

      <div className="field">
        <label htmlFor="c-service">
          service_role / secret key <span className="req">*</span>
        </label>
        <input
          id="c-service"
          type="password"
          autoComplete="off"
          value={serviceKey}
          onChange={(e) => setServiceKey(e.target.value)}
          placeholder="eyJ… (secret - stays on this machine)"
          disabled={pending}
        />
        <span className="field-hint">
          Same page -&gt; <code>service_role</code> <code>secret</code>, click
          Reveal. Saved only to <code>.env.local</code> on this computer.
        </span>
      </div>

      <div className="field">
        <label htmlFor="c-anthropic">
          Anthropic API key <span className="muted">(optional)</span>
        </label>
        <input
          id="c-anthropic"
          type="password"
          autoComplete="off"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder="sk-ant-…"
          disabled={pending}
        />
        <span className="field-hint">
          The AI the agents spend. Skip it now and add it later in Settings
          -&gt; API keys.
        </span>
      </div>

      {error ? <p className="form-msg form-msg-err">{error}</p> : null}
      {notice ? <p className="form-msg form-msg-ok">{notice}</p> : null}

      <div className="onb-actions">
        <span className="muted onb-hint">
          {pending ? "Checking your project…" : ""}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={pending || !refOrUrl.trim() || !anonKey.trim() || !serviceKey.trim()}
        >
          {pending ? "Connecting…" : "Connect"}
        </button>
      </div>
    </div>
  );
}
