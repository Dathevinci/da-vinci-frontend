"use client";

import { useState } from "react";
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
   */
  const stillOnly = preferences.reducedMotion === true;

  if (!raw || !emojis || stillOnly) {
    return <span className={className}>{raw}</span>;
  }

  // split with ONE capture group alternates [text, name, text, name, ...] —
  // every odd index is a shortcode body, every even index is plain text.
  const parts = raw.split(TOKEN);
  if (parts.length < 2) {
    return <span className={className}>{raw}</span>;
  }

  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 0) {
      if (part) nodes.push(part);
      continue;
    }
    const literal = `:${part}:`;
    const found = emojis[part.toLowerCase()];
    if (!found || typeof found.url !== "string" || !found.url) {
      nodes.push(literal);
      continue;
    }
    nodes.push(<EmojiImage key={`emoji-${i}`} url={found.url} literal={literal} />);
  }

  return <span className={className}>{nodes}</span>;
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
        display: "inline-block",
        verticalAlign: "middle",
        objectFit: "contain",
      }}
      className="mx-[0.05em] select-none"
    />
  );
}
