"use client";

import React from "react";
import Link from "next/link";
import { emojiNodes } from "@/components/ui/EmojiText";
import type { EmojiSource } from "@/components/ui/EmojiText";

/**
 * Renders a body of user-written text, turning @mentions into profile links and
 * leaving everything else exactly as it was.
 *
 * NO dangerouslySetInnerHTML. The string is SPLIT and returned as React nodes,
 * so a comment containing markup renders as the literal characters someone
 * typed rather than as HTML — this is user input from a public composer, and
 * that distinction is the only thing standing between a comment box and stored
 * XSS.
 *
 * ═══════════════ MENTIONS AND CUSTOM EMOJI, IN ONE PASS ═══════════════
 * A guild chat line has to do both: `nice work @dej :sparkle:` needs the link
 * AND the image. Nesting the two renderers was impossible — each takes a raw
 * string and returns React nodes — so the shortcode pass was lifted out of
 * EmojiText into `emojiNodes`, and this component calls it on the plain-text
 * runs BETWEEN mentions. One tokenising pass over the string, one definition of
 * what a shortcode is, shared by both renderers so they can never disagree.
 *
 * Mentions are split FIRST and that is safe by construction: `@` is not in the
 * shortcode class (`[A-Za-z0-9_]{2,24}`), so a mention boundary can never land
 * inside a `:name:`. `@dej:sparkle:` links `@dej` and draws the emoji.
 *
 * `emojis` IS OPTIONAL AND OFF BY DEFAULT. With it absent — every caller
 * outside a guild room — `emojiNodes` hands the run straight back as the same
 * string, so the community feed, the forum and the post page render
 * character-for-character what they rendered before this existed.
 */

/** One capture group, so String.split interleaves matches at ODD indices. */
const MENTION_RE = /(@[a-zA-Z0-9_]{1,32})/g;

export default function MentionText({
  text,
  emojis,
  stillEmoji,
  className,
}: {
  text: string;
  /**
   * name -> emoji for THIS room. `GuildEmojiCatalog.byName` is already this
   * shape. Absent means "no custom emoji here", which is the old behaviour.
   */
  emojis?: Record<string, EmojiSource> | null;
  /**
   * Performance Mode, RESOLVED BY THE CALLER. Deliberately a prop and not a
   * `usePreferences()` in here: this component is rendered once per message and
   * a chat room holds 60+ of them, so a hook here would mean hundreds of
   * localStorage reads and hundreds of window listeners on every paint. The
   * room reads the preference once and threads it down.
   */
  stillEmoji?: boolean;
  className?: string;
}) {
  if (!text) return null;

  const parts = text.split(MENTION_RE);
  const still = stillEmoji === true;

  return (
    <span className={className}>
      {parts.map((part, i) => {
        // Even indices are plain text; odd indices are the captured @tokens.
        // The plain runs are where shortcodes can live — a mention itself is
        // matched character-for-character and has no room for one.
        if (i % 2 === 0) {
          if (!part) return null;
          return <React.Fragment key={i}>{emojiNodes(part, emojis, still, `e${i}`)}</React.Fragment>;
        }

        // Same rule the composer uses: an @ only starts a mention at the very
        // beginning or after whitespace, so `you@example.com` stays an email
        // address and `@a@b` only links the first one.
        const prev = parts[i - 1];
        const atWordStart = prev === "" ? i === 1 : /\s$/.test(prev);
        if (!atWordStart) return <React.Fragment key={i}>{part}</React.Fragment>;

        const username = part.slice(1);
        return (
          <Link
            key={i}
            href={`/user/${encodeURIComponent(username)}`}
            className="rounded bg-violet-500/15 px-1 py-0.5 font-bold text-violet-300 no-underline transition-colors hover:bg-violet-500/25 hover:text-violet-200"
          >
            {part}
          </Link>
        );
      })}
    </span>
  );
}
