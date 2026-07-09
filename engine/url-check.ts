// url-check.ts - shared URL liveness check. Models sometimes cite pages that
// 404 (moved, hallucinated, or stale search results), and links that were live
// at discovery time rot later. Both discovery (before a grant reaches the board)
// and the jobs sweep (periodic re-validation) use this.

export const URL_CHECK_TIMEOUT_MS = 8_000;

export const isHttp = (u?: string | null): u is string =>
  !!u && /^https?:\/\//i.test(u);

/** true = URL responds (2xx/3xx; 401/403 count - many portals gate content). */
export async function urlAlive(url: string): Promise<boolean> {
  const attempt = async (method: "HEAD" | "GET"): Promise<boolean | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), URL_CHECK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; GrantHunter/1.0; link check)" },
      });
      if (res.ok) return true;
      // Auth-gated portals still prove the page exists.
      if (res.status === 401 || res.status === 403) return true;
      // Some servers reject HEAD outright - retry those as GET.
      if (method === "HEAD" && (res.status === 405 || res.status === 501)) return null;
      return false;
    } catch {
      return method === "HEAD" ? null : false; // network/timeout: retry HEAD as GET once
    } finally {
      clearTimeout(timer);
    }
  };
  const head = await attempt("HEAD");
  if (head !== null) return head;
  return (await attempt("GET")) === true;
}
