"use client";

// Floating feedback widget, mounted on every authed page from app/layout.tsx.
// Files a GitHub issue via the submitFeedbackIssue server action. Captures:
//  - fields: type / title / details
//  - a page screenshot (auto via modern-screenshot, lazy-loaded; paste or upload to override)
//  - the console/error log (text, from lib/console-capture)
// Org-neutral (white-label): no brand-specific copy. The capture filter skips
// the widget's own mount so it stays out of its own screenshot.
import {
  useState,
  useTransition,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { usePathname } from "next/navigation";
import {
  submitFeedbackIssue,
  type FeedbackType,
} from "@/app/actions";
import { getConsoleText, consoleLineCount } from "@/lib/console-capture";

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const [shot, setShot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [includeShot, setIncludeShot] = useState(true);
  const [includeConsole, setIncludeConsole] = useState(true);

  const [doneUrl, setDoneUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const consoleLines = open ? consoleLineCount() : 0;

  function reset() {
    setType("bug");
    setTitle("");
    setDetails("");
    setShot(null);
    setIncludeShot(true);
    setIncludeConsole(true);
    setDoneUrl(null);
    setError(null);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 150);
  }

  async function openAndCapture() {
    setOpen(true);
    await capture();
  }

  // Auto-capture the current page. modern-screenshot is lazy-loaded so it never
  // ships on the initial bundle; the filter skips the widget's own mount.
  async function capture() {
    setCapturing(true);
    setError(null);
    try {
      const { domToPng } = await import("modern-screenshot");
      const dataUrl = await domToPng(document.body, {
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        filter: (node) =>
          !(
            node instanceof HTMLElement &&
            node.hasAttribute("data-feedback-ignore")
          ),
      });
      setShot(dataUrl);
    } catch {
      setError("Auto-capture failed — paste or upload a screenshot instead.");
    } finally {
      setCapturing(false);
    }
  }

  function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readImage(file);
  }

  function onPaste(e: ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      readImage(file);
    }
  }

  function readImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setShot(reader.result as string);
      setIncludeShot(true);
    };
    reader.readAsDataURL(file);
  }

  function send() {
    if (!title.trim() && !details.trim()) {
      setError("Add a title or some detail first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitFeedbackIssue({
        type,
        title,
        details,
        pagePath: pathname,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        consoleLog: includeConsole ? getConsoleText() : undefined,
        screenshot: includeShot ? shot : null,
      });
      if (res.ok) setDoneUrl(res.url ?? "");
      else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="feedback-mount" data-feedback-ignore>
      {open ? (
        <div
          className="feedback-pop card"
          role="dialog"
          aria-label="Send feedback"
          onPaste={onPaste}
        >
          {doneUrl !== null ? (
            <div className="feedback-done">
              <p className="feedback-done-title">Thanks — issue filed.</p>
              {doneUrl ? (
                <a
                  className="btn btn-sm"
                  href={doneUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on GitHub →
                </a>
              ) : null}
              <button className="btn btn-sm" onClick={close}>
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="feedback-pop-head">
                <strong>Send feedback</strong>
                <button
                  className="feedback-x"
                  onClick={close}
                  aria-label="Close feedback"
                >
                  ×
                </button>
              </div>

              <div className="feedback-types">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={
                      type === t.value
                        ? "chip chip-brand feedback-type-on"
                        : "chip chip-neutral"
                    }
                    onClick={() => setType(t.value)}
                    aria-pressed={type === t.value}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isPending}
              />
              <textarea
                placeholder="What happened / what you expected…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                disabled={isPending}
              />

              {/* Screenshot */}
              <div className="feedback-attach">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={includeShot && !!shot}
                    onChange={(e) => setIncludeShot(e.target.checked)}
                    disabled={!shot || isPending}
                  />
                  Attach screenshot
                </label>
                <div className="feedback-attach-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={capture}
                    disabled={capturing || isPending}
                  >
                    {capturing ? "Capturing…" : shot ? "Recapture" : "Capture"}
                  </button>
                  <label className="btn btn-sm feedback-upload">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onUpload}
                      hidden
                    />
                  </label>
                </div>
              </div>
              {shot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="feedback-shot" src={shot} alt="screenshot preview" />
              ) : (
                <p className="feedback-hint muted">
                  Auto-capture, upload, or paste an image (⌘V).
                </p>
              )}

              {/* Console */}
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={includeConsole}
                  onChange={(e) => setIncludeConsole(e.target.checked)}
                  disabled={isPending}
                />
                Attach console log ({consoleLines} line
                {consoleLines === 1 ? "" : "s"})
              </label>

              {error ? <p className="form-msg form-msg-err">{error}</p> : null}

              <div className="feedback-actions">
                <span className="feedback-hint muted">
                  Filing to <code>{pathname}</code>
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={send}
                  disabled={isPending}
                >
                  {isPending ? "Sending…" : "Send to GitHub"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <button
        className="feedback-fab"
        onClick={() => (open ? close() : openAndCapture())}
        aria-expanded={open}
        aria-label="Send feedback"
      >
        {open ? "×" : "Feedback"}
      </button>
    </div>
  );
}
