"use client";

// Editable weekly run schedule, shown and edited in the viewer's LOCAL time so
// nobody has to do timezone math. Storage stays UTC cron (settings.weekly_cron),
// because GitHub Actions cron and the in-app scheduler both run in UTC - we
// convert local <-> UTC here, at the edges.
import { useEffect, useMemo, useState, useTransition } from "react";
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

const pad = (n: number) => String(n).padStart(2, "0");
const validDow = (v: string) => DAYS.some((d) => d.value === v);

// Convert a schedule (day-of-week + time) from local to UTC, or UTC to local.
// Uses today as a reference date, so the day-of-week shifts correctly when the
// time crosses midnight in the other zone (e.g. local Mon 11pm -> UTC Tue).
function toUtc(dow: string, hour: number, minute: number) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (dow === "*") return { dow: "*", hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  const shift = (((Number(dow) - d.getDay()) % 7) + 7) % 7;
  d.setDate(d.getDate() + shift);
  return { dow: String(d.getUTCDay()), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}
function toLocal(dow: string, hour: number, minute: number) {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  if (dow === "*") return { dow: "*", hour: d.getHours(), minute: d.getMinutes() };
  const shift = (((Number(dow) - d.getUTCDay()) % 7) + 7) % 7;
  d.setUTCDate(d.getUTCDate() + shift);
  return { dow: String(d.getDay()), hour: d.getHours(), minute: d.getMinutes() };
}

export default function ScheduleForm({
  initialCron,
  runMode,
}: {
  initialCron: string;
  runMode: string;
}) {
  // Parse the stored UTC cron "m h * * dow"; fall back to Monday 12:00 UTC.
  const parts = initialCron.trim().split(/\s+/);
  const utcMinute = Number.isInteger(Number(parts[0])) ? Number(parts[0]) : 0;
  const utcHour = Number.isInteger(Number(parts[1])) ? Number(parts[1]) : 12;
  const utcDow = validDow(parts[4] ?? "1") ? (parts[4] as string) : "1";

  // State is LOCAL. Before mount it mirrors the raw UTC values (a tz-neutral,
  // server-safe placeholder so hydration matches); on mount we convert to local.
  const [dow, setDow] = useState(utcDow);
  const [time, setTime] = useState(`${pad(utcHour)}:${pad(utcMinute)}`);
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const l = toLocal(utcDow, utcHour, utcMinute);
    setDow(l.dow);
    setTime(`${pad(l.hour)}:${pad(l.minute)}`);
    setMounted(true);
    // Convert once, off the stored UTC schedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [hour, minute] = time.split(":").map((n) => parseInt(n, 10));
  const timeValid = Number.isInteger(hour) && Number.isInteger(minute);

  // What the local choice becomes in UTC - shown for transparency and used for
  // the GitHub Actions cron line. Client-only (after mount) so locale/zone
  // formatting can't mismatch the server.
  const utcView = useMemo(() => {
    if (!mounted || !timeValid) return null;
    const u = toUtc(dow, hour, minute);
    const tz =
      new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? "local";
    return {
      tz,
      utcTime: `${pad(u.hour)}:${pad(u.minute)} UTC`,
      cron: `${u.minute} ${u.hour} * * ${u.dow}`,
    };
  }, [mounted, dow, hour, minute, timeValid]);

  function save() {
    if (!timeValid) return;
    setMsg(null);
    const u = toUtc(dow, hour, minute);
    startTransition(async () => {
      const res = await saveSchedule({ dow: u.dow, hour: u.hour, minute: u.minute });
      setMsg(res.ok ? { ok: true, text: "Schedule saved." } : { ok: false, text: res.error });
    });
  }

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
          aria-label="Time (your local time)"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={pending}
          style={{ width: "auto" }}
        />
        <span className="muted">
          {utcView ? utcView.tz : "local time"}
          {utcView ? ` (= ${utcView.utcTime})` : ""}
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
          <code>.github/workflows/discovery.yml</code> under <code>schedule:</code>{" "}
          (GitHub cron is always UTC):{" "}
          <code>- cron: &quot;{utcView ? utcView.cron : initialCron}&quot;</code>
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
