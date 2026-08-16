import { authHeaders } from "./authToken";

// Award Arise Points for a content action. The BACKEND fixes the payout and
// dedups per key, so calling this repeatedly for the same chapter/title is
// harmless — only the first time pays. Best-effort: never throws, never blocks
// reading. On an award it syncs the cached user balance so the navbar updates.
//
//   read  → key "manhwa:<id>:<chapterId>" | "novel:<id>:<chapterId>"
//   track → key "manhwa:<id>"             | "novel:<id>"
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function earnPoints(userId: string, action: "read" | "track", key: string): Promise<void> {
  if (!userId || !key) return;
  try {
    const res = await fetch(`${API_URL}/api/users/${userId}/earn`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action, key }),
    });
    const data = await res.json();

    /**
     * THE CAP MUST SAY SO — ONCE. When the daily AP cap is reached the server
     * pays nothing and explains why, but this client swallowed that message,
     * so a capped afternoon was indistinguishable from a broken economy —
     * which is exactly how it got reported. One notice per day: after the
     * first, staying quiet is correct (a nag per chapter would be worse).
     * Investigated against the live ledger before touching anything: earns
     * for every mode and source were landing fine; the silence was the bug.
     */
    if (data?.success && data.capped) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        if (localStorage.getItem("dv-ap-cap-notice") !== today) {
          localStorage.setItem("dv-ap-cap-notice", today);
          window.dispatchEvent(
            new CustomEvent("davinci_toast", {
              detail: { message: "Daily Arise Points cap reached — earning resumes tomorrow.", type: "info" },
            })
          );
        }
      } catch {
        /* notice is best-effort */
      }
    }

    if (data?.success && data.awarded && data.data) {
      try {
        const stored = localStorage.getItem("davinci_user");
        if (stored) {
          const u = JSON.parse(stored);
          u.arisePoints = data.data.arisePoints;
          u.xp = data.data.xp;
          localStorage.setItem("davinci_user", JSON.stringify(u));
          window.dispatchEvent(new Event("davinci_user_updated"));
        }
      } catch {
        /* cache sync is optional */
      }
    }
  } catch {
    /* earning is best-effort */
  }
}
