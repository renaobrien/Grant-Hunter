"use client";

// While a discovery run is in progress, refresh the board every few seconds so
// grants appear as they land (a light "live progress" without wiring SSE). Does
// nothing when idle.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BoardAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 12_000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
