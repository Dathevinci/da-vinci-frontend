"use client";

import Link from "next/link";
import { useGuildTag } from "@/lib/guildTags";

/**
 * The `[TAG]` chip that sits beside a username anywhere people are listed.
 *
 * Renders NOTHING until the batched lookup answers, and nothing at all for a
 * user with no guild — no placeholder, no spinner, no error state. A row that
 * never gets an answer just looks the way it did before guild tags existed.
 *
 * The chip is `shrink-0` + `whitespace-nowrap`, so on a narrow screen it holds
 * its size and the NAME beside it has to be the thing that gives way. Every
 * insertion site therefore puts the name in a `min-w-0` / `truncate` box —
 * without that the row grows past the viewport and the page scrolls sideways.
 */
export default function GuildTag({
  userId,
  className = "",
  size = "xs",
  asLink = true,
}: {
  userId?: string | null;
  className?: string;
  size?: "xs" | "sm";
  /**
   * `false` renders a plain span. Required wherever the chip sits INSIDE a
   * button — UserLink wraps whole rows in one, and a `<button>` may not
   * contain interactive content. The row's own click (the profile popout)
   * then owns the chip too, which is the sane reading of a tap there.
   */
  asLink?: boolean;
}) {
  const guild = useGuildTag(userId);
  if (!guild || !guild.tag) return null;

  const chip = `inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-emerald-400/25 bg-emerald-500/10 px-1.5 align-middle font-black leading-none tracking-wider text-emerald-300 ${
    size === "sm" ? "py-[3px] text-[10px]" : "py-[2px] text-[9px]"
  } ${className}`;

  if (!asLink) {
    return <span title={guild.name} className={chip}>[{guild.tag}]</span>;
  }

  return (
    <Link
      href={`/guild/${guild.id}`}
      title={guild.name}
      // Same guard UserLink uses: these chips live inside cards and rows that
      // carry their own onClick, and clicking a guild tag must go to the guild
      // rather than opening whatever the row does.
      onClick={(e) => e.stopPropagation()}
      className={`${chip} transition hover:bg-emerald-500/20`}
    >
      [{guild.tag}]
    </Link>
  );
}
