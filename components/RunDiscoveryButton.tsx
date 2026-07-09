"use client";

// One-click discovery with a spend confirm. After starting, poll
// router.refresh() so the agent_runs row (and later, new grants) appear
// without a manual reload.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startDiscovery } from "@/app/runs/actions";

const POLL_MS = 5000;
const POLL_FOR_MS = 10 * 60 * 1000;

export default function RunDiscoveryButton({ label = "Run discovery now" }: { label?: string }) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pollUntil = useRef(0);

  useEffect(() => {
    if (!started) return;
    pollUntil.current = Date.now() + POLL_FOR_MS;
    const t = setInterval(() => {
      if (Date.now() > pollUntil.current) {
        clearInterval(t);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [started, router]);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await startDiscovery();
      if (res.ok) {
        setStarted(true);
        setArming(false);
        router.refresh();
      } else {
        setError(res.error);
        setArming(false);
      }
    });
  }

  if (started) {
    return (
      <p className="form-msg form-msg-ok" role="status">
        Discovery started - agents are searching. Fresh results appear below and
        on the board as they land (a run takes a few minutes).
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--s2)" }}>
      {arming ? (
        <div className="row" style={{ gap: "var(--s2)" }}>
          <button type="button" className="btn btn-primary" onClick={go} disabled={pending}>
            {pending ? "Starting…" : "Yes, spend a few dollars"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setArming(false)}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <button type="button" className="btn btn-primary" onClick={() => setArming(true)}>
            {label}
          </button>
        </div>
      )}
      {arming ? (
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          A run uses your Anthropic API credit (typically a few dollars, capped
          by your daily budget in Settings).
        </span>
      ) : null}
      {error ? <p className="form-msg form-msg-err">{error}</p> : null}
    </div>
  );
}
