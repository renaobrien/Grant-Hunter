// Client-side ring buffer of console output + uncaught errors, so the feedback
// button can attach "what the console showed" to a GitHub issue. Browser-only;
// installed once from <ConsoleCapture /> mounted in the root layout.

type Level = "log" | "info" | "warn" | "error" | "debug";
interface Entry {
  level: Level;
  text: string;
  ts: number;
}

const MAX = 200;
const buffer: Entry[] = [];
let installed = false;

function fmt(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function push(level: Level, args: unknown[]) {
  buffer.push({ level, text: args.map(fmt).join(" "), ts: Date.now() });
  if (buffer.length > MAX) buffer.shift();
}

// Browser extensions (MetaMask, wallets, etc.) inject scripts into every page
// and throw unhandled rejections that have nothing to do with this app - they
// just clutter the console, the dev overlay, and captured feedback. Detect
// those and swallow them.
function isExtensionNoise(text: string): boolean {
  return /chrome-extension:\/\/|moz-extension:\/\/|safari-web-extension:\/\/|metamask/i.test(
    text,
  );
}

export function installConsoleCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  (["log", "info", "warn", "error", "debug"] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      push(level, args);
      original(...args);
    };
  });

  window.addEventListener("error", (e) => {
    if (isExtensionNoise(`${e.message} ${e.filename}`)) {
      e.preventDefault();
      return;
    }
    push("error", [e.message, `${e.filename}:${e.lineno}:${e.colno}`]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    const text =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}\n${reason.stack ?? ""}`
        : String(reason);
    // Swallow wallet/extension noise (e.g. "Failed to connect to MetaMask") so it
    // stops hitting the console, the Next dev overlay, and feedback captures.
    if (isExtensionNoise(text)) {
      e.preventDefault();
      return;
    }
    push("error", ["unhandledrejection", reason]);
  });
}

export function consoleLineCount(): number {
  return buffer.length;
}

export function getConsoleText(): string {
  return buffer
    .map(
      (e) =>
        `[${new Date(e.ts).toISOString()}] ${e.level.toUpperCase()}: ${e.text}`,
    )
    .join("\n");
}
