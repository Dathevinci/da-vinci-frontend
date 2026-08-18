"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  NO_ENDORSEMENTS,
  endorsementKey,
  loadEndorsements,
  type EndorsementMap,
  type StampEndorsement,
} from "@/lib/stampEndorsements";
import type { StampMediaType } from "@/lib/stamps";

/**
 * ONE FETCH, ONE MAP, READ BY EVERY COVER ON THE SITE.
 *
 * Mounted once in the root layout. The endorsement set is at most nine titles
 * (three podium curators x three recommendation slots), so this is a single
 * small payload that every card then reads by media id.
 *
 * WHY A CONTEXT AND NOT A PER-CARD SUBSCRIPTION. The house rule for grid
 * surfaces is no per-card network call and no per-card hook that subscribes a
 * listener — a store with a subscriber Set would put one subscribe/unsubscribe
 * effect on every one of forty covers to deliver a value that changes once per
 * page load. useContext costs a read: no effect, no listener, no teardown. The
 * cards pay literally one Map.get each.
 *
 * `children` arrives as a prop from a server component, so this component's own
 * state change re-renders the consumers of the context and nothing else — the
 * page tree below is the same element and React skips it.
 *
 * THE EMPTY CASE IS FREE. Most weeks most readers see no endorsed title on a
 * given page, and setState is skipped entirely when the set comes back empty,
 * so the common path is zero re-renders.
 */

const EndorsementContext = createContext<EndorsementMap>(NO_ENDORSEMENTS);

export function StampEndorsementProvider({ children }: { children: ReactNode }) {
  const [endorsements, setEndorsements] = useState<EndorsementMap>(NO_ENDORSEMENTS);

  useEffect(() => {
    let alive = true;
    // In an effect, never during render: the load reads sessionStorage, which
    // does not exist on the server, and a first client render that disagreed
    // with the server's HTML is a hydration mismatch.
    const pull = () => {
      loadEndorsements().then((map) => {
        // Empty is a legitimate answer (a curator retired their last pick, a
        // fresh week has no podium yet), so the set is replaced rather than
        // only ever grown — a seal must be able to LEAVE a cover.
        if (alive) setEndorsements((prev) => (prev.size === 0 && map.size === 0 ? prev : map));
      });
    };
    pull();

    /**
     * This provider is mounted in the ROOT layout, which the app router keeps
     * alive across every client-side navigation — so a mount-only load runs
     * once per full page load and the TTL below it never fires in a tab that
     * stays open. That made a retired recommendation keep advertising itself
     * site-wide indefinitely. Re-checking when the tab comes back to the
     * foreground gives the TTL somewhere to land, costs nothing while the tab
     * is hidden, and is the same visibility signal the effects and chat
     * pollers already use. loadEndorsements serves memory/session cache when
     * fresh, so a quick tab-switch is free.
     */
    const onVisible = () => {
      if (!document.hidden) pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <EndorsementContext.Provider value={endorsements}>{children}</EndorsementContext.Provider>;
}

/**
 * Is this title endorsed, and by whom? O(1), no request, no effect.
 *
 * Safe outside the provider — the context default is the empty map, so a card
 * rendered anywhere simply wears no seal rather than throwing.
 */
export function useEndorsement(
  mediaType: StampMediaType,
  mediaId: string | number | null | undefined,
): StampEndorsement | null {
  const endorsements = useContext(EndorsementContext);
  if (mediaId === null || mediaId === undefined || mediaId === "") return null;
  return endorsements.get(endorsementKey(mediaType, String(mediaId))) ?? null;
}
