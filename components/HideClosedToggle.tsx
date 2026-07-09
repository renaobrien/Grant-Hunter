"use client";

// Persisted "Hide Closed lane" toggle. The old version used a ?closed=hidden URL
// param, so the preference reset on reload or any nav back to "/". This stores it
// in a cookie the board's server component reads, so it sticks.
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function HideClosedToggle({ hidden }: { hidden: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !hidden;
    document.cookie = `hide_closed=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button type="button" className="btn btn-sm" onClick={toggle} disabled={pending}>
      {hidden ? "Show Closed lane" : "Hide Closed lane"}
    </button>
  );
}
