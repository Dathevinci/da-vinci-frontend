"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import type { IMangaResult } from "@/lib/asura/models";
import { canDeriveChapterId } from "@/lib/manhwa/ids";

/**
 * LATEST UPDATES — the reference layout's defining section: a grid of series,
 * each listing its most recent chapters with how long ago they landed, rather
 * than one cover per title with the chapter buried on a hover.
 *
 * Built only from data the sources actually return. `latest_chapters` carries
 * a chapter number and a publish timestamp, so the rows and their times are
 * real. Deliberately NOT built:
 *   - per-chapter language flags: no source exposes a translation language on
 *     an AsuraScans row, so a flag here would be decoration pretending to be
 *     data.
 *   - a total page count: the sources paginate opaquely, so "1 2 … 282" would
 *     be an invented number.
 * A title with no chapter data still renders — it just shows the cover and
 * links to its page, instead of being dropped or padded with fake rows.
 */

/** "9 mins ago" — the reference's granularity, which is finer than the app's. */
function since(iso?: string) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} week${w === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

export default function LatestUpdatesGrid({
  items,
  title = "Latest Updates",
  subtitle = "Freshly uploaded chapters",
  accent = "#dc2626",
}: {
  items: IMangaResult[];
  title?: string;
  subtitle?: string;
  accent?: string;
}) {
  const rows = (items || []).filter((m) => m && m.id).slice(0, 18);
  if (rows.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 md:px-8">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 md:p-6">
        {/* section header — icon tile + title + subtitle, matching the
            Lunar-style headers used elsewhere on these pages */}
        <div className="mb-5 flex items-center gap-3.5">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border"
            style={{ borderColor: `${accent}33`, background: `${accent}14`, color: accent }}
          >
            <Calendar className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black tracking-tight text-white md:text-2xl">{title}</h2>
            <p className="truncate font-mono text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((m) => {
            const cover = m.image ? `/api/manhwa-image?url=${encodeURIComponent(m.image)}` : null;
            const seriesHref = `/manhwa/${encodeURIComponent(m.id)}`;
            // Only AsuraScans chapter ids can be derived from the series id
            // (`<slug>|<number>`); every other source uses an opaque token or
            // slug. The rest fall back to the series page. In practice only
            // Asura rows even reach the chapter list below — `latest_chapters`
            // is its feed — but the guard is on the id SHAPE so a source that
            // starts publishing one cannot quietly get a broken link.
            const canLinkChapters = canDeriveChapterId(m.id);
            const chapters = (m.latest_chapters || []).slice(0, 3);

            return (
              <div
                key={m.id}
                className="flex gap-3.5 rounded-xl border border-white/[0.06] bg-[#0e0e11] p-3 transition hover:border-white/[0.14]"
              >
                <Link href={seriesHref} className="shrink-0">
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      className="hq-image h-[104px] w-[74px] rounded-lg border border-white/10 object-cover"
                    />
                  ) : (
                    <span className="block h-[104px] w-[74px] rounded-lg border border-white/10 bg-white/5" />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={seriesHref}
                    className="mb-2 line-clamp-2 text-sm font-black leading-snug text-white transition hover:text-slate-300"
                  >
                    {m.title}
                  </Link>

                  {chapters.length > 0 ? (
                    <ul className="space-y-1.5">
                      {chapters.map((ch, i) => {
                        const label = `Chapter ${ch.number}`;
                        const href = canLinkChapters
                          ? `/manhwa/${encodeURIComponent(m.id)}/chapter/${encodeURIComponent(`${m.id}|${ch.number}`)}`
                          : seriesHref;
                        return (
                          <li key={`${m.id}-${ch.number}-${i}`}>
                            <Link
                              href={href}
                              className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 transition hover:bg-white/[0.05]"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{ background: i === 0 ? accent : "rgba(255,255,255,.22)" }}
                                />
                                <span className="truncate font-mono text-xs text-slate-300">{label}</span>
                              </span>
                              <span className="shrink-0 font-mono text-[11px] text-slate-600">
                                {since(ch.published_at)}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-auto font-mono text-[11px] text-slate-600">
                      {m.latestChapter || "Open to see chapters"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
