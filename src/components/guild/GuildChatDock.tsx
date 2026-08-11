"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { usePreferences } from "@/hooks/usePreferences";
import { authHeaders } from "@/lib/authToken";
import { cacheGuildId } from "@/lib/guild";
import GuildChatRoom, { ChatConfirmSpec, GuildChatGuild } from "@/components/guild/GuildChatRoom";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE GUILD CHAT DOCK — your guild's room, from any page on the site.
 *
 * A button in the dock pill and a slide-over panel that mounts the very same
 * GuildChatRoom the guild hall renders. Nothing here exists for a viewer with
 * no guild: no button, no panel, and above all NO POLLING.
 *
 * WHAT IT COSTS, AND WHY THOSE NUMBERS
 * The whole site now pays for the unread dot, so the closed-panel poll is the
 * cheapest question we can ask — GET /messages/head, one row, no author join —
 * every 60 SECONDS and only while the tab is visible. The room's own 8-second
 * poll is a different budget: it only runs while somebody is actually reading.
 * The two never run together — opening the panel stops the head poll, closing
 * it starts it again — and the open/close edges each fire ONE head request to
 * settle what has been seen.
 *
 * THE Z-LADDER (whole app, bottom to top)
 *   z-[75]   the dock pill
 *   z-[80]   the dock's navigation sheet
 *   z-[105]  this panel's backdrop
 *   z-[110]  this panel
 *   z-[120]  the guild page's own sheets (edit / lend / roles)
 *   z-[140]  the themed confirm — the page's, and ours
 * So the chat panel covers the dock and its nav sheet, and is in turn covered
 * by anything the guild page itself opens. Our delete confirm rides at the
 * same 140 tier as the page's, which is the only thing that must ever sit on
 * top of the panel.
 *
 * NO backdrop-filter anywhere in here: it is banned on large elements in this
 * app (it re-blurs every scroll frame) and a full-height sheet is as large as
 * elements get.
 *
 * THE SOFT KEYBOARD
 * A phone's keyboard does not shrink the layout viewport, so a `fixed inset-0`
 * sheet keeps its full height and quietly parks its composer — and the room's
 * reply bar and inline edit box — behind the keys. Only visualViewport knows
 * the difference, so we measure the overlap ourselves and pay it as bottom
 * padding, which shrinks the scroller instead of hiding the controls. With no
 * keyboard up the overlap is zero and the safe-area inset takes over again.
 */

/** The summary GET /api/guilds/of/:userId answers with — no members, no roles. */
type GuildOf = {
  id: string;
  name: string;
  tag: string;
  avatar: string | null;
  banner: string | null;
  level: number;
  xp: number;
  shards: number;
  memberCount: number;
  role: string;
  joinedAt: string;
};

/** The full detail, fetched lazily on first open so chips wear their colours. */
type GuildDetail = GuildChatGuild & {
  roles?: GuildChatGuild["roles"];
};

const seenKey = (guildId: string) => `davinci_guild_lastseen_${guildId}`;

const readSeen = (guildId: string): string | null => {
  try {
    return localStorage.getItem(seenKey(guildId));
  } catch {
    return null;
  }
};

const writeSeen = (guildId: string, messageId: string | null) => {
  try {
    if (messageId) localStorage.setItem(seenKey(guildId), messageId);
    else localStorage.removeItem(seenKey(guildId));
  } catch {
    /* storage unavailable — the dot simply never sticks between visits */
  }
};

export default function GuildChatDock({
  hovered, setHovered, reduce,
}: {
  /** The dock pill's shared hover id, so the lit pill slides onto us too. */
  hovered: string | null;
  setHovered: (v: string | null) => void;
  reduce: boolean;
}) {
  const { user } = useUser();
  const { preferences } = usePreferences();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<GuildOf | null>(null);
  const [detail, setDetail] = useState<GuildDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [confirmSpec, setConfirmSpec] = useState<ChatConfirmSpec | null>(null);
  // sm and up gets a right rail; below sm a bottom sheet. One transform each,
  // picked here rather than guessed, because framer animates values not classes.
  const [wide, setWide] = useState(false);
  // How much of the panel the soft keyboard is currently eating, in px.
  const [keyboardInset, setKeyboardInset] = useState(0);
  const lastSeenRef = useRef<string | null>(null);
  // Mirrors `open` for the route-change effect, which must not re-run (and so
  // must not depend on) the open state itself.
  const openRef = useRef(false);
  const pathRef = useRef<string | null>(null);

  const guildId = summary?.id || null;
  // Performance Mode (preferences.reducedMotion) and the OS setting both mean
  // the same thing here: the panel appears, it does not travel.
  const instant = reduce || preferences.reducedMotion;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* ── WHICH GUILD — one authoritative call, cached for everyone else ── */
  useEffect(() => {
    if (!user?.id) { setSummary(null); setDetail(null); return; }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/guilds/of/${encodeURIComponent(user.id)}`);
        const d = await r.json().catch(() => null);
        if (!alive || !r.ok || !d?.success) return;
        const g: GuildOf | null = d.data || null;
        setSummary(g);
        // Keep every other surface's "my guild" pointer honest, both ways.
        cacheGuildId(g?.id || null);
        if (g) lastSeenRef.current = readSeen(g.id);
      } catch {
        /* offline — no button rather than a button that cannot open */
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  /** The newest message id, or null on an empty room. */
  const fetchHead = useCallback(async (id: string): Promise<string | null> => {
    try {
      const r = await fetch(
        `${API_URL}/api/guilds/${encodeURIComponent(id)}/messages/head`,
        { headers: authHeaders() },
      );
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return null;
      return d.data?.id ?? null;
    } catch {
      return null;
    }
  }, []);

  /** Everything up to now counts as read. Fired on the open and close edges. */
  const markSeen = useCallback(async (id: string) => {
    const head = await fetchHead(id);
    if (!head) return;
    lastSeenRef.current = head;
    writeSeen(id, head);
    setUnread(false);
  }, [fetchHead]);

  /* ── THE UNREAD DOT — 60s, visible tabs only, CLOSED panels only ── */
  useEffect(() => {
    if (!guildId || open) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let alive = true;
    const tick = async () => {
      const head = await fetchHead(guildId);
      if (!alive) return;
      setUnread(!!head && head !== lastSeenRef.current);
    };
    const start = () => { if (timer === null) timer = setInterval(tick, 60000); };
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { tick(); start(); }
      else stop();
    };
    if (document.visibilityState === "visible") { tick(); start(); }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [guildId, open, fetchHead]);

  /* ── THE FULL DETAIL — members and roles, so chips and name colours work.
        Fetched on the first open only; the summary endpoint carries neither. ── */
  useEffect(() => {
    if (!open || !guildId || detail) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guildId)}`, { headers: authHeaders() });
        const d = await r.json().catch(() => null);
        if (alive && r.ok && d?.success && d.data) setDetail(d.data);
      } catch {
        /* the room reads and sends fine without chips */
      }
    })();
    return () => { alive = false; };
  }, [open, guildId, detail]);

  /* ── The page behind the panel must not scroll (the app's sheet rule) ── */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* ── THE KEYBOARD OVERLAP — measured, not guessed ──
        `innerHeight` is the layout viewport (unchanged by the keyboard);
        visualViewport is what the user can actually see. The difference, once
        it is big enough to be keys rather than a collapsing URL bar, is the
        padding the panel owes its composer. iOS also SCROLLS the visual
        viewport, hence offsetTop in the sum. ── */
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const overlap = window.innerHeight - (vv.height + vv.offsetTop);
      setKeyboardInset(overlap > 80 ? Math.round(overlap) : 0);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      setKeyboardInset(0);
    };
  }, [open]);

  /* ── Escape closes, exactly like every other sheet here ── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { openRef.current = open; }, [open]);

  /* ── A route change closes it. The only way to navigate with the panel up
        is a username inside the chat; leaving the sheet over the page you just
        asked for would strand you on a locked screen you can't see. ── */
  useEffect(() => {
    if (pathRef.current === null) { pathRef.current = pathname; return; }
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    if (!openRef.current) return;
    setOpen(false);
    if (guildId) markSeen(guildId);
  }, [pathname, guildId, markSeen]);

  const openPanel = () => {
    setOpen(true);
    setUnread(false);
    if (guildId) markSeen(guildId);
  };

  const closePanel = () => {
    setOpen(false);
    // Whatever the room's own poll pulled in while you were reading is read.
    if (guildId) markSeen(guildId);
  };

  // No user, no guild, nothing at all — not even a mounted poller.
  if (!user || !guildId || !summary) return null;

  // Standing in your own hall, the page's room IS the chat. Mounting the dock
  // room too would render the same stream twice and double its 8s poll, so
  // the button steps aside there (its head poll is already redundant).
  if (pathname?.startsWith(`/guild/${guildId}`) || pathname?.startsWith(`/guilds/${guildId}`)) return null;

  const on = hovered === "guildchat";

  /**
   * The button is a faithful copy of BottomDock's DockBtn idiom — same pill,
   * same shared `dock-glow` layoutId so the lit backdrop SLIDES onto it from
   * its neighbours, same lift-and-grow. It is copied rather than imported so
   * the dock and the guild feature don't import each other in a cycle.
   */
  const button = (
    <button
      onClick={() => { if (open) closePanel(); else openPanel(); }}
      aria-label="Guild chat"
      aria-expanded={open}
      onMouseEnter={() => setHovered("guildchat")}
      onFocus={() => setHovered("guildchat")}
      onBlur={() => setHovered(null)}
      className={`relative grid h-10 w-10 place-items-center rounded-full transition-colors active:scale-90 ${
        on || open ? "text-white" : "text-slate-300"
      }`}
    >
      {on && !reduce && (
        <motion.span
          layoutId="dock-glow"
          transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.6 }}
          className="absolute inset-0 rounded-full"
          style={{ background: "rgba(255,255,255,.12)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}
        />
      )}
      {on && reduce && <span className="absolute inset-0 rounded-full bg-white/10" />}
      <motion.span
        className="relative flex"
        animate={reduce ? { y: 0, scale: 1 } : { y: on ? -2.5 : 0, scale: on ? 1.14 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 24, mass: 0.5 }}
      >
        <MessageSquare className="h-[17px] w-[17px]" />
        {/* The dot sits inside the 40px button, well clear of the pill's edge. */}
        {unread && !open && (
          <span
            aria-hidden
            className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-emerald-400"
            style={{ boxShadow: "0 0 0 2px rgba(10,9,15,.95), 0 0 8px rgba(52,211,153,.9)" }}
          />
        )}
      </motion.span>
      {unread && !open && <span className="sr-only">Unread guild messages</span>}
    </button>
  );

  const panel = (
    <AnimatePresence>
      {open && (
        <>
          {/* Below lg the panel is modal — tap the dark to dismiss. From lg
              the rail is narrow enough that the page stays usable beside it,
              so no scrim is drawn there. */}
          <motion.div
            key="guild-chat-backdrop"
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: instant ? 0 : 0.18 }}
            onClick={closePanel}
            className="fixed inset-0 z-[105] bg-black/60 lg:hidden"
          />
          <motion.div
            key="guild-chat-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`${summary.name} guild chat`}
            initial={instant ? false : (wide ? { x: 400 } : { y: "100%" })}
            animate={{ x: 0, y: 0 }}
            exit={instant ? { opacity: 0 } : (wide ? { x: 400 } : { y: "100%" })}
            transition={instant
              ? { duration: 0 }
              : { type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
            className="fixed inset-0 z-[110] flex flex-col border-white/10 bg-[#0b0b11] sm:left-auto sm:w-[380px] sm:border-l"
          >
            {/* ── header: crest, [TAG] name, and a 44px close ── */}
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-2.5">
              {summary.avatar ? (
                <img src={summary.avatar} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-emerald-400/30" />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-900/60 font-fell text-lg text-emerald-200 ring-1 ring-emerald-400/20">
                  {summary.name?.[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-mono text-sm font-black text-white">
                  <span className="shrink-0 text-[10px] font-black tracking-[0.16em] text-emerald-300">[{summary.tag}]</span>
                  <span className="min-w-0 truncate">{summary.name}</span>
                </p>
                <p className="font-mono text-[10px] text-slate-500">{summary.memberCount} members</p>
              </div>
              <button type="button" onClick={closePanel} aria-label="Close guild chat"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* The composer must clear the phone's home indicator — and, when
                it is up, the keyboard, which covers the home indicator anyway
                so the two never need adding together. Safe-area insets only
                exist as an env() value, so they travel in a style object —
                Tailwind cannot spell them. */}
            <div
              className="flex min-h-0 flex-1 flex-col font-mono text-white"
              style={{
                paddingBottom: keyboardInset > 0 ? `${keyboardInset}px` : "env(safe-area-inset-bottom)",
              }}
            >
              <GuildChatRoom
                key={guildId}
                guildId={guildId}
                guild={detail}
                isMember
                canModerate={canModerate(detail, user.id)}
                askConfirm={setConfirmSpec}
                className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3"
                heightClass="min-h-0 flex-1"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  /* ── The delete confirm, same dressing as the guild hall's, one tier up
        from the panel so it is never buried under it. ── */
  const confirm = confirmSpec && (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmSpec(null)} />
      <div role="alertdialog" aria-modal="true" aria-label={confirmSpec.title}
        className="relative w-full max-w-sm rounded-2xl border border-emerald-400/20 bg-[#0b0b11] p-6 font-mono">
        <p className="font-fell text-2xl leading-tight text-white">{confirmSpec.title}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{confirmSpec.body}</p>
        <div className="mt-6 flex items-center justify-end gap-2">
          {/* Focus lands on CANCEL: a stray Enter must never delete. */}
          <button type="button" autoFocus onClick={() => setConfirmSpec(null)}
            className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.1] hover:text-white">
            Cancel
          </button>
          <button type="button"
            onClick={() => { const s = confirmSpec; setConfirmSpec(null); s.onConfirm(); }}
            className={`rounded-xl border px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${
              confirmSpec.danger
                ? "border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
            }`}>
            {confirmSpec.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  /**
   * The panel is PORTALLED to the body on purpose. The dock pill is a
   * framer-motion element: while it slides in or out it carries a real
   * transform, and a transformed ancestor becomes the containing block for
   * every `fixed` descendant — which would pin a full-screen sheet inside a
   * 300px pill. The button stays in the pill's flex row (a fragment adds no
   * box); only the overlay leaves.
   */
  return (
    <>
      {button}
      {mounted && createPortal(
        <>
          {panel}
          {confirm}
        </>,
        document.body,
      )}
    </>
  );
}

/**
 * Which controls are worth SHOWING — the server re-checks every delete anyway.
 * Officers always; otherwise a custom role carrying moderateChat.
 */
function canModerate(guild: GuildDetail | null, userId: string): boolean {
  if (!guild) return false;
  if (guild.leaderId === userId || guild.coLeaderId === userId) return true;
  const me = guild.members?.find((m) => m.userId === userId);
  if (!me?.customRoleId) return false;
  const role = (guild.roles || []).find((r) => r.id === me.customRoleId);
  return !!role?.permissions?.moderateChat;
}
