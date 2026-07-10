"use client";

import { useState, useTransition, type FormEvent } from "react";
import { saveAnthropicKey } from "./actions";

// Write-only key management. We never receive the stored key from the server -
// only whether one is set (and where) - so we can't (and shouldn't) show it.
// The user types a new value to set/replace it, or clears it to fall back to
// the env var.
export type KeySource = "dashboard" | "env" | null;

export default function ApiKeysForm({
  hasKey,
  source = null,
}: {
  hasKey: boolean;
  source?: KeySource;
}) {
  const [value, setValue] = useState("");
  const [configured, setConfigured] = useState(hasKey);
  const [savedHere, setSavedHere] = useState(source === "dashboard");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(next: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await saveAnthropicKey(next);
      if (res.ok) {
        const set = next.trim().length > 0;
        // Clearing removes the dashboard copy; an env-provided key (if any)
        // takes over again, but we can't know that from here - report cleared.
        setConfigured(set || (source === "env" && !set));
        setSavedHere(set);
        setValue("");
        setMsg({
          ok: true,
          text: set
            ? "Key saved."
            : source === "env"
            ? "Dashboard key cleared - using the one from .env.local again."
            : "Key cleared.",
        });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit(value);
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="anthropic_api_key">
          Anthropic API key{" "}
          <span className="muted">
            {configured
              ? savedHere
                ? "- configured ✓ (saved here)"
                : "- configured ✓ (from .env.local)"
              : "- not set"}
          </span>
        </label>
        <input
          id="anthropic_api_key"
          type="password"
          autoComplete="off"
          placeholder={
            configured
              ? "Enter a new key to replace it (leave blank to keep)"
              : "sk-ant-…"
          }
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <span className="field-hint">
          Powers grant discovery, drafting, and onboarding. Stored on your own
          database; never shown again after saving. Get one at{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          . Strongly recommended: set a monthly usage limit on the key at{" "}
          <a href="https://console.anthropic.com/settings/limits" target="_blank" rel="noreferrer">
            console.anthropic.com/settings/limits
          </a>{" "}
          too. That ceiling is enforced by Anthropic itself, so your bill stays
          capped even if this app misbehaves.
        </span>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || value.trim().length === 0}
        >
          {pending ? "Saving…" : configured ? "Replace key" : "Save key"}
        </button>
        {savedHere ? (
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => submit("")}
          >
            Clear
          </button>
        ) : null}
        {msg ? (
          <span
            className={`form-msg ${msg.ok ? "form-msg-ok" : "form-msg-err"}`}
            role="status"
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
