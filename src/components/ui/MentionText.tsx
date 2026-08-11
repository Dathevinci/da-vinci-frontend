"use client";

import React from "react";
import Link from "next/link";

/**
 * Renders a body of user-written text, turning @mentions into profile links and
 * leaving everything else exactly as it was.
 *
 * NO dangerouslySetInnerHTML. The string is SPLIT and returned as React nodes,
 * so a comment containing markup renders as the literal characters someone
 * typed rather than as HTML — this is user input from a public composer, and
 * that distinction is the only thing standing between a comment box and stored
 * XSS.
 */

/** One capture group, so String.split interleaves matches at ODD indices. */
const MENTION_RE = /(@[a-zA-Z0-9_]{1,32})/g;

export default function MentionText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;

  const parts = text.split(MENTION_RE);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        // Even indices are plain text; odd indices are the captured @tokens.
        if (i % 2 === 0) return part ? <React.Fragment key={i}>{part}</React.Fragment> : null;

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
