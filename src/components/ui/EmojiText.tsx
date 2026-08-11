"use client";

import React, { useState } from "react";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * EMOJI TEXT — renders a message, swapping `:shortcode:` for its image.
 *
 * The catalog is HANDED IN rather than fetched: one lookup belongs to the room
 * (see `useGuildEmojis` in `@/lib/guildEmoji`), not to each of the hundreds of
 * lines drawing from it. `catalog.byName` is already the right shape, so it can
 * be passed straight through.
 *
 * NO dangerouslySetInnerHTML. The message is split into React nodes, so any
 * markup a member types stays inert text — the same posture MentionText takes.
 * Injecting an <img> by string here would hand every guild member a script tag
 * in every chat line.
 *
 * UNKNOWN TOKENS STAY LITERAL. `:not_an_emoji:` renders as those exact
 * characters, which is the whole reason the shortcode format is what gets
 * stored: a message is readable with no catalog at all — before the fetch
 * lands, in a notification preview, in a copy-paste, or on the day the images
 * 404. The guarantee is exact: with nothing resolving, the text on screen is
 * character-for-character the text that was typed.
 *
 * That guarantee is what makes the one sharp edge here harmless. `12:30:45`
 * DOES tokenize — `30` is a legal shortcode body — but with no emoji named
 * `30` it falls straight back to `:30:` and the timestamp reads exactly as
 * written. A guild that deliberately names an emoji `30` would see it appear
 * mid-timestamp; that is inherent to `:shortcode:` (Discord behaves the same
 * way) and is a naming choice, not something to solve by narrowing the token
 * rule away from the `[a-z0-9_]{2,24}` the server enforces.
 *
 * ═════════════ WHY THE TOKENISER IS EXPORTED, NOT JUST USED ═════════════
 * A chat body has to render BOTH `@names` and `:shortcodes:`, and those were
 * two components each taking a raw string — so neither could run on the other's
 * output (React nodes are not text). `emojiNodes` below is the shortcode pass
 * lifted OUT of this component so MentionText can call it on the plain-text
 * runs BETWEEN its mentions: one tokenising pass, two renderers, ONE definition
 * of what a shortcode is. Duplicating the regex instead would let the two drift
 * — the day one accepts `:A_b:` and the other doesn't, a message renders
 * differently depending on whether it happens to contain a mention.
 *
 * Splitting on mentions FIRST is safe by construction: `@` is not in the
 * shortcode class, so a mention boundary can never fall inside a `:name:`.
 */

/** The catalog entry this component actually needs. `GuildEmoji` satisfies it. */
export type EmojiSource = { url: string; animated?: boolean };

/**
 * Deliberately NOT global: `String.split` needs no `g`, and a shared global
 * regex carries `lastIndex` between calls — a stateful module-level matcher is
 * how "works once, skips the next line" bugs start.
 *
 * The class matches the server's `[a-z0-9_]{2,24}` but is case-INSENSITIVE, so
 * a typed `:Sparkle:` still finds `sparkle` (lookup lowercases). An unmatched
 * case is no worse off — it falls through to literal text like any other
 * unknown token.
 */
const TOKEN = /:([A-Za-z0-9_]{2,24}):/;

/**
 * THE shortcode pass: a string in, text-and-images out.
 *
 * Returns the ORIGINAL STRING — not an array, not a fragment — whenever there
 * is nothing to do (no catalog, Performance Mode on, no token in the text).
 * That identity matters: it is what lets MentionText adopt this without
 * changing a single character of what its existing callers render.
 *
 * `still` is passed IN rather than read from a hook, because this runs once per
 * plain-text run and a chat room holds 60+ messages. A `usePreferences()` in
 * here would be hundreds of localStorage reads and hundreds of window
 * listeners per paint; the room resolves it once and threads it down, the same
 * reason the catalog itself is hoisted to the room.
 *
 * `keyPrefix` keeps the emitted keys unique when several runs of one message
 * are rendered side by side (MentionText emits one run per gap between
 * mentions, and both would otherwise start counting from the same index).
 */
export function emojiNodes(
  raw: string,
  emojis: Record<string, EmojiSource> | null | undefined,
  still: boolean,
  keyPrefix: string = "emoji"
): React.ReactNode {
  if (!raw || !emojis || still) return raw;

  // split with ONE capture group alternates [text, name, text, name, ...] —
  // every odd index is a shortcode body, every even index is plain text.
  const parts = raw.split(TOKEN);
  if (parts.length < 2) return raw;

  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 0) {
      if (part) nodes.push(part);
      continue;
    }
    const literal = `:${part}:`;
    // A shortcode is allowed to spell `constructor` or `toString`, so the hit
    // is checked for a real url rather than trusted for being truthy — the
    // catalog's map is null-prototype, but a caller's need not be.
    const found = emojis[part.toLowerCase()];
    if (!found || typeof found.url !== "string" || !found.url) {
      nodes.push(literal);
      continue;
    }
    nodes.push(<EmojiImage key={`${keyPrefix}-${i}`} url={found.url} literal={literal} />);
  }

  return nodes;
}

export default function EmojiText({
  text,
  emojis,
  className,
}: {
  text: string;
  emojis?: Record<string, EmojiSource>;
  className?: string;
}) {
  const { preferences } = usePreferences();

  const raw = typeof text === "string" ? text : "";

  /**
   * PERFORMANCE MODE — reducedMotion renders the literal `:name:` instead.
   *
   * Custom emoji are overwhelmingly animated WebP, and a chat room paints
   * dozens of lines at once: that is an animated image per line, decoding and
   * compositing forever, which is EXACTLY the cost Performance Mode exists to
   * stop (the same switch already gates framer via MotionConfig and the canvas
   * profile effects). Falling back to the shortcode loses no meaning, because
   * the shortcode is what was typed and what is stored.
   *
   * `usePreferences` reads localStorage in an effect, so the first paint uses
   * the default (off) on both server and client — hydration-safe — and flips
   * after mount for anyone who has the preference on.
   *
   * This component OWNS that hook for one-off callers (a single body, a card
   * blurb). Anything rendering a LIST resolves the preference once itself and
   * calls `emojiNodes` directly — see MentionText and GuildChatRoom.
   */
  const stillOnly = preferences.reducedMotion === true;

  return <span className={className}>{emojiNodes(raw, emojis, stillOnly)}</span>;
}

/**
 * One emoji image, with the literal shortcode as its escape hatch.
 *
 * A BROKEN IMAGE FALLS BACK TO TEXT, never an empty box: a deleted Cloudinary
 * asset, an offline CDN or a blocked request all end with `:name:` on screen
 * rather than a ragged gap in the middle of a sentence.
 *
 * `alt` is the shortcode too, so a screen reader reads what was typed and a
 * copy-paste of the message carries the emoji across as text.
 *
 * SIZED IN em, CAPPED IN %. 1.35em keeps the glyph a hair taller than the text
 * it sits in without dragging the line height around, and `maxWidth: 100%`
 * stops a wide (or mis-uploaded banner-shaped) emoji from pushing a chat line
 * past the edge of a 360px phone. A run of many of them wraps between images
 * rather than overflowing, because each one is its own inline box.
 */
function EmojiImage({ url, literal }: { url: string; literal: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) return <>{literal}</>;

  return (
    <img
      src={url}
      alt={literal}
      title={literal}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setBroken(true)}
      style={{
        height: "1.35em",
        width: "auto",
        maxWidth: "100%",
        display: "inline-block",
        verticalAlign: "middle",
        objectFit: "contain",
      }}
      className="mx-[0.05em] select-none"
    />
  );
}
