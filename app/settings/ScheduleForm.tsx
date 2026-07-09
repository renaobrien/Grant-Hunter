"use client";

// Editable weekly run schedule. Stored as UTC cron in settings.weekly_cron;
// the picker shows a live "that's X in your local time" preview so nobody has
// to do timezone math.
import { useMemo, useState, useTransition } from "react";
import { saveSchedule } from "./actions";

const DAYS: { value: string; label: string }[] = [
  { value: "1", label: "Mondays" },
  { value: "2", label: "Tuesdays" },
  { value: "3", label: "Wednesdays" },
  { value: "4", label: "Thursdays" },
  { value: "5", label: "Fridays" },
  { value: "6", label: "Saturdays" },
  { value: "0", label: "Sundays" },
  { value: "*", label: "Every day" },
];

export default function ScheduleForm({
  initialCron,
  runMode,
}: {
  initialCron: string;
  runMode: string;
}) {
  // Parse "m h * * dow"; fall back to Monday 12:00 UTC.
  const parts = initialCron.trim().split(/\s+/);
  const initMinute = Number(parts[0]);
  const initHour = Number(parts[1]);
  const initDow = parts[4] ?? "1";

  const [dow, setDow] = useState(DAYS.some((d) => d.value === initDow) ? initDow : "1");
  const [time, setTime] = useState(
    `${String(Number.isInteger(initHour) ? initHour : 12).padStart(2, "0")}:${String(
      Number.isInteger(initMinute) ? initMinute : 0,
    ).padStart(2, "0")}`,
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [hour, minute] = time.split(":").map((n) => parseInt(n, 10));

  // Live local-time preview of the chosen UTC schedule.
  const localPreview = useMemo(() => {
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    const now = new Date();
    const utc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute),
    );
    return utc.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [hour, minute]);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveSchedule({ dow, hour, minute });
      setMsg(res.ok ? { ok: true, text: "Schedule saved." } : { ok: false, text: res.error });
    });
  }

  const cron = `${Number.isInteger(minute) ? minute : 0} ${
    Number.isInteger(hour) ? hour : 12
  } * * ${dow}`;

  return (
    <div className="stack" style={{ gap: "var(--s3)" }}>
      <div className="row" style={{ gap: "var(--s2)", flexWrap: "wrap", alignItems: "center" }}>
        <select
          aria-label="Day of week"
          value={dow}
          onChange={(e) => setDow(e.target.value)}
          disabled={pending}
          className="status-select"
        >
          {DAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <span className="muted">at</span>
        <input
          aria-label="Time (UTC)"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={pending}
          style={{ width: "auto" }}
        />
        <span className="muted">
          UTC{localPreview ? ` (${localPreview} your time)` : ""}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save schedule"}
        </button>
      </div>

      {msg ? (
        <p className={`form-msg ${msg.ok ? "form-msg-ok" : "form-msg-err"}`} style={{ margin: 0 }}>
          {msg.text}
        </p>
      ) : null}

      {runMode === "local" ? (
        <p className="muted" style={{ margin: 0 }}>
          Runs automatically at this time while the app is running on this
          computer.
        </p>
      ) : runMode === "github" ? (
        <p className="muted" style={{ margin: 0 }}>
          Cloud runs read their own schedule: put this line in{" "}
          <code>.github/workflows/discovery.yml</code> under{" "}
          <code>schedule:</code> too: <code>- cron: &quot;{cron}&quot;</code>
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Run mode is manual, so nothing fires automatically - the schedule
          applies if you switch to automatic runs.
        </p>
      )}
    </div>
  );
}
