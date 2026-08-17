"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CornerDownRight, Crown, Lock, MessageSquare, Pencil, Send, Shield, Trash2, X } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
import UserLink from "@/components/profile/UserLink";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { effectNameClass } from "@/lib/effectTheme";
import { nameColorClass } from "@/lib/cosmetics";
import MediaPicker from "@/components/community/MediaPicker";
import EmojiPicker from "@/components/community/EmojiPicker";
import MentionsTextarea from "@/components/ui/MentionsTextarea";
import MentionText from "@/components/ui/MentionText";
import { emojiNodes } from "@/components/ui/EmojiText";
import { useGuildEmojis } from "@/lib/guildEmoji";
import { usePreferences } from "@/hooks/usePreferences";
// Chat avatars are 36px; serve them at that scale instead of the original
// upload (animated uploads pass through untouched — see cloudinary.ts).
import { cloudinaryFit } from "@/lib/cloudinary";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE GUILD CHAT ROOM — Discord-style, members only.
 *
 * Lifted out of the guild hall page verbatim so it can be mounted twice: in
 * its old place on /guild/[id], and inside the dock's slide-over panel, which
 * is what lets guildmates keep talking from anywhere on the site.
 *
 * The bones are unchanged: an 8-second poll that goes quiet whenever the tab
 * is hidden, a cursor taken only from SERVER-confirmed messages, stick-to-
 * bottom within 80px, Enter sends and Shift+Enter breaks the line, 500
 * characters, emoji and GIFs only.
 *
 * `guild` is optional because the dock resolves the viewer's guild from a
 * summary endpoint that carries no member list: with it, names wear their role
 * colours and every message gets its role chip; without it the room still
 * reads and sends, it just draws no chips. Deletion rights are re-checked by
 * the server either way — `canModerate` only decides what is worth showing.
 *
 * WHAT EACH ACTION COSTS ITS OWNER
 *   Reply  — anyone, on anything. Carries a replyToId up and a quoted parent back.
 *   Delete — your own always; officers and moderateChat roles sweep the room.
 *   Edit   — THE AUTHOR ONLY. Not officers, not the leader. Rewriting someone
 *            else's words is a power nobody in this app has, so the button is
 *            not even drawn for them (and the server answers 403 regardless).
 *
 * ═══════════════════ MENTIONS, AND THE ENTER KEY ═══════════════════
 * Both composers — the message box and the inline edit box — are
 * MentionsTextarea, so @ opens the same autocomplete the community feed uses,
 * and message bodies render through MentionText so a name becomes a link.
 *
 * MentionsTextarea renders the real <textarea> ITSELF and its prop contract is
 * { value, onChange, placeholder, className, disabled } — no ref, no onKeyDown,
 * no rows. Three consequences, each answered here rather than by changing that
 * component (another surface owns it):
 *
 *  1. THE NODE. Every composer sits inside a box we DO hold a ref to, and the
 *     live <textarea> is read out of that box after each commit. Emoji
 *     insert-at-caret, auto-grow, focus-on-reply and the edit box's
 *     caret-to-end all go on working through it.
 *  2. THE KEYS. Our handlers ride the BOX, one bubble up from the textarea, so
 *     the component's own keydown runs FIRST. While its dropdown is open it
 *     answers Enter/Tab/the arrows with preventDefault(); we therefore treat a
 *     defaultPrevented Enter as "the list took it" and DO NOT SEND. Enter only
 *     sends when it arrives here untouched — i.e. when no dropdown is open.
 *     Erring this way is deliberate: a swallowed Enter costs one more keypress,
 *     the opposite mistake posts "@dej" to the whole guild.
 *  3. THE ROWS. `rows` is not in the contract, so the box arrives at the HTML
 *     default of two lines; autoGrow measures from 0px, which makes the height
 *     content-driven and opens the composer on one line as rows={1} did.
 *
 * ═══════════════════ CUSTOM EMOJI — ONE CATALOG, ONE PREFERENCE ═══════════════════
 * `:shortcode:` emoji belong to the guild, and the room is the only place they
 * resolve. TWO things are therefore resolved HERE, once, and threaded down:
 *
 *   THE CATALOG — `useGuildEmojis(guildId)`. It is module-cached and collapses
 *     in-flight requests, so the two mounts this component has (the hall and
 *     the dock's slide-over) share ONE fetch rather than each asking. It needs
 *     nothing but the guildId, which is why the dock — whose summary endpoint
 *     gives it no guild detail at all — still gets emoji.
 *   PERFORMANCE MODE — `usePreferences()`. A room holds 60+ messages; a hook
 *     per line would be hundreds of localStorage reads and hundreds of window
 *     listeners on every paint. Read once, passed as `stillEmoji`, and both
 *     renderers below take it as a plain prop/argument.
 *
 * Bodies render through MentionText, which now runs the SAME shortcode pass on
 * the text between mentions, so one line can carry both a link and an image.
 * The quoted-parent snippet calls `emojiNodes` directly instead: it lives
 * inside a <button>, and a mention there would nest an <a> in a button.
 */

export type GuildChatRolePermissions = {
  editGuild: boolean;
  kickMembers: boolean;
  moderateChat: boolean;
};

export type GuildChatRole = {
  id: string;
  name: string;
  color: string;
  permissions: GuildChatRolePermissions;
};

export type GuildChatMember = {
  userId: string;
  username: string;
  avatar: string | null;
  role: string;
  joinedAt: string;
  // `?` rides out deploy skew — a backend without roles yet must not crash us.
  customRoleId?: string | null;
};

/** Everything the room needs off a guild detail — the page's shape is a superset. */
export type GuildChatGuild = {
  id: string;
  leaderId: string;
  coLeaderId: string | null;
  members: GuildChatMember[];
  roles?: GuildChatRole[];
};

/** What the themed confirm asks — the host owns the dialog, we only describe it. */
export type ChatConfirmSpec = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

export type ChatAuthor = {
  id: string; username: string; avatar: string | null; role: string | null;
  activeEffect: string | null; activeColor: string | null; activeFont: string | null;
};

/** The parent of a reply, flattened by the server. Null once the parent dies. */
export type ChatReplyPreview = {
  id: string;
  userId: string;
  username: string | null;
  content: string | null;
  mediaUrl: string | null;
};

export type ChatMessage = {
  id: string;
  userId: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
  author: ChatAuthor | null;
  // All three are `?` on purpose: a backend deployed a minute behind this
  // bundle sends them as UNDEFINED, and `undefined` must never be mistaken for
  // "the server says there is no edit / no parent". See foldServerRow.
  editedAt?: string | null;
  replyToId?: string | null;
  replyTo?: ChatReplyPreview | null;
};

/* ═══════════════ THE MERGE — where an edit lives or dies ═══════════════
   The room holds messages it has already seen, and the poll keeps handing it
   rows. The OLD merge deduped by id and dropped the incoming copy whenever it
   already held that id — which is exactly the copy carrying a fresh edit. An
   edited message would therefore render correctly for one beat and then snap
   back to its old text on the next 8-second tick.

   So: the server's copy WINS, always, with two deliberate exceptions.

   1. A field the server did not send (`undefined`, i.e. deploy skew) never
      overwrites one we already know. `null` DOES overwrite — that is the
      server actively telling us the parent was deleted.
   2. Recency is decided by editedAt, not by arrival order. A window response
      that left the server BEFORE our PATCH landed can arrive after it; letting
      it win would drag the old text back onto the screen a beat after the
      author saved. Whichever copy was edited later keeps its text. */

const foldServerRow = (prev: ChatMessage | undefined, next: ChatMessage): ChatMessage => {
  if (!prev) return next;
  const replyTo = next.replyTo === undefined ? prev.replyTo ?? null : next.replyTo;
  const replyToId = next.replyToId === undefined ? prev.replyToId ?? null : next.replyToId;
  const prevAt = prev.editedAt ? +new Date(prev.editedAt) : 0;
  const nextAt = next.editedAt ? +new Date(next.editedAt) : 0;
  if (prevAt > nextAt) {
    return { ...next, content: prev.content, editedAt: prev.editedAt, replyTo, replyToId };
  }
  return { ...next, replyTo, replyToId, editedAt: next.editedAt ?? null };
};

/** cur + rows, upserted by id (server wins) and re-sorted oldest-first. */
const mergeRows = (cur: ChatMessage[], rows: ChatMessage[]): ChatMessage[] => {
  const byId = new Map<string, ChatMessage>(cur.map((m) => [m.id, m] as [string, ChatMessage]));
  for (const row of rows) byId.set(row.id, foldServerRow(byId.get(row.id), row));
  const merged = [...byId.values()];
  merged.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt) || a.id.localeCompare(b.id));
  return merged;
};

/** The member's custom role, resolved — null for officers-only lookups too. */
export const customRoleOf = (guild: GuildChatGuild, userId: string): GuildChatRole | null => {
  const m = guild.members.find((x) => x.userId === userId);
  if (!m?.customRoleId) return null;
  return (guild.roles || []).find((r) => r.id === m.customRoleId) || null;
};

/** "Today" / "Yesterday" / "Mar 4" — the chat's Discord-style day divider. */
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  });
};

/** "14:07" — the group-header timestamp. */
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** One flat line of a quoted parent. CSS truncates too — this only keeps the DOM small. */
const snippetOf = (p: ChatReplyPreview): string => {
  const text = (p.content || "").replace(/\s+/g, " ").trim();
  if (text) return text.length > 140 ? `${text.slice(0, 140)}…` : text;
  return p.mediaUrl ? "GIF" : "";
};

/** A loaded message, flattened into the shape a reply quote needs. */
const previewOf = (m: ChatMessage): ChatReplyPreview => ({
  id: m.id,
  userId: m.userId,
  username: m.author?.username || null,
  content: m.content,
  mediaUrl: m.mediaUrl,
});

/* ═══════════ THE ROLE CHIP — who is who, in chat and the members strip ═══════════
   Leader and co-leader outrank everything; a custom role wears its own colour;
   a plain member gets the quiet slate tag. Someone no longer in members[] (an
   ex-member still visible in old chat) gets nothing. */

export function RoleChip({ guild, userId }: { guild: GuildChatGuild; userId: string }) {
  if (userId === guild.leaderId) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">
        <Crown className="h-2.5 w-2.5" /> Leader
      </span>
    );
  }
  if (guild.coLeaderId && userId === guild.coLeaderId) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-violet-300">
        <Shield className="h-2.5 w-2.5" /> Co-leader
      </span>
    );
  }
  const member = guild.members.find((m) => m.userId === userId);
  if (!member) return null;
  const role = customRoleOf(guild, userId);
  if (role) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
        style={{
          borderColor: `${role.color}66`,
          backgroundColor: `${role.color}24`,
          color: role.color,
        }}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: role.color }} />
        {role.name}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-400/20 bg-slate-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
      Member
    </span>
  );
}

/* ═══════════════════════════════ THE ROOM ═══════════════════════════════ */

export default function GuildChatRoom({
  guildId, guild, isMember, canModerate, askConfirm, className, heightClass,
}: {
  guildId: string;
  guild: GuildChatGuild | null;
  isMember: boolean;
  canModerate: boolean;
  askConfirm: (spec: ChatConfirmSpec) => void;
  /** The shell. Defaults to the guild hall's card; the dock hands its own. */
  className?: string;
  /**
   * The scroller's height, as classes. Every consumer hands its own: the hall
   * a viewport-relative room, the dock `min-h-0 flex-1` so the panel's own
   * flex column decides. The 28rem default is only what an unset caller gets.
   */
  heightClass?: string;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  /* Both of these are resolved ONCE for the whole room — see the header note.
     The catalog is keyed on the guildId alone, so a dock mount with no guild
     detail still gets its emoji; a mount before the fetch lands simply renders
     the shortcodes as the literal text they already are. */
  /**
   * Only ASK once the viewer is allowed an answer.
   *
   * The room mounts for outsiders too (it draws the members-only lock), and
   * the catalog endpoint answers 403 for them — which the lib caches as an
   * empty catalog for the tab, since "not a member" is normally a stable
   * fact. It stops being stable the moment they JOIN: the cached empty would
   * survive, so a brand-new member saw "no emoji" on a guild with a dozen and
   * every :shortcode: stayed literal until a hard reload. Passing null while
   * they are outside means no request at all, and the null -> guildId flip on
   * joining is what triggers the one real fetch.
   */
  const emojiCatalog = useGuildEmojis(isMember ? guildId : null);
  const { preferences } = usePreferences();
  const stillEmoji = preferences.reducedMotion === true;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [sending, setSending] = useState(false);
  // The message being answered. Held whole (not just an id) so the composer
  // bar and the optimistic quote can be drawn without another lookup.
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Which message is showing its action row on a touch screen, and which one
  // is briefly lit after a jump to a quoted parent.
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // Hover is a fiction on a phone: no pointer ever rests on a message, so a
  // hover-only action row is an action row that does not exist. Resolved once
  // from the media query rather than sniffed off the user agent.
  const [coarse, setCoarse] = useState(false);
  // The two live <textarea> nodes. MentionsTextarea renders them and takes no
  // ref, so these are READ OUT of the boxes below rather than handed to us.
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);
  const composerBoxRef = useRef<HTMLDivElement>(null);
  const editBoxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Every rendered message row, by id — the jump-to-parent lookup. A parent
  // that is not in here simply is not loaded, and we refuse to guess.
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stick-to-bottom: true while the reader sits within ~80px of the newest
  // message. New arrivals only pull the scroll down when this is true, so
  // reading history is never interrupted.
  const stickRef = useRef(true);
  const firstScrollRef = useRef(true);
  // The newest id the SERVER has confirmed — polls ask for strictly newer
  // rows. Optimistic sends deliberately do NOT advance it, so a message that
  // landed between the last poll and our own send is never skipped; our own
  // copy simply comes back once more and is folded.
  const lastIdRef = useRef<string | null>(null);
  const tickRef = useRef(0);

  /**
   * `full` asks for the whole window instead of "anything after the cursor".
   * An `after=` poll never revisits a row it has already handed over, so an
   * edit made by SOMEBODY ELSE could never reach this screen through it. Every
   * fifth tick (~40s) and every return to a visible tab pays for one window.
   */
  const fetchNew = useCallback(async (initial: boolean, full?: boolean) => {
    try {
      const base = `${API_URL}/api/guilds/${encodeURIComponent(guildId)}/messages`;
      const after = initial || full ? null : lastIdRef.current;
      const url = after ? `${base}?after=${encodeURIComponent(after)}&limit=60` : `${base}?limit=60`;
      const r = await fetch(url, { headers: authHeaders() });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return;
      // The array rides at data's root — there is no { messages } wrapper.
      const rows: ChatMessage[] = Array.isArray(d.data) ? d.data : [];
      if (rows.length > 0) lastIdRef.current = rows[rows.length - 1].id;
      if (rows.length === 0 && !initial) return;
      setMessages((cur) => mergeRows(cur, rows));
    } catch {
      /* offline — the next tick tries again */
    } finally {
      if (initial) setLoading(false);
    }
  }, [guildId]);

  // Initial fetch + the 8-second poll — which ONLY runs while the tab is
  // visible (the backend's rate budget assumes hidden tabs go quiet).
  useEffect(() => {
    if (!isMember) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      tickRef.current += 1;
      fetchNew(false, tickRef.current % 5 === 0);
    };
    const start = () => { if (timer === null) timer = setInterval(tick, 8000); };
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { fetchNew(false, true); start(); }
      else stop();
    };
    fetchNew(true);
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [isMember, fetchNew]);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* Re-read both live textareas after EVERY commit — the edit box comes and
     goes with editingId, and the composer's node survives but costs nothing to
     look up again. No dependency array on purpose.
     DECLARED HERE, ABOVE the auto-grow and edit-focus effects, deliberately:
     effects run in declaration order within a commit, so by the time those
     reach for editRef/taRef the node is already the one just mounted. */
  useEffect(() => {
    taRef.current = composerBoxRef.current?.querySelector("textarea") ?? null;
    editRef.current = editBoxRef.current?.querySelector("textarea") ?? null;
  });

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Bottom on first load; afterwards only when the reader was already there.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    if (firstScrollRef.current) {
      firstScrollRef.current = false;
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const insertEmoji = (emoji: string) => {
    const el = taRef.current;
    const at = el?.selectionStart ?? draft.length;
    const to = el?.selectionEnd ?? at;
    const next = (draft.slice(0, at) + emoji + draft.slice(to)).slice(0, 500);
    setDraft(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = Math.min(at + emoji.length, next.length);
      el.setSelectionRange(pos, pos);
    });
  };

  /* AUTO-GROW. Measured from 0px, not "auto": without a rows={1} we can no
     longer pass, "auto" would floor the box at the HTML default of two lines.
     From zero the natural height is the CONTENT's — an empty textarea still
     reserves one line for its caret — so the composer opens on one line and
     climbs to the 120px ceiling exactly as it always did. */
  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  // The edit box keeps "auto": it was rows={2} before and the default is 2, so
  // measuring from auto preserves the two-line box the author is used to.
  const growEdit = useCallback(() => {
    const el = editRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  /* Height follows the VALUE, not the keystroke. An input event is not enough
     any more: a name picked off the mention dropdown and an emoji dropped at
     the caret both rewrite the draft without the textarea ever seeing one. */
  useEffect(() => { autoGrow(); }, [draft, autoGrow]);
  useEffect(() => { if (editingId) growEdit(); }, [editDraft, editingId, growEdit]);

  const send = async () => {
    if (!user) return toast("Sign in to chat.", "error");
    const content = draft.trim();
    const media = mediaUrl.trim();
    if ((!content && !media) || sending) return;
    const target = replyTarget;
    setSending(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guildId)}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          content: content || undefined,
          mediaUrl: media || undefined,
          replyToId: target?.id,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        if (r.status === 429) toast("Easy — one message every couple of seconds.", "error");
        else toast(d?.message || "Couldn't send that.", "error");
        return;
      }
      const raw: ChatMessage = d.data;
      // The sent row must already carry its quote. If the POST echo doesn't
      // include one, we still hold the target it was aimed at — use it, so the
      // quote is there on send rather than 8 seconds later.
      const msg: ChatMessage = target
        ? { ...raw, replyToId: raw.replyToId || target.id, replyTo: raw.replyTo || previewOf(target) }
        : raw;
      stickRef.current = true; // your own message always brings you to it
      setMessages((cur) => mergeRows(cur, [msg]));
      setDraft("");
      setMediaUrl("");
      setReplyTarget(null);
      // Shrink NOW rather than a frame later: the [draft] effect would do it
      // after the next paint, and clearing the node first makes the
      // measurement agree with the state we have just set (they never diverge,
      // so React has nothing to reconcile against).
      const el = taRef.current;
      if (el) { el.value = ""; autoGrow(); }
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setSending(false);
    }
  };

  const removeMessage = (m: ChatMessage) => {
    askConfirm({
      title: "Delete this message?",
      body: "It disappears from the chat for everyone. There's no undo.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          const r = await fetch(
            `${API_URL}/api/guilds/${encodeURIComponent(guildId)}/messages/${encodeURIComponent(m.id)}`,
            { method: "DELETE", headers: authHeaders() },
          );
          const d = await r.json().catch(() => null);
          if (!r.ok || !d?.success) return toast(d?.message || "Couldn't delete that.", "error");
          // If the poll cursor pointed at the deleted row, drop it — the next
          // poll refetches the last window and the fold absorbs it.
          if (lastIdRef.current === m.id) lastIdRef.current = null;
          if (replyTarget?.id === m.id) setReplyTarget(null);
          if (editingId === m.id) setEditingId(null);
          setMessages((cur) => cur.filter((x) => x.id !== m.id));
        } catch {
          toast("Couldn't delete that.", "error");
        }
      },
    });
  };

  /* ─────────────────────────── EDIT ─────────────────────────── */

  const startEdit = (m: ChatMessage) => {
    setReplyTarget(null);
    setOpenActionsId(null);
    setEditDraft(m.content || "");
    setEditingId(m.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  // Seed the caret at the end, size the box, and keep it above the soft
  // keyboard — which opens AFTER the focus and shrinks the panel under us, so
  // we ask a second time once it has settled.
  useEffect(() => {
    if (!editingId) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    el.scrollIntoView({ block: "nearest" });
    const t = setTimeout(() => editRef.current?.scrollIntoView({ block: "nearest" }), 320);
    return () => clearTimeout(t);
  }, [editingId]);

  const saveEdit = async (m: ChatMessage) => {
    if (savingEdit) return;
    const content = editDraft.trim();
    if (!content) return toast("A message can't be empty.", "error");
    if (content === (m.content || "").trim()) return cancelEdit();
    setSavingEdit(true);
    try {
      const r = await fetch(
        `${API_URL}/api/guilds/${encodeURIComponent(guildId)}/messages/${encodeURIComponent(m.id)}`,
        { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ content }) },
      );
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        if (r.status === 403) toast("Only the author can edit a message.", "error");
        else toast(d?.message || "Couldn't save that edit.", "error");
        return;
      }
      const raw: ChatMessage = d.data;
      // We KNOW this row was just edited. A backend that forgets to echo
      // editedAt must not cost us the marker — nor lose the fold's recency
      // test to the copy already on screen.
      const updated: ChatMessage = {
        ...raw,
        content: raw.content ?? content,
        editedAt: raw.editedAt || new Date().toISOString(),
      };
      setMessages((cur) => cur.map((x) => (x.id === updated.id ? foldServerRow(x, updated) : x)));
      cancelEdit();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  /* Rides the BOX around the edit textarea, so MentionsTextarea's own handler
     has already run and told us, through defaultPrevented, whether its
     dropdown claimed the key. */
  const onEditKey = (e: React.KeyboardEvent<HTMLDivElement>, m: ChatMessage) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // The mention list used this Enter to insert a name. Saving now would
      // commit "@dej" over the author's own words.
      if (e.defaultPrevented) return;
      e.preventDefault();
      saveEdit(m);
      return;
    }
    if (e.key === "Escape") {
      // The dock closes the entire panel on Escape (a window listener). While
      // an edit is open the key belongs to the edit — stop it getting there.
      // If the dropdown just ate the Escape to close itself, the edit stays
      // open, but the dock must STILL not see the key.
      if (e.defaultPrevented) { e.stopPropagation(); return; }
      e.preventDefault();
      e.stopPropagation();
      cancelEdit();
    }
  };

  /* ═══════════ THE COMPOSER'S KEYS — send, or pick a name? ═══════════
     Same bubble trick, same rule: an Enter that arrives here ALREADY
     defaultPrevented was consumed by the mention dropdown, and the only
     correct thing to do with it is nothing. Enter sends only when it reaches
     us untouched — which is precisely when no dropdown is open. */
  const onComposerKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.defaultPrevented) return;
      e.preventDefault();
      send();
      return;
    }
    if (e.key === "Escape") {
      // Dropdown first (it closed itself; keep the dock out of it), then the
      // reply. Only with nothing left to cancel does the key belong to the
      // dock's close listener.
      if (e.defaultPrevented) { e.stopPropagation(); return; }
      if (replyTarget) {
        e.preventDefault();
        e.stopPropagation();
        setReplyTarget(null);
      }
    }
  };

  /* A phone's keyboard opens AFTER the focus and can leave the composer — and
     the mention dropdown, which hangs directly ABOVE it — behind the keys. The
     dock already pays its measured visualViewport overlap as bottom padding,
     which lifts this whole block clear; on the guild page there is no such
     panel, so we ask for the same second look the edit box asks for once the
     viewport has settled. "nearest" is a no-op when it is already in view. */
  const onComposerFocus = () => {
    if (!coarse) return;
    setTimeout(() => composerBoxRef.current?.scrollIntoView({ block: "nearest" }), 320);
  };

  /* ─────────────────────────── REPLY ─────────────────────────── */

  const startReply = (m: ChatMessage) => {
    cancelEdit();
    setOpenActionsId(null);
    setReplyTarget(m);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  /** Scroll a quoted parent into view — or do nothing, if it isn't loaded. */
  const jumpToParent = (id: string | null) => {
    if (!id) return;
    const el = msgRefs.current.get(id);
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    const r = el.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    const delta = r.top - sr.top - (scroller.clientHeight - r.height) / 2;
    stickRef.current = false;
    scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + delta), behavior: "smooth" });
    setHighlightId(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1600);
  };

  // Own messages always; moderators (officers + moderateChat roles) sweep the room.
  const canDelete = (m: ChatMessage) => !!user && (m.userId === user.id || canModerate);

  /**
   * The @-autocomplete's candidate set: THIS guild's roster, nobody else.
   *
   * postMessage/editMessage hand processMentions an allow-list built from
   * GuildMember and drop everyone outside it, so a site-wide search here would
   * offer names the server has already decided not to notify — a dropdown
   * promising a ping into a room the target cannot even read. Already in hand
   * from the detail payload, so it costs no request.
   */
  const mentionCandidates = useMemo(
    () =>
      (guild?.members || []).map((m) => ({
        id: m.userId,
        username: m.username,
        avatar: m.avatar ?? null,
      })),
    [guild?.members]
  );
  // Editing is the author's alone — no officer override, at any rank. A row
  // with no text has nothing to edit (the PATCH carries content and refuses
  // an empty one), so a GIF-only message offers no pencil.
  const canEdit = (m: ChatMessage) => !!user && m.userId === user.id && !!m.content?.trim();

  /** Reply / Edit / Delete. Same three actions, two sizes: hover chip vs touch row. */
  const actionRow = (m: ChatMessage, touch: boolean) => {
    const base = touch
      ? "inline-flex h-11 min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[10px] font-black uppercase tracking-[0.14em] transition active:scale-95"
      : "grid h-7 w-7 place-items-center rounded-md transition hover:bg-white/10";
    const stop = (e: React.MouseEvent) => e.stopPropagation();
    return (
      <>
        <button type="button" title="Reply" aria-label="Reply to message"
          onClick={(e) => { stop(e); startReply(m); }}
          className={`${base} text-slate-400 hover:text-emerald-200`}>
          <CornerDownRight className="h-3.5 w-3.5 shrink-0 rotate-180" />
          {touch && <span>Reply</span>}
        </button>
        {canEdit(m) && (
          <button type="button" title="Edit" aria-label="Edit message"
            onClick={(e) => { stop(e); startEdit(m); }}
            className={`${base} text-slate-400 hover:text-sky-200`}>
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            {touch && <span>Edit</span>}
          </button>
        )}
        {canDelete(m) && (
          <button type="button" title="Delete" aria-label="Delete message"
            onClick={(e) => { stop(e); removeMessage(m); }}
            className={`${base} text-slate-500 hover:text-red-300`}>
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            {touch && <span>Delete</span>}
          </button>
        )}
      </>
    );
  };

  // Discord grouping: same author within 5 minutes stacks under one header;
  // a day boundary always breaks the run and plants a divider. A reply also
  // breaks it — a quote stacked under someone else's header reads as theirs.
  const chatRows = useMemo(() => {
    type Group = { kind: "group"; key: string; author: ChatAuthor | null; userId: string; firstAt: string; items: ChatMessage[] };
    type Row = { kind: "day"; key: string; label: string } | Group;
    const out: Row[] = [];
    let group: Group | null = null;
    let prev: ChatMessage | null = null;
    for (const m of messages) {
      const label = dayLabel(m.createdAt);
      if (!prev || dayLabel(prev.createdAt) !== label) {
        out.push({ kind: "day", key: `day-${m.id}`, label });
        group = null;
      }
      const sameAuthor = !!prev && prev.userId === m.userId;
      const close = !!prev && +new Date(m.createdAt) - +new Date(prev.createdAt) < 5 * 60 * 1000;
      const quotes = !!(m.replyToId || m.replyTo);
      if (group && sameAuthor && close && !quotes) {
        group.items.push(m);
      } else {
        group = { kind: "group", key: `grp-${m.id}`, author: m.author, userId: m.userId, firstAt: m.createdAt, items: [m] };
        out.push(group);
      }
      prev = m;
    }
    return out;
  }, [messages]);

  // The living-username tiers, roles slotted in: the effect gradient always
  // wins; with no effect, the guild role's colour takes the name; then the
  // shop colour; then plain white — the font cosmetics ride along throughout.
  // Role colour is a raw hex, so it travels as an inline style, not a class.
  const chatNameParts = (a: ChatAuthor | null, roleColor: string | null): { cls: string; style?: React.CSSProperties } => {
    const font =
      a?.activeFont === "font_cyber" ? "tracking-widest " :
      a?.activeFont === "font_pixel" ? "font-serif tracking-tight " : "";
    const effect = effectNameClass(a?.activeEffect);
    if (effect) return { cls: font + effect };
    if (roleColor) return { cls: font, style: { color: roleColor } };
    return { cls: font + (nameColorClass(a?.activeColor) || "text-white") };
  };

  /**
   * font-mono is stated HERE, not inherited.
   *
   * The guild page's root carries it, so the hall's copy of this room always
   * looked right — but the dock panel is portalled OUT of that page, so the
   * very same room rendered in the default sans there. One component, two
   * fonts, depending on where you opened it. Owning the base font fixes both
   * mounts and keeps it in the Lunar kit's register (font-fell for display,
   * font-mono for body).
   */
  const shell = className ?? "mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 font-mono sm:p-6";
  const scrollerHeight = heightClass ?? "h-[28rem]";

  return (
    <div className={shell}>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-emerald-300" />
        {/* font-fell: the redesign's display face, the same one the hall's
            headings, the stat tiles and the activity card wear. */}
        <p className="font-fell text-lg leading-none text-white">Guild chat</p>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
          Members only
        </span>
      </div>

      {!isMember ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-14 text-center">
          <Lock className="mx-auto h-6 w-6 text-slate-600" />
          <p className="mt-3 text-xs text-slate-500">Join the guild to enter the chat.</p>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className={`mt-4 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-black/30 px-4 py-3 ${scrollerHeight}`}
          >
            {loading ? (
              <p className="py-10 text-center text-xs text-slate-600">Opening the chat…</p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-600">Nothing said yet. First word is free.</p>
            ) : (
              chatRows.map((row) => {
                if (row.kind === "day") {
                  return (
                    <div key={row.key} className="my-4 flex items-center gap-3 first:mt-1">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-600">{row.label}</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                  );
                }
                const role = guild ? customRoleOf(guild, row.userId) : null;
                const name = chatNameParts(row.author, role?.color || null);
                return (
                  <div key={row.key} className="mt-3 flex items-start gap-3 first:mt-0">
                    <div className="relative mt-0.5 h-9 w-9 shrink-0">
                      {row.author?.avatar ? (
                        <img src={cloudinaryFit(row.author.avatar, 80)} alt="" className="relative z-10 h-9 w-9 rounded-full object-cover ring-1 ring-black/60" />
                      ) : (
                        <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full bg-emerald-800 text-xs font-black ring-1 ring-black/60">
                          {(row.author?.username || "?")[0]?.toUpperCase()}
                        </span>
                      )}
                      <AvatarDecoration effect={row.author?.activeEffect} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        {row.author?.username ? (
                          <UserLink username={row.author.username}
                            className={`text-sm font-black hover:underline ${name.cls}`}>
                            {name.style
                              ? <span style={name.style}>{row.author.username}</span>
                              : row.author.username}
                          </UserLink>
                        ) : (
                          <span className="text-sm font-black text-slate-400">someone</span>
                        )}
                        {guild && <RoleChip guild={guild} userId={row.userId} />}
                        <span className="text-[10px] font-bold tabular-nums text-slate-600">{hhmm(row.firstAt)}</span>
                      </div>
                      <div className="space-y-0.5">
                        {row.items.map((m) => {
                          const editing = editingId === m.id;
                          const quoting = !!(m.replyToId || m.replyTo);
                          const parentId = m.replyTo?.id || m.replyToId || null;
                          const showTouchActions = coarse && !editing && openActionsId === m.id;
                          const tone = highlightId === m.id
                            ? "bg-emerald-400/10 ring-1 ring-emerald-400/30"
                            : showTouchActions
                              ? "bg-white/[0.04]"
                              : "hover:bg-white/[0.03]";
                          return (
                            <div
                              key={m.id}
                              ref={(el) => {
                                const map = msgRefs.current;
                                if (el) map.set(m.id, el);
                                else map.delete(m.id);
                              }}
                              onClick={() => {
                                if (!coarse || editing) return;
                                setOpenActionsId((cur) => (cur === m.id ? null : m.id));
                              }}
                              className={`group/msg relative -mx-1.5 rounded-md px-1.5 py-px transition ${tone}`}
                            >
                              {quoting && (
                                <button type="button"
                                  onClick={(e) => { e.stopPropagation(); jumpToParent(parentId); }}
                                  aria-label="Go to the message this replies to"
                                  className="mb-0.5 flex w-full min-w-0 max-w-full items-center gap-1.5 overflow-hidden border-l-2 border-emerald-400/30 py-0.5 pl-2 text-left">
                                  <CornerDownRight className="h-3 w-3 shrink-0 rotate-180 text-slate-600" />
                                  <span className="min-w-0 flex-1 truncate text-[11px] leading-tight text-slate-500">
                                    {m.replyTo ? (
                                      <span className="font-black text-slate-400">{m.replyTo.username || "someone"}</span>
                                    ) : (
                                      <span className="italic text-slate-600">message deleted</span>
                                    )}
                                    {/* Emoji only, no mentions: this sits in a
                                        <button>, and MentionText would nest an
                                        <a> inside it. Same tokeniser either
                                        way, so a quote reads like its parent. */}
                                    {m.replyTo && (
                                      <span className="ml-1.5">
                                        {emojiNodes(snippetOf(m.replyTo), emojiCatalog.byName, stillEmoji, `q-${m.id}`)}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              )}

                              {editing ? (
                                <div className="my-1">
                                  {/* The box, not the textarea, carries the ref
                                      and the keys — see the header note. The
                                      click-stop rides it too, so tapping into
                                      the edit never toggles the action row. */}
                                  <div
                                    ref={editBoxRef}
                                    onKeyDown={(e) => onEditKey(e, m)}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MentionsTextarea
                                      candidates={mentionCandidates}
                                      value={editDraft}
                                      onChange={(e) => setEditDraft(e.target.value.slice(0, 500))}
                                      placeholder="Edit your message…"
                                      className="max-h-40 w-full resize-none rounded-xl border border-sky-400/40 bg-black/50 px-3 py-2 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none focus:border-sky-400/70"
                                    />
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <button type="button" disabled={savingEdit || !editDraft.trim()}
                                      onClick={(e) => { e.stopPropagation(); saveEdit(m); }}
                                      className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-30">
                                      <Check className="h-3.5 w-3.5" /> Save
                                    </button>
                                    <button type="button"
                                      onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                      className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 hover:text-white">
                                      <X className="h-3.5 w-3.5" /> Cancel
                                    </button>
                                    <span className="ml-auto text-[10px] font-bold tabular-nums text-slate-600">{editDraft.length}/500</span>
                                  </div>
                                  <p className="mt-1 text-[9px] text-slate-600">Enter saves · Shift+Enter for a new line · Esc cancels</p>
                                </div>
                              ) : (
                                m.content && (
                                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                                    {/* @names become links and :shortcodes:
                                        become images, from ONE pass over the
                                        string; the <p> keeps the typography and
                                        the pre-wrap, so line breaks and the
                                        marker below still sit where they always
                                        did. `break-words` on the <p> is what
                                        lets a long run of emoji wrap on a phone
                                        instead of pushing the line wide. */}
                                    <MentionText
                                      text={m.content}
                                      emojis={emojiCatalog.byName}
                                      stillEmoji={stillEmoji}
                                    />
                                    {m.editedAt && (
                                      <span
                                        title={`Edited ${new Date(m.editedAt).toLocaleString()}`}
                                        className="ml-1.5 select-none align-baseline text-[10px] font-bold text-slate-600">
                                        (edited)
                                      </span>
                                    )}
                                  </p>
                                )
                              )}

                              {m.mediaUrl && (
                                <img src={m.mediaUrl} alt="" loading="lazy"
                                  className="my-1 max-h-64 w-auto max-w-full rounded-xl object-contain"
                                  /* A dead media URL used to collapse to nothing
                                     (empty alt = invisible), which reads as the
                                     GIF having vanished. A failure now shows its
                                     face — and names itself for bug reports. */
                                  onError={(e) => {
                                    const img = e.currentTarget;
                                    if (img.dataset.failed) return;
                                    img.dataset.failed = "1";
                                    console.debug("[dv-gif] media failed to load", m.mediaUrl);
                                    img.outerHTML = '<span class="my-1 inline-block rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">GIF unavailable</span>';
                                  }} />
                              )}

                              {!coarse && !editing && (
                                <div className="absolute -top-2.5 right-0 hidden items-center gap-0.5 rounded-lg border border-white/10 bg-[#101018] p-0.5 shadow-lg group-hover/msg:flex group-focus-within/msg:flex">
                                  {actionRow(m, false)}
                                </div>
                              )}
                              {showTouchActions && (
                                <div className="mt-1.5 flex items-stretch gap-1.5 pb-1">
                                  {actionRow(m, true)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3">
            {replyTarget && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-1 pl-2 pr-1">
                <span aria-hidden className="h-7 w-0.5 shrink-0 rounded-full bg-emerald-400/70" />
                <p className="min-w-0 flex-1 truncate text-[11px] leading-tight text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Replying to</span>
                  <span className="ml-1.5 font-black text-slate-200">{replyTarget.author?.username || "someone"}</span>
                  <span className="ml-1.5 text-slate-500">
                    {emojiNodes(snippetOf(previewOf(replyTarget)), emojiCatalog.byName, stillEmoji, "reply-bar")}
                  </span>
                </p>
                <button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {mediaUrl && (
              <div className="mb-2 inline-flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
                <img src={mediaUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
                <button type="button" onClick={() => setMediaUrl("")} aria-label="Remove attachment"
                  className="grid h-11 w-11 place-items-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              {/* The box holds the flex slot (min-w-0 flex-1) and the keys; the
                  textarea inside it goes full width. h-11 is the FIRST-PAINT
                  height only — autoGrow owns an inline height from the first
                  effect onwards — and it keeps the untouched box on one line
                  instead of the two the missing rows={1} would otherwise give. */}
              <div
                ref={composerBoxRef}
                onKeyDown={onComposerKey}
                onFocusCapture={onComposerFocus}
                className="min-w-0 flex-1"
              >
                <MentionsTextarea
                  candidates={mentionCandidates}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                  placeholder={replyTarget ? `Reply to ${replyTarget.author?.username || "someone"}…` : "Message the guild…"}
                  className="h-11 max-h-[120px] w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
                />
              </div>
              <button type="button" onClick={send} aria-label="Send message"
                disabled={sending || (!draft.trim() && !mediaUrl.trim())}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-30">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* The guild's own emoji ride the same picker: a pick emits
                  ":name:" through the SAME onPick(string) a unicode emoji uses,
                  so insertEmoji drops it at the caret with no special case. An
                  empty catalog draws exactly the panel that shipped before. */}
              <EmojiPicker onPick={insertEmoji} customEmojis={emojiCatalog.emojis} />
              {/* Chat is emoji + GIF only — no device uploads in the hall. */}
              <MediaPicker value={mediaUrl} onChange={setMediaUrl} userId={user?.id} hideUpload />
              <span className="ml-auto text-[10px] font-bold tabular-nums text-slate-600">{draft.length}/500</span>
            </div>
            <p className="mt-1.5 text-[9px] text-slate-600">
              {coarse
                ? "Tap a message for reply, edit and delete · @ to mention"
                : "Enter sends · Shift+Enter for a new line · @ to mention"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
