"use client";

import { useUser } from "@/hooks/useUser";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { DISCORD_INVITE } from "@/lib/links";
import {
  Lock, Play, ArrowRight, Tv, BookMarked, BookOpen,
  Library, Users, Zap, MonitorPlay, Layers, Swords, Gem, Palette, MonitorSmartphone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Shared amethyst-purple text fill, matching the splash wordmark + site theme.
const AMETHYST: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(100deg, #6d28d9 0%, #a78bfa 18%, #f5f3ff 32%, #c4b5fd 46%, #8b5cf6 62%, #a78bfa 82%, #6d28d9 100%)",
  backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const easeCine: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** The keepers, by handle. Their avatars, frames and effects come from the
 *  PUBLIC profile endpoint at mount — the landing shows the real people,
 *  decorations and all, not initial-letter placeholders. */
const STAFF: { u: string; n: string; r: string; tint: string }[] = [
  { u: "dejavuh", n: "Dejavuh", r: "Lead Developer", tint: "#a78bfa" },
  { u: "davinci", n: "Da Vinci", r: "Admin", tint: "#f87171" },
  { u: "xhackerdevil", n: "xHackerDevil", r: "Bug Founder", tint: "#4ade80" },
  { u: "coffee", n: "Coffee", r: "Admin", tint: "#f87171" },
  { u: "speyvenerable", n: "SpeyVenerable", r: "Admin", tint: "#f87171" },
  { u: "ash", n: "Ash", r: "Admin", tint: "#f87171" },
];

type StaffProfile = { avatar?: string; frame?: string | null; effect?: string | null };
// One fetch per session, shared across remounts of the landing.
let staffCache: Record<string, StaffProfile> | null = null;

function useStaffProfiles(enabled: boolean): Record<string, StaffProfile> {
  const [profiles, setProfiles] = useState<Record<string, StaffProfile>>(staffCache || {});
  useEffect(() => {
    // Only the LANDING needs these — the guard also wraps every signed-in
    // page, and six profile fetches on every app boot for people who will
    // never see the staff section was pure waste.
    if (!enabled || staffCache) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    let live = true;
    Promise.allSettled(
      STAFF.map(async (s) => {
        const res = await fetch(`${API_URL}/api/users/username/${s.u}`);
        const d = await res.json();
        return [s.u, {
          avatar: d?.data?.avatar || undefined,
          frame: d?.data?.activeFrame || null,
          effect: d?.data?.activeEffect || null,
        }] as const;
      })
    ).then((settled) => {
      const out: Record<string, StaffProfile> = {};
      for (const r of settled) if (r.status === "fulfilled") out[r.value[0]] = r.value[1];
      // A total failure (backend waking up) is NOT cached — the next
      // mount gets to try again instead of initials forever.
      if (Object.keys(out).length > 0) staffCache = out;
      if (live) setProfiles(out);
    });
    return () => { live = false; };
  }, [enabled]);
  return profiles;
}

/**
 * The landing artwork. Drop a file at `public/landing-bg.jpg` and it appears
 * here and inside the wordmark.
 *
 * If the file is missing the page still works — the gradients underneath carry
 * it, and the title falls back to the amethyst fill. Nothing breaks, it just
 * looks like it did before.
 */
const LANDING_BG = "/landing-bg.jpg";

/**
 * The wordmark is a WINDOW onto the background rather than a painted colour.
 *
 * `background-attachment: fixed` is what makes it work: the image is anchored
 * to the viewport, not to the letters, so the art inside the text lines up
 * exactly with the art behind the page. Without it the fill would be a second,
 * differently-cropped copy and the illusion collapses.
 */
const WORDMARK_WINDOW: React.CSSProperties = {
  // TWO layers, and the order matters. The artwork sits on top; the amethyst
  // gradient sits under it as a floor. background-clip:text makes the letters
  // transparent, so if the image ever fails to load a single-layer version
  // renders NOTHING — the title simply disappears, which is exactly what
  // happened when the file wasn't deployed. The gradient guarantees letters.
  backgroundImage: `url(${LANDING_BG}), linear-gradient(100deg, #6d28d9 0%, #a78bfa 18%, #f5f3ff 32%, #c4b5fd 46%, #8b5cf6 62%, #a78bfa 82%, #6d28d9 100%)`,
  backgroundSize: "cover, 200% 100%",
  backgroundPosition: "center, center",
  // The page background is blurred; this one is NOT. Sharp art inside the
  // letters against a soft field is what makes the wordmark read as a window.
  backgroundAttachment: "fixed, scroll",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default function InviteOnlyGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const staffProfiles = useStaffProfiles(isLoaded && !user);

  /**
   * /login is the ONE route a signed-out visitor is allowed through to.
   * This guard wraps every page, so without the exemption the sign-in page
   * would render the landing page instead — the door would open onto the
   * door.
   */
  if (!user && pathname === "/login") return <>{children}</>;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-violet-300/20 border-t-violet-300/80 rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white selection:bg-violet-500/20">
        {/* ── THE ARTWORK ── a FIXED viewport layer, not absolute. The page
            scrolls now, and an absolute inset-0 layer would size against the
            whole multi-viewport document — cover-cropping the art into a
            zoomed sliver and dragging the scrim floor to the document
            bottom. Fixed keeps every layer exactly one viewport, glued in
            place while the sections scroll over it, and keeps the wordmark's
            window crop aligned with the art behind it. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            backgroundImage: `url(${LANDING_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            // Blur pushes the art back so the copy sits in front of it rather
            // than fighting it — but 14px erased the artwork entirely, leaving
            // a coloured haze. Six keeps it soft enough to read text over and
            // still recognisable as a picture. Scaled up because a blur samples
            // past its own edges and would otherwise leave a soft border.
            filter: "blur(6px) saturate(1.1)",
            transform: "scale(1.04)",
          }}
        />
        {/* Scrims. Two of them: a flat darkener so text is legible over any
            crop, and a bottom-heavy gradient so the viewport has a floor. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-black/55" />
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#050505]/85 via-transparent to-[#050505]" />
        {/* The original tri-mode ambience stays underneath — it is what carries
            the page if the artwork file isn't there yet. */}
        <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_32%,rgba(139,92,246,0.18)_0%,transparent_55%)]" />
        <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_20%_78%,rgba(220,38,38,0.12)_0%,transparent_50%)]" />
        <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_80%_75%,rgba(236,72,153,0.12)_0%,transparent_50%)]" />

        {/* ── FLOATING PILL BAR, with the mascot perched on top of it ── */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: easeCine }}
          className="absolute inset-x-0 top-9 z-20 flex justify-center px-4"
        >
          <div className="relative">
            {/* the mascot bobs gently above the bar, pointer tucked under it */}
            <motion.div
              aria-hidden
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute -top-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center"
            >
              <img src="/logo.png" alt="" className="h-10 w-10 rounded-full object-cover shadow-[0_6px_20px_rgba(0,0,0,.6)] ring-2 ring-white/25" />
              <span className="-mt-1 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white/90" />
            </motion.div>
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-2 py-1.5 backdrop-blur-xl sm:gap-2 sm:px-3">
              <span className="flex items-center gap-2 px-2 sm:pr-4">
                <img src="/logo.png" alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-violet-400/50" />
                <span className="font-fell text-sm font-bold uppercase tracking-[0.22em] text-white">Da Vinci</span>
              </span>
              <span className="rounded-full bg-white/12 px-4 py-1.5 text-[11px] font-bold text-white">Home</span>
              <span className="hidden items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-300 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Anime
              </span>
              <span className="hidden items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-300 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Manhwa
              </span>
              <span className="hidden items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-300 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-pink-400" /> Novels
              </span>
              <button
                onClick={() => router.push("/login")}
                className="rounded-full px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Enter
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── HERO ── the owner's reference layout: status pills, the huge
            wordmark with art living inside the letters, one mono tagline
            with the load-bearing words in white, two doors, and the three
            arts as a breadcrumb trail. */}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: easeCine }}
            className="mb-8 flex flex-wrap items-center justify-center gap-2"
          >
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3.5 py-1.5 backdrop-blur">
              <Lock className="h-3 w-3 text-emerald-300" strokeWidth={2.5} />
              <span className="font-mono text-[11px] font-bold tracking-wide text-slate-200">invitation only</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3.5 py-1.5 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              <span className="font-mono text-[11px] font-bold tracking-wide text-slate-200">three arts inside</span>
            </span>
          </motion.div>

          {/* The wordmark — a window onto the art behind it */}
          <motion.h1
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease: easeCine }}
            className="font-fell text-6xl font-bold uppercase leading-none tracking-[0.16em] pl-[0.16em] drop-shadow-[0_6px_40px_rgba(0,0,0,0.9)] sm:text-8xl md:text-[9rem]"
            style={WORDMARK_WINDOW}
          >
            Da Vinci
          </motion.h1>

          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.28, ease: easeCine }}
            className="mx-auto mt-8 mb-10 max-w-2xl font-mono text-base leading-relaxed text-slate-400 md:text-lg"
          >
            The anime, manhwa &amp; light-novel atelier that&apos;s{" "}
            <strong className="font-bold text-white">invitation-only</strong>,{" "}
            <strong className="font-bold text-white">ad-free</strong>, and{" "}
            <strong className="font-bold text-white">beautiful</strong>.
          </motion.p>

          {/* ── TWO DOORS ── the white one starts the journey (the modal
              handles both new seals and returning ones), the dark one goes
              to the atelier's Discord. */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.4, ease: easeCine }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <button
              onClick={() => router.push("/login")}
              className="group inline-flex items-center gap-2.5 rounded-2xl bg-white px-8 py-3.5 font-mono text-sm font-black text-black shadow-[0_10px_40px_rgba(0,0,0,.6)] transition hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              Start Watching
            </button>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.06] px-7 py-3.5 font-mono text-sm font-bold text-slate-100 backdrop-blur transition hover:bg-white/10"
            >
              Join Discord
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </a>
          </motion.div>

          {/* ── THE THREE ARTS, as a trail ── each one is a door too. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease: easeCine }}
            className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[12px] font-bold"
          >
            <button onClick={() => router.push("/login")} className="flex items-center gap-2 text-slate-300 transition hover:text-violet-300">
              <Tv className="h-3.5 w-3.5" /> Anime <span className="text-slate-600">&rsaquo;</span>
            </button>
            <button onClick={() => router.push("/login")} className="flex items-center gap-2 text-slate-300 transition hover:text-red-300">
              <BookMarked className="h-3.5 w-3.5" /> Manhwa <span className="text-slate-600">&rsaquo;</span>
            </button>
            <button onClick={() => router.push("/login")} className="flex items-center gap-2 text-slate-300 transition hover:text-pink-300">
              <BookOpen className="h-3.5 w-3.5" /> Novel <span className="text-slate-600">&rsaquo;</span>
            </button>
          </motion.div>
        </div>

        {/* ── BELOW THE FOLD ── the reference landing keeps going: a title
            marquee, the numbers, what makes the place different, and the
            people running it — all with OUR truth, no borrowed claims. */}

        {/* the marquee — beloved titles drifting past, twice over for a
            seamless loop. transform-only, so it never leaves the GPU. */}
        <div className="relative z-10 overflow-hidden border-y border-white/10 bg-black/40 py-4 backdrop-blur">
          {/* NO gap on the track — each half carries its own trailing pr-10,
              so the track is exactly twice the pattern period and the
              translateX(-50%) wrap is pixel-seamless. A track gap left the
              loop 20px short and it snapped once per cycle. */}
          <div className="lp-marquee flex w-max items-center whitespace-nowrap font-mono text-sm text-slate-400">
            {[0, 1].map((half) => (
              <span key={half} aria-hidden={half === 1} className="flex items-center gap-10 pr-10">
                {[
                  ["Dragon Ball", "ドラゴンボール"], ["Attack on Titan", "進撃の巨人"],
                  ["Demon Slayer", "鬼滅の刃"], ["Naruto", "ナルト"],
                  ["Jujutsu Kaisen", "呪術廻戦"], ["Death Note", "デスノート"],
                  ["Bleach", "ブリーチ"], ["One Piece", "ワンピース"],
                  ["Solo Leveling", "나 혼자만 레벨업"], ["Frieren", "葬送のフリーレン"],
                ].map(([en, jp]) => (
                  <span key={en} className="flex items-center gap-10">
                    <span>{en} <span className="text-slate-600">{jp}</span></span>
                    <span className="text-slate-700">•</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* the numbers — ours, honestly */}
        <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 py-20 lg:grid-cols-4">
          {[
            { Icon: Library, big: "20,000+", small: "Titles inside" },
            { Icon: Users, big: "Invite", small: "Only members" },
            { Icon: Zap, big: "Zero", small: "Ads, ever" },
            { Icon: MonitorPlay, big: "HD", small: "Max quality" },
          ].map(({ Icon, big, small }) => (
            <div key={small} className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-9 backdrop-blur">
              <Icon className="h-5 w-5 text-violet-300" />
              <span className="font-mono text-3xl font-black text-white sm:text-4xl">{big}</span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{small}</span>
            </div>
          ))}
        </div>

        {/* what makes it different — every card is a thing that EXISTS here */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 pb-20">
          <h2 className="text-center font-mono text-3xl font-black text-white sm:text-4xl">Everything you need</h2>
          <p className="mx-auto mt-3 max-w-md text-center font-mono text-sm leading-relaxed text-slate-500">
            Built for the devoted, by the devoted. Here&apos;s what makes Da Vinci different.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { Icon: Tv, t: "Three Arts in One", d: "Anime to watch, manhwa and light novels to read — one vault, one account." },
              { Icon: Layers, t: "Arise Cards", d: "A living card game — being rebuilt from the ground up right now." },
              { Icon: Swords, t: "Card Duels", d: "Stake your deck against another member and fight it out." },
              { Icon: Gem, t: "Earn as You Go", d: "Watching and reading pays Arise Points — the currency of everything here." },
              { Icon: Palette, t: "Full Customization", d: "Profile frames, canvas effects, animated titles, showcases." },
              { Icon: MonitorSmartphone, t: "App & Sync", d: "Installable on your phone; progress follows you across devices." },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-black/45 p-6 backdrop-blur transition-colors hover:border-violet-400/30">
                <Icon className="h-5 w-5 text-slate-300" />
                <p className="mt-4 font-mono text-base font-black text-white">{t}</p>
                <p className="mt-2 font-mono text-xs leading-relaxed text-slate-500">{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* the people keeping it open */}
        <div className="relative z-10 border-t border-white/10 bg-black/30 px-4 py-20 backdrop-blur">
          <h2 className="text-center font-mono text-3xl font-black text-white sm:text-4xl">The keepers</h2>
          <p className="mx-auto mt-3 max-w-md text-center font-mono text-sm leading-relaxed text-slate-500">
            The people keeping the atelier open.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STAFF.map(({ u, n, r, tint }) => {
              const p = staffProfiles[u];
              return (
                <div key={u} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3.5 backdrop-blur">
                  <span className="relative h-10 w-10 shrink-0">
                    {p?.avatar ? (
                      <img src={p.avatar} alt="" className="relative z-10 h-10 w-10 rounded-full object-cover ring-1 ring-white/20" />
                    ) : (
                      <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full font-mono text-sm font-black text-white"
                        style={{ background: `${tint}22`, boxShadow: `inset 0 0 0 1.5px ${tint}66` }}>
                        {n[0]}
                      </span>
                    )}
                    {/* their real equipped frame + profile effect */}
                    <AvatarDecoration frame={p?.frame} effect={p?.effect} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-black text-white">{n}</span>
                    <span className="block font-mono text-[11px] font-bold" style={{ color: tint }}>{r}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer — in flow now that the page scrolls */}
        <div className="relative z-10 py-10 text-center text-violet-100/25 text-xs tracking-[0.3em] uppercase font-cinzel">
          &copy; {new Date().getFullYear()} Da Vinci &middot; All Rights Reserved
        </div>

        <style jsx global>{`
          .lp-marquee {
            animation: lpMarquee 48s linear infinite;
          }
          @keyframes lpMarquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          @media (prefers-reduced-motion: reduce) {
            .lp-marquee { animation: none; }
          }
        `}</style>

        {/* Signing in has its own page now. The guard lets /login through
            above, and once you're in it swaps straight to the page beneath —
            the landing lives at "/", so Start Watching lands on the
            homefeed. */}
      </div>
    );
  }

  return <>{children}</>;
}
