"use client";

// Renders a timestamp in the visitor's timezone. The first render (server and
// initial client pass) uses a deterministic UTC string so hydration matches;
// after mount it swaps to the browser's local zone.
import { useEffect, useState } from "react";

const UTC_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function LocalTime({ iso }: { iso: string | null }) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) return;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    setLocal(
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(d),
    );
  }, [iso]);

  if (!iso) return <>-</>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <>-</>;

  return <time dateTime={iso}>{local ?? `${UTC_FMT.format(d)} UTC`}</time>;
}
