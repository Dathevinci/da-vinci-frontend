"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
// Suggestion avatars are 28px; serve them at that scale instead of the
// original upload (animated uploads pass through untouched — see cloudinary.ts).
import { cloudinaryFit } from "@/lib/cloudinary";

/**
 * MENTION AUTOCOMPLETE — the shared engine behind MentionsTextarea and
 * MentionsInput.
 *
 * WHY THIS FILE EXISTS. Both composers previously fetched `GET /api/users` on
 * mount: the entire user table, every column, on every composer that rendered,
 * purely to autocomplete a name. This replaces that with a prefix search that
 * returns three fields, debounced, and only while an @-token is actually open.
 *
 * The two components are otherwise identical machines pointed at different
 * elements, so the state machine lives here once rather than being mirrored in
 * two files that would immediately drift apart.
 */

export interface MentionUser {
  id: string;
  username: string;
  avatar: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const MENTION_DEBOUNCE_MS = 180;
export const MENTION_LIMIT = 8;
/** The contract caps `q` at 32 chars; no point sending more than that. */
const MENTION_MAX_QUERY = 32;

/** Touch target floor. Anything smaller is a coin toss with a thumb. */
const ROW_H = 44;
const MAX_VISIBLE = 5;
const LIST_W = 272;
const GAP = 6;

/**
 * Session cache, keyed by the normalised query. Retyping a prefix you've
 * already typed — which is most of what backspacing through a name is — costs
 * nothing. Only SETTLED results are cached: caching the in-flight promise would
 * mean an aborted request poisons that key for the rest of the session.
 */
const resultCache = new Map<string, MentionUser[]>();

const normalise = (q: string) => q.trim().toLowerCase().slice(0, MENTION_MAX_QUERY);

export function cachedMentions(q: string): MentionUser[] | undefined {
  return resultCache.get(normalise(q));
}

export async function searchMentions(q: string, signal?: AbortSignal): Promise<MentionUser[]> {
  const key = normalise(q);
  const hit = resultCache.get(key);
  if (hit) return hit;

  const url = new URL(`${API_URL}/api/users/mention-search`);
  // An empty q is meaningful: the contract returns a small recently-active set
  // so the list has something the instant someone types "@".
  if (key) url.searchParams.set("q", key);
  url.searchParams.set("limit", String(MENTION_LIMIT));

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`mention-search ${res.status}`);
  const data = await res.json();
  const rows: MentionUser[] = Array.isArray(data?.data)
    ? data.data
        .map((u: any) => ({
          id: String(u?.id ?? ""),
          username: String(u?.username ?? ""),
          avatar: u?.avatar ?? null,
        }))
        .filter((u: MentionUser) => !!u.username)
    : [];

  resultCache.set(key, rows);
  return rows;
}

/**
 * The open @-token to the LEFT of the caret, or null.
 *
 * The `(^|\s)` guard is the whole point: an @ only starts a mention at position
 * 0 or after whitespace. Without it, typing an email address pops a user list
 * open in the middle of a sentence.
 */
export function findMentionToken(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, Math.max(0, caret));
  const m = before.match(/(?:^|\s)@([a-zA-Z0-9_]{0,32})$/);
  if (!m) return null;
  const query = m[1];
  return { start: before.length - query.length - 1, query };
}

/* ─────────────────────────── caret measurement ─────────────────────────── */

const MIRROR_PROPS = [
  "boxSizing", "width", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontFamily",
  "lineHeight", "textAlign", "textTransform", "textIndent", "letterSpacing", "wordSpacing",
  "wordWrap", "wordBreak", "tabSize",
];

/**
 * Viewport coordinates of a caret index inside a textarea or input, measured by
 * mirroring the field into a hidden div and reading where the text ends. There
 * is no browser API for this, and anchoring the dropdown to the field's corner
 * instead — which is what this used to do — puts it in the wrong place on every
 * line but the first.
 */
export function caretViewportPoint(
  el: HTMLTextAreaElement | HTMLInputElement,
  index: number
): { top: number; left: number; lineHeight: number } {
  const doc = el.ownerDocument;
  const rect = el.getBoundingClientRect();
  const computed = window.getComputedStyle(el);
  const multiline = el.tagName === "TEXTAREA";
  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4 || 18;

  const mirror = doc.createElement("div");
  const ms = mirror.style;
  ms.position = "absolute";
  ms.top = "0";
  ms.left = "-9999px";
  ms.visibility = "hidden";
  ms.whiteSpace = multiline ? "pre-wrap" : "pre";
  ms.overflow = "hidden";
  for (const prop of MIRROR_PROPS) {
    (ms as any)[prop] = (computed as any)[prop];
  }

  mirror.textContent = el.value.slice(0, index);
  const marker = doc.createElement("span");
  // A span with no content has no box to measure, so give it something.
  marker.textContent = el.value.slice(index) || ".";
  mirror.appendChild(marker);
  doc.body.appendChild(mirror);

  const offsetTop = marker.offsetTop;
  const offsetLeft = marker.offsetLeft;
  doc.body.removeChild(mirror);

  const rawTop = multiline ? rect.top + offsetTop - el.scrollTop : rect.top;
  const rawLeft = rect.left + offsetLeft - el.scrollLeft;

  return {
    // Clamped to the field: a caret scrolled out of view must not fling the
    // dropdown off somewhere unrelated.
    top: Math.min(Math.max(rawTop, rect.top), rect.bottom - (multiline ? lineHeight : 0)),
    left: Math.min(Math.max(rawLeft, rect.left), rect.right),
    lineHeight: multiline ? lineHeight : rect.height,
  };
}

/* ──────────────────────────────── the hook ─────────────────────────────── */

type Anchor = { top: number; left: number; lineHeight: number };

export interface MentionAutocomplete {
  open: boolean;
  items: MentionUser[];
  /** Spread onto the input/textarea for combobox semantics. */
  fieldAria: Record<string, string | boolean | undefined>;
  /** Call after any input/caret movement. */
  sync: () => void;
  /** Returns true when the dropdown consumed the key — caller must then stop. */
  handleKeyDown: (e: React.KeyboardEvent<any>) => boolean;
  close: () => void;
  dropdown: React.ReactNode;
}

export function useMentionAutocomplete<T extends HTMLTextAreaElement | HTMLInputElement>({
  elementRef,
  setValue,
  disabled,
  candidates,
}: {
  elementRef: React.RefObject<T | null>;
  /** Write the composed value back through the caller's controlled state. */
  setValue: (next: string, caret: number) => void;
  disabled?: boolean;
  /**
   * A CLOSED candidate set to search instead of the whole site.
   *
   * Guild chat passes its roster: the server only notifies members of that
   * guild, so offering site-wide names there would suggest people who can
   * neither be pinged nor read the room — a dropdown promising a
   * notification the backend deliberately drops. Undefined means the normal
   * global search.
   */
  candidates?: MentionUser[];
}): MentionAutocomplete {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MentionUser[]>([]);
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [mounted, setMounted] = useState(false);

  const tokenRef = useRef<{ start: number; query: string } | null>(null);
  /**
   * STALE-RESPONSE GUARD, belt and braces. The AbortController cancels the
   * in-flight request; the monotonic sequence number means that even a response
   * that resolves anyway — an abort that lost the race, or a cache hit that
   * returns on a different tick — cannot overwrite a newer query's results.
   */
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  useEffect(() => setMounted(true), []);

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const close = useCallback(() => {
    cancelPending();
    // Bump the sequence so anything still in flight is born stale.
    seqRef.current += 1;
    tokenRef.current = null;
    setOpen(false);
    setItems([]);
    setAnchor(null);
    setActive(0);
  }, [cancelPending]);

  useEffect(() => () => cancelPending(), [cancelPending]);

  const apply = useCallback((rows: MentionUser[], seq: number) => {
    if (seq !== seqRef.current) return; // a newer query already won
    setItems(rows);
    setActive(0);
    setOpen(rows.length > 0);
  }, []);

  const runSearch = useCallback(
    (query: string) => {
      const seq = ++seqRef.current;

      // A closed candidate set never touches the network: filter it locally
      // and answer on the same tick. This is the guild-chat path, where the
      // roster is already in hand and a site-wide search would suggest people
      // the server will refuse to notify.
      if (candidates) {
        cancelPending();
        const q = query.toLowerCase();
        const rows = candidates
          .filter((u) => !q || u.username.toLowerCase().startsWith(q))
          .slice(0, MENTION_LIMIT);
        apply(rows, seq);
        return;
      }

      const cached = cachedMentions(query);
      if (cached) {
        cancelPending();
        apply(cached, seq);
        return;
      }
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        searchMentions(query, ctrl.signal)
          .then((rows) => apply(rows, seq))
          .catch(() => { /* aborted, or the backend is down — just no list */ });
      }, MENTION_DEBOUNCE_MS);
    },
    [apply, cancelPending, candidates]
  );

  const sync = useCallback(() => {
    const el = elementRef.current;
    if (!el || disabled) return close();
    const caret = el.selectionStart ?? el.value.length;
    const token = findMentionToken(el.value, caret);
    if (!token) return close();

    tokenRef.current = token;
    setAnchor(caretViewportPoint(el, token.start));
    runSearch(token.query);
  }, [elementRef, disabled, close, runSearch]);

  // Follow the caret if the page moves under an open list.
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const el = elementRef.current;
      const token = tokenRef.current;
      if (!el || !token) return;
      setAnchor(caretViewportPoint(el, token.start));
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, elementRef]);

  const accept = useCallback(
    (username: string) => {
      const el = elementRef.current;
      const token = tokenRef.current;
      if (!el || !token) return;
      const caret = el.selectionStart ?? el.value.length;
      const next = `${el.value.slice(0, token.start)}@${username} ${el.value.slice(caret)}`;
      const nextCaret = token.start + username.length + 2;
      close();
      setValue(next, nextCaret);
    },
    [elementRef, setValue, close]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<any>): boolean => {
      if (!open || items.length === 0) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % items.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        accept(items[Math.min(active, items.length - 1)].username);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return true;
      }
      return false;
    },
    [open, items, active, accept, close]
  );

  const showing = open && mounted && !!anchor && items.length > 0;

  let dropdown: React.ReactNode = null;
  if (showing && anchor) {
    const visible = Math.min(items.length, MAX_VISIBLE);
    const listH = visible * ROW_H + 8;
    const belowTop = anchor.top + anchor.lineHeight + GAP;
    /**
     * Measured against the VISUAL viewport, not window.innerHeight.
     *
     * A soft keyboard does not shrink the layout viewport, so innerHeight
     * still reports the full screen while the bottom half is covered by keys
     * — the list would decide it had room "below" and render behind them.
     * GuildChatDock already measures visualViewport for exactly this reason.
     * Falls back to the layout viewport on desktop, where they agree.
     */
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const vTop = vv ? vv.offsetTop : 0;
    const vH = vv ? vv.height : window.innerHeight;
    const vW = vv ? vv.width : window.innerWidth;
    const flip = vTop + vH - belowTop < listH + 8;
    const rawTop = flip ? anchor.top - listH - GAP : belowTop;
    // Clamped INTO the visible band both ways, so neither branch can park the
    // list off the top of a short landscape viewport.
    const top = Math.max(vTop + 8, Math.min(rawTop, vTop + vH - listH - 8));
    const left = Math.max(8, Math.min(anchor.left, vW - LIST_W - 8));

    dropdown = createPortal(
      <ul
        id={listId}
        role="listbox"
        aria-label="Mention a member"
        className="fixed z-[9999] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#18181b] py-1 shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
        style={{ top, left, width: LIST_W, maxHeight: MAX_VISIBLE * ROW_H + 8 }}
      >
        {items.map((u, idx) => (
          <li key={u.id || u.username} role="presentation">
            <button
              type="button"
              id={optionId(idx)}
              role="option"
              aria-selected={idx === active}
              // The field must never lose focus: blurring closes the list and
              // drops the caret, so a tap would clear the very token it means
              // to complete. preventDefault on mousedown is what keeps it.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => accept(u.username)}
              onMouseEnter={() => setActive(idx)}
              className={`flex w-full touch-manipulation items-center gap-2.5 px-3 text-left transition-colors ${
                idx === active ? "bg-purple-500/25" : "hover:bg-white/5"
              }`}
              style={{ minHeight: ROW_H }}
            >
              {u.avatar ? (
                <img src={cloudinaryFit(u.avatar, 80)} alt="" className="h-7 w-7 shrink-0 rounded-full border border-white/10 object-cover" />
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-purple-600 text-[11px] font-black text-white">
                  {(u.username[0] || "?").toUpperCase()}
                </span>
              )}
              <span className="truncate text-sm font-bold text-white">@{u.username}</span>
            </button>
          </li>
        ))}
      </ul>,
      document.body
    );
  }

  return {
    open: showing,
    items,
    fieldAria: {
      role: "combobox",
      "aria-expanded": showing,
      "aria-controls": showing ? listId : undefined,
      "aria-autocomplete": "list",
      "aria-haspopup": "listbox",
      "aria-activedescendant": showing ? optionId(active) : undefined,
    },
    sync,
    handleKeyDown,
    close,
    dropdown,
  };
}

/** Keys that move the caret without firing onChange — the token can open or
 *  close under them, so they need a resync. */
export const CARET_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);
