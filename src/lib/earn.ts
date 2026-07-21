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
