"use client";

import { useRouter } from "next/navigation";
import { StampSeal } from "@/components/stamp/StampSeal";
import { useEndorsement } from "@/components/providers/StampEndorsementProvider";
import type { StampMediaType } from "@/lib/stamps";

/**
 * THE CURATOR'S SEAL, PRESSED ONTO A COVER ANYWHERE ON THE SITE.
 *
 * Last week's top three carry their seal onto every cover of every title they
 * recommend — browse grids, carousels, detail pages. Tapping the seal opens the
 * curator's profile, and that tap is the entire point of the prize: it is how a
 * won week converts into followers.
 *
 * IT IS A BUTTON, AND IT MUST STAY ONE. The cards this lands on are already
 * one interactive element — an <a> in some places, a <button> in others — and
 * BOTH an anchor inside an anchor and a button inside a button are invalid
 * HTML that the parser silently rewrites, which surfaces as a hydration
 * mismatch in production and nowhere else. So: never a Link, never an <a>, and
 * always mounted as a SIBLING of the card's own control rather than inside it.
 * preventDefault + stopPropagation keep the tap from also opening the title;
 * a real <button> means Enter and Space work without a keydown handler.
 *
 * GRID PERFORMANCE CONTRACT. A page can hold forty of these. There is no
 * request here — the endorsement comes from one session-wide map read — no
 * canvas, no filter/backdrop-filter, no framer-motion, no animation, and the
 * seal is drawn with `animated` off on every surface including detail pages, so
 * one component cannot start behaving differently depending on where it landed.
 *
 * Renders nothing at all when the title isn't endorsed, which is almost always.
 */
export default function CoverSeal({
  mediaType,
  mediaId,
  size = "sm",
  className = "absolute bottom-1.5 right-1.5 z-10 w-[30%] min-w-[34px] max-w-[56px]",
}: {
  mediaType: StampMediaType;
  mediaId: string | number | null | undefined;
  size?: "sm" | "md" | "lg";
  /** Where it sits. The caller picks the corner, because only the caller knows
   *  which corners its own badges already occupy. */
  className?: string;
}) {
  const router = useRouter();
  const endorsement = useEndorsement(mediaType, mediaId);
  if (!endorsement) return null;

  const label = `${endorsement.ownerUsername} recommends this — view their stamp`;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        // Both, and in this order: preventDefault kills the enclosing link's
        // default navigation, stopPropagation kills the card's own onClick.
        // Either one alone still opens the title underneath.
        e.preventDefault();
        e.stopPropagation();
        router.push(`/user/${encodeURIComponent(endorsement.ownerUsername)}`);
      }}
      className={`${className} cursor-pointer rounded-full leading-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300`}
    >
      <StampSeal
        fluid
        username={endorsement.ownerUsername}
        grade={endorsement.ownerGrade}
        size={size}
        rank={endorsement.ownerRank}
      />
    </button>
  );
}
