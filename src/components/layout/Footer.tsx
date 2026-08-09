import Link from "next/link";
import { DISCORD_INVITE } from "@/lib/links";

/**
 * THE FOOTER — the reference's clean board: centred brand + tagline,
 * three quiet link columns, then the copyright line and the content
 * disclaimer. Every link is a place that exists.
 */

const COLUMNS: { title: string; links: { name: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Browse",
    links: [
      { name: "Explore", href: "/explore" },
      { name: "Trending", href: "/explore?sort=trending&title=Trending" },
      { name: "Schedule", href: "/calendar" },
      { name: "Airing Now", href: "/airing" },
    ],
  },
  {
    title: "Community",
    links: [
      { name: "Discord Server", href: DISCORD_INVITE, external: true },
      { name: "Forums", href: "/community" },
      { name: "Support", href: "/support" },
      { name: "Updates", href: "/updates" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "DMCA Policy", href: "/dmca" },
      { name: "Terms of Service", href: "/terms" },
      { name: "Privacy Policy", href: "/privacy" },
      { name: "FAQ", href: "/faq" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative mt-20 border-t border-white/10 bg-[#050505] pb-28 pt-14">
      <div className="mx-auto max-w-5xl px-6">
        {/* brand */}
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-violet-400/40" />
            <span className="font-fell text-lg font-bold uppercase tracking-[0.2em] text-white">Da Vinci</span>
          </Link>
          <p className="mt-4 max-w-xl font-mono text-sm leading-relaxed text-slate-500">
            Your invitation-only atelier for anime streaming, manhwa and light-novel
            reading — with the card game underneath it all.
          </p>
        </div>

        {/* columns */}
        <div className="mt-12 grid grid-cols-1 gap-10 text-center sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-base font-black text-white">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.name}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-sm text-slate-400 transition hover:text-white">
                        {l.name}
                      </a>
                    ) : (
                      <Link href={l.href} className="font-mono text-sm text-slate-400 transition hover:text-white">
                        {l.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* the quiet bottom line */}
        <div className="mt-14 border-t border-white/10 pt-8 text-center">
          <p className="flex items-center justify-center gap-2 font-mono text-sm text-slate-400">
            <img src="/logo.png" alt="" className="h-4 w-4 rounded-full object-cover" />
            &copy; {new Date().getFullYear()} Da Vinci. All rights reserved. Crafted by{" "}
            <span className="font-bold text-white">Dejavuh</span>
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-slate-600">
            All anime, manhwa and novel content belongs to their respective owners.
            Da Vinci is an educational tracker interface; data and imagery come from
            AniList and other third-party sources.
          </p>
        </div>
      </div>
    </footer>
  );
}
