// instrumentation.ts - Next.js runs register() once per server start. We use
// it to boot the local run scheduler (run_mode = "local" instances only; see
// lib/scheduler.ts). Node runtime only - the edge pass has no child_process.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLocalScheduler } = await import("./lib/scheduler");
    startLocalScheduler();
  }
}
