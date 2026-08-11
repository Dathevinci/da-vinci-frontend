"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Lock, MessageSquare, Send, Shield, Trash2, X } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
import UserLink from "@/components/profile/UserLink";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { effectNameClass } from "@/lib/effectTheme";
import { nameColorClass } from "@/lib/cosmetics";
import MediaPicker from "@/components/community/MediaPicker";
import EmojiPicker from "@/components/community/EmojiPicker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE GUILD CHAT ROOM — Discord-style, members only.
 *
 * Lifted out of the guild hall page verbatim so it can be mounted twice: in
 * its old place on /guild/[id], and inside the dock's slide-over panel, which
 * is what lets guildmates keep talking from anywhere on the site.
 *
 * Nothing about the behaviour changed in the move: an 8-second poll that goes
 * quiet whenever the tab is hidden, a cursor taken only from SERVER-confirmed
 * messages, dedupe on merge, stick-to-bottom within 80px, Enter sends and
 * Shift+Enter breaks the line, 500 characters, emoji and GIFs only.
 *
 * `guild` is optional because the dock resolves the viewer's guild from a
 * summary endpoint that carries no member list: with it, names wear their role
 * colours and every message gets its role chip; without it the room still
 * reads and sends, it just draws no chips. Deletion rights are re-checked by
 * the server either way — `canModerate` only decides what is worth showing.
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

export type ChatMessage = {
  id: string;
  userId: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
  author: ChatAuthor | null;
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
  /** The scroller's height. Defaults to the hall's fixed 28rem. */
  heightClass?: string;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Stick-to-bottom: true while the reader sits within ~80px of the newest
  // message. New arrivals only pull the scroll down when this is true, so
  // reading history is never interrupted.
  const stickRef = useRef(true);
  const firstScrollRef = useRef(true);
  // The newest id the SERVER has confirmed — polls ask for strictly newer
  // rows. Optimistic sends deliberately do NOT advance it, so a message that
  // landed between the last poll and our own send is never skipped; our own
  // copy simply comes back once more and is deduped.
  const lastIdRef = useRef<string | null>(null);

  const fetchNew = useCallback(async (initial: boolean) => {
    try {
      const base = `${API_URL}/api/guilds/${encodeURIComponent(guildId)}/messages`;
      const after = initial ? null : lastIdRef.current;
      const url = after ? `${base}?after=${encodeURIComponent(after)}&limit=60` : `${base}?limit=60`;
      const r = await fetch(url, { headers: authHeaders() });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return;
      // The array rides at data's root — there is no { messages } wrapper.
      const rows: ChatMessage[] = Array.isArray(d.data) ? d.data : [];
      if (rows.length > 0) lastIdRef.current = rows[rows.length - 1].id;
      if (rows.length === 0 && !initial) return;
      setMessages((cur) => {
        // after-poll: append what's genuinely new; full window: refresh over
        // whatever optimistic rows the window missed. Sorted either way.
        const merged = after
          ? [...cur, ...rows.filter((m) => !cur.some((x) => x.id === m.id))]
          : [...rows, ...cur.filter((m) => !rows.some((x) => x.id === m.id))];
        merged.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt) || a.id.localeCompare(b.id));
        return merged;
      });
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
    const start = () => { if (timer === null) timer = setInterval(() => fetchNew(false), 8000); };
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { fetchNew(false); start(); }
      else stop();
    };
    fetchNew(true);
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [isMember, fetchNew]);

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

  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const send = async () => {
    if (!user) return toast("Sign in to chat.", "error");
    const content = draft.trim();
    const media = mediaUrl.trim();
    if ((!content && !media) || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guildId)}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: content || undefined, mediaUrl: media || undefined }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        if (r.status === 429) toast("Easy — one message every couple of seconds.", "error");
        else toast(d?.message || "Couldn't send that.", "error");
        return;
      }
      const msg: ChatMessage = d.data;
      stickRef.current = true; // your own message always brings you to it
      setMessages((cur) => (cur.some((m) => m.id === msg.id) ? cur : [...cur, msg]));
      setDraft("");
      setMediaUrl("");
      const el = taRef.current;
      if (el) el.style.height = "auto";
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
          // poll refetches the last window and the dedupe merge absorbs it.
          if (lastIdRef.current === m.id) lastIdRef.current = null;
          setMessages((cur) => cur.filter((x) => x.id !== m.id));
        } catch {
          toast("Couldn't delete that.", "error");
        }
      },
    });
  };

  // Own messages always; moderators (officers + moderateChat roles) sweep the room.
  const canDelete = (m: ChatMessage) => !!user && (m.userId === user.id || canModerate);

  // Discord grouping: same author within 5 minutes stacks under one header;
  // a day boundary always breaks the run and plants a divider.
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
      if (group && sameAuthor && close) {
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

  const shell = className ?? "mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6";
  const scrollerHeight = heightClass ?? "h-[28rem]";

  return (
    <div className={shell}>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-emerald-300" />
        <p className="text-sm font-black text-white">Guild chat</p>
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
                        <img src={row.author.avatar} alt="" className="relative z-10 h-9 w-9 rounded-full object-cover ring-1 ring-black/60" />
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
                        {row.items.map((m) => (
                          <div key={m.id} className="group/msg relative -mx-1.5 rounded-md px-1.5 py-px transition hover:bg-white/[0.03]">
                            {m.content && (
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{m.content}</p>
                            )}
                            {m.mediaUrl && (
                              <img src={m.mediaUrl} alt="" loading="lazy"
                                className="my-1 max-h-64 w-auto max-w-full rounded-xl object-contain" />
                            )}
                            {canDelete(m) && (
                              <button type="button" onClick={() => removeMessage(m)} aria-label="Delete message"
                                className="absolute -top-1.5 right-0 hidden h-6 w-6 place-items-center rounded-md border border-white/10 bg-[#101018] text-slate-500 shadow transition hover:text-red-300 group-hover/msg:grid">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3">
            {mediaUrl && (
              <div className="mb-2 inline-flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
                <img src={mediaUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
                <button type="button" onClick={() => setMediaUrl("")} aria-label="Remove attachment"
                  className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={taRef}
                value={draft}
                rows={1}
                onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                onInput={autoGrow}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="Message the guild…"
                className="max-h-[120px] min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
              />
              <button type="button" onClick={send} aria-label="Send message"
                disabled={sending || (!draft.trim() && !mediaUrl.trim())}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-30">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EmojiPicker onPick={insertEmoji} />
              {/* Chat is emoji + GIF only — no device uploads in the hall. */}
              <MediaPicker value={mediaUrl} onChange={setMediaUrl} userId={user?.id} hideUpload />
              <span className="ml-auto text-[10px] font-bold tabular-nums text-slate-600">{draft.length}/500</span>
            </div>
            <p className="mt-1.5 text-[9px] text-slate-600">Enter sends · Shift+Enter for a new line</p>
          </div>
        </>
      )}
    </div>
  );
}
