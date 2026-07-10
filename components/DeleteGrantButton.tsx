"use client";

// Two-step delete for a grant: arm, then confirm. Soft-deletes via
// deleteGrant (the grant never resurfaces in discovery) and returns to the
// board.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGrant } from "@/app/grants/[id]/actions";

export default function DeleteGrantButton({ grantId }: { grantId: string }) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await deleteGrant(grantId);
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(res.error ?? "Couldn't delete this grant.");
        setArming(false);
      }
    });
  }

  return (
    <div className="stack" style={{ gap: "var(--s2)", alignItems: "flex-end" }}>
      {arming ? (
        <div className="row" style={{ gap: "var(--s2)" }}>
          <button type="button" className="btn btn-sm btn-danger" onClick={go} disabled={pending}>
            {pending ? "Deleting…" : "Yes, delete - never show again"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setArming(false)}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setArming(true)}
          title="Remove this grant for good - discovery will never re-propose it"
        >
          Delete
        </button>
      )}
      {error ? <p className="form-msg form-msg-err">{error}</p> : null}
    </div>
  );
}
