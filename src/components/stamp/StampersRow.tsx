"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Stamp } from "lucide-react";
import { StampSeal } from "@/components/stamp/StampSeal";
import { StampMediaType, StampRec, fetchStampersFor } from "@/lib/stamps";

/**
 * "WHO STAMPED THIS?" — the reverse of the whole system, on the title's own page.
 *
 * Every other stamp surface reads OUTWARD from a curator: their profile, their
 * three slots, their row on the board. Nothing read INWARD from a title, so the
 * only way to learn that four people you respect had all recommended the same
 * manhwa was to open four profiles and notice. This row is that answer, sitting
 * directly under the Stamp This button — the two halves of the same question,
 * in the same place: who else put their name on this, and will you.
 *
 * THREE THINGS IT COSTS, AND NO MORE:
 *
 *  · ONE REQUEST PER TITLE VIEW. The list arrives whole, already ordered by the
 *    server (podium curators first, then grade, then newest) and already
 *    carrying each curator's username, avatar, grade and seal. Nothing here
 *    fans out per curator — a per-name lookup is exactly the N+1 that was taken
 *    out of the feed and it is not coming back through a detail page.
 *  · NOTHING AT ALL WHEN NOBODY HAS STAMPED IT, which is the ordinary case for
 *    most titles: no heading, no empty state, no reserved space. An empty
 *    answer renders null and the page is as it was.
 *  · NO ANIMATION, no canvas, no backdrop-filter. This mounts inside a hero
 *    that is already paying for framer-motion and a blurred backdrop; adding a
 *    fourth compositing layer under it is how a detail page starts dropping
 *    frames on a phone.
 *
 * THE SEAL IS ONLY FOR THE PEOPLE WEARING ONE. `ownerRank` is last week's
 * podium — at most three members site-wide hold it — so at most three struck
 * SVGs can ever render in this row no matter how many curators are in it.
 * Everyone else gets their avatar and their grade letter, which is the same
 * treatment the board's own hundred rows use, for the same reason.
 */

/** How many chips are drawn before the row asks. Eight fills two lines on a
 *  phone and one on a laptop — past that the row stops being a row. The rest
 *  are already in hand, so revealing them costs no request. */
const SHOWN = 8;

export default function StampersRow({
  mediaType,
  mediaId,
  className = "",
}: {
  mediaType: StampMediaType;
  /** The SAME id the stamp was created with on this page — pass whatever the
   *  StampThis beside it passes, or the row will look up a title nobody
   *  stamped. */
  mediaId: string | null | undefined;
  className?: string;
}) {
  const [stampers, setStampers] = useState<StampRec[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const id = String(mediaId || "");
    // Reset before the fetch, not after it: without this the previous title's
    // curators stay on screen under the new title's name for a whole round
    // trip, which reads as a wrong answer rather than a pending one.
    setStampers([]);
    setExpanded(false);
    if (!id) return;

    const ac = new AbortController();
    fetchStampersFor(mediaType, id, null, ac.signal)
      .then(setStampers)
      // Silent. This is an ornament on someone else's page — a failed read
      // means the row is not drawn, never that the detail page shows an error
      // about a feature the reader did not ask for.
      .catch(() => {});
    return () => ac.abort();
  }, [mediaType, mediaId]);

  if (stampers.length === 0) return null;

  const shown = expanded ? stampers : stampers.slice(0, SHOWN);
  const hidden = stampers.length - shown.length;

  return (
    <section
      aria-label="Curators who stamped this"
      className={`mx-auto w-full max-w-2xl font-mono ${className}`}
    >
      <p className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        <Stamp className="h-3.5 w-3.5 text-amber-300" />
        Stamped by {stampers.length} {stampers.length === 1 ? "curator" : "curators"}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {shown.map((rec) => (
          <Link
            key={rec.id}
            href={`/user/${encodeURIComponent(rec.ownerUsername)}`}
            /* The blurb, where a blurb belongs on a chip this size: on hover
               and in the accessible name, so the row stays one line tall while
               still carrying the reason they recommended it. */
            title={
              rec.blurb
                ? `${rec.ownerUsername}: “${rec.blurb}”`
                : `${rec.ownerUsername} stamped this — open their stamp`
            }
            className="flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3 transition hover:border-amber-400/40 hover:bg-white/[0.08]"
          >
            {rec.ownerRank && rec.ownerGrade ? (
              /* A DIV, not a span: an anchor may wrap flow content, phrasing
                 markup may not, and StampSeal's root element is not ours to
                 assume. */
              <div className="h-8 w-8 shrink-0">
                <StampSeal
                  fluid
                  username={rec.ownerUsername}
                  grade={rec.ownerGrade}
                  size="sm"
                  rank={rec.ownerRank}
                />
              </div>
            ) : rec.ownerAvatar ? (
              <img
                src={rec.ownerAvatar}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/15"
              />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-700 text-[11px] font-black text-white">
                {(rec.ownerUsername || "?").charAt(0).toUpperCase()}
              </span>
            )}

            <span className="min-w-0 truncate text-xs font-black text-white">
              {rec.ownerUsername}
            </span>

            {rec.ownerGrade && (
              <span className="shrink-0 rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black tracking-[0.1em] text-amber-300">
                {rec.ownerGrade}
              </span>
            )}
          </Link>
        ))}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 transition hover:bg-white/[0.07] hover:text-white"
          >
            +{hidden} more
          </button>
        )}

        {/* Out from this title to every other one. The reader who cares who
            stamped THIS is the reader who wants the whole list. */}
        <Link
          href="/stamps?tab=all"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 transition hover:border-violet-400/40 hover:text-violet-200"
        >
          All stamps →
        </Link>
      </div>
    </section>
  );
}
