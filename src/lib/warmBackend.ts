/**
 * ONE fire-and-forget ping at the backend per session.
 *
 * The API lives on a Render free tier that sleeps after idle; the first real
 * request of a visit used to pay the multi-second cold start ON a page that
 * needed its answer. Pinging /health from the nav (which mounts on every
 * page) starts the wake-up the moment the site opens, so by the time anyone
 * reaches a game page the dyno is already standing.
 */
let warmed = false;

export function warmBackend() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  fetch(`${api}/health`).catch(() => { /* it was only a knock */ });
}
