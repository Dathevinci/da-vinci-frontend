/**
 * Stop a canvas effect's animation loop when nobody is actually looking at it.
 *
 * The profile effects are `absolute inset-0` canvases inside the hero. The hero
 * scrolls away almost immediately — the collection below it is most of the
 * page — but the rAF loop kept running at full tilt, clearing, gradient-filling
 * and shadow-blurring a hero-sized canvas sixty times a second for nobody.
 *
 * This is a PLAIN FUNCTION, deliberately, not a hook: it is called from inside
 * `useEffect` bodies where hooks are illegal.
 *
 * The two "not being seen" signals are tracked SEPARATELY so a tab hide→show
 * can't resume a loop the IntersectionObserver had parked because the card was
 * scrolled off-screen (and vice versa). Lifted verbatim from the pattern
 * already proven in InfiniteVoid / CrimsonRealm / DejavuEcho.
 *
 * Callers own their own `paused` flag and rAF handle:
 *
 *   let paused = false;
 *   const frame = () => { ...; if (!paused) raf = requestAnimationFrame(frame); };
 *   raf = requestAnimationFrame(frame);
 *   const detach = attachVisibilityPause(canvas, {
 *     onPause:  () => { paused = true;  cancelAnimationFrame(raf); },
 *     onResume: () => { paused = false; last = performance.now(); raf = requestAnimationFrame(frame); },
 *   });
 *   return () => { detach(); ... };
 *
 * Resetting the effect's own time base in `onResume` matters: without it a
 * clock that was parked for a minute jumps a minute forward on the next frame
 * and the animation lurches.
 */
export function attachVisibilityPause(
  el: Element | null | undefined,
  handlers: { onPause: () => void; onResume: () => void }
): () => void {
  if (typeof document === "undefined") return () => {};

  let hidden = document.hidden;
  let offscreen = false;
  let paused = false;

  const sync = () => {
    const shouldPause = hidden || offscreen;
    if (shouldPause === paused) return;
    paused = shouldPause;
    if (paused) handlers.onPause();
    else handlers.onResume();
  };

  const onVis = () => {
    hidden = document.hidden;
    sync();
  };
  document.addEventListener("visibilitychange", onVis);

  const io =
    el && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([e]) => {
          offscreen = !e.isIntersecting;
          sync();
        }, { threshold: 0 })
      : null;
  if (el && io) io.observe(el);

  return () => {
    document.removeEventListener("visibilitychange", onVis);
    io?.disconnect();
  };
}
