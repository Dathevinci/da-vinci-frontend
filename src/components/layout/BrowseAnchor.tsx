"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isBrowseSurface, rememberBrowse } from "@/lib/browseAnchor";

/**
 * Records the last browse surface, so the readers can offer one tap back to it.
 * Renders nothing.
 *
 * Two triggers, because one is not enough:
 *
 *  - On pathname change, which catches arriving at a browse page.
 *  - On pointerdown while ON a browse page, which catches the QUERY. Explore
 *    writes its filters with router.replace, so the path never changes and a
 *    pathname-only effect would store the bare grid and lose the genre you had
 *    picked. Any click that leads away is preceded by a pointerdown on the page
 *    you are leaving, so snapshotting there captures the filters as they were.
 *
 * Reads window.location.search directly rather than useSearchParams: that hook
 * without a Suspense boundary fails `next build` on this project, and a
 * convenience feature must never be able to take the site down.
 */
export default function BrowseAnchor() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !isBrowseSurface(pathname)) return;

    const snapshot = () => rememberBrowse(window.location.pathname + window.location.search);
    snapshot();

    document.addEventListener("pointerdown", snapshot, { passive: true });
    return () => document.removeEventListener("pointerdown", snapshot);
  }, [pathname]);

  return null;
}
