"use client";

// Floating feedback widget, on every authed page (mounted from app/layout.tsx).
// Token-free: instead of the app posting an issue (which would need a GitHub
// token baked into every fork), it opens GitHub's own "New issue" page for the
// target repo with the fields + console log pre-filled. The submitter files it
// under their own GitHub login. The page screenshot is copied to their clipboard
// so it's a single paste (⌘V) in the issue — GitHub hosts the image for free.
//
// Target repo: NEXT_PUBLIC_FEEDBACK_REPO ("owner/repo"), default below. Public
// by design — it's just a repo name, no secret.
import {
  useState,
  useTransition,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { usePathname } from "next/navigation";
import { getConsoleText, consoleLineCount } from "@/lib/console-capture";

type FeedbackType = "bug" | "idea" | "other";

const FEEDBACK_REPO =
  process.env.NEXT_PUBLIC_FEEDBACK_REPO || "renaobrien/grants-platform";

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

// Keep the prefilled issue URL comfortably under browser length limits.
const MAX_CONSOLE_CHARS = 1800;

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

  const [done, setDone] = useState<null | { url: string; shotCopied: boolean }>(
    null,
  );
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
    setDone(null);
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
      setError("Auto-capture failed — upload or paste a screenshot instead.");
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

  // Best-effort: put the screenshot on the clipboard so it's a single ⌘V in the
  // GitHub issue. Fails silently on browsers without image clipboard support.
  async function copyShotToClipboard(): Promise<boolean> {
    if (!includeShot || !shot) return false;
    try {
      const blob = await (await fetch(shot)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  function buildBody(shotCopied: boolean): string {
    const meta = [
      `**Type:** ${type}`,
      `**Page:** \`${pathname}\``,
      typeof navigator !== "undefined"
        ? `**User agent:** ${navigator.userAgent}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const consoleText = includeConsole ? getConsoleText().trim() : "";
    const consoleBlock = consoleText
      ? `\n\n<details><summary>Console log</summary>\n\n\`\`\`\n${consoleText.slice(-MAX_CONSOLE_CHARS)}\n\`\`\`\n\n</details>`
      : "";

    const shotLine =
      includeShot && shot
        ? shotCopied
          ? "\n\n_📎 Screenshot is on your clipboard — paste it here with ⌘V / Ctrl+V._"
          : "\n\n_📎 Attach your screenshot here (drag it in or paste)._"
        : "";

    return `${meta}\n\n### Details\n\n${details.trim() || "_(none)_"}${shotLine}${consoleBlock}`;
  }

  function submit() {
    if (!title.trim() && !details.trim()) {
      setError("Add a title or some detail first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const shotCopied = await copyShotToClipboard();
      const issueTitle = title.trim() || details.trim().split("\n")[0].slice(0, 80);
      const url =
        `https://github.com/${FEEDBACK_REPO}/issues/new` +
        `?labels=${encodeURIComponent(`feedback,${type}`)}` +
        `&title=${encodeURIComponent(issueTitle)}` +
        `&body=${encodeURIComponent(buildBody(shotCopied))}`;
      window.open(url, "_blank", "noopener,noreferrer");
      setDone({ url, shotCopied });
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
          {done ? (
            <div className="feedback-done">
              <p className="feedback-done-title">
                Opened GitHub in a new tab.
                {done.shotCopied
                  ? " Paste your screenshot (⌘V) and submit."
                  : " Submit it there to finish."}
              </p>
              <a
                className="btn btn-sm"
                href={done.url}
                target="_blank"
                rel="noreferrer"
              >
                Reopen
              </a>
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

              <div className="feedback-attach">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={includeShot && !!shot}
                    onChange={(e) => setIncludeShot(e.target.checked)}
                    disabled={!shot || isPending}
                  />
                  Include screenshot
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

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={includeConsole}
                  onChange={(e) => setIncludeConsole(e.target.checked)}
                  disabled={isPending}
                />
                Include console log ({consoleLines} line
                {consoleLines === 1 ? "" : "s"})
              </label>

              {error ? <p className="form-msg form-msg-err">{error}</p> : null}

              <div className="feedback-actions">
                <span className="feedback-hint muted">
                  Opens an issue on <code>{FEEDBACK_REPO}</code>
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={submit}
                  disabled={isPending}
                >
                  {isPending ? "Opening…" : "Open GitHub issue"}
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
