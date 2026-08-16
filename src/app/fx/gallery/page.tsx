"use client";

import { useState } from "react";
import { ProfileEffect } from "@/components/profile/ProfileEffect";
import { AvatarDecoration, DECOR_EFFECTS } from "@/components/profile/AvatarDecoration";
import { effectCardBorderClass, effectNameClass } from "@/lib/effectTheme";

/**
 * EFFECT GALLERY — an internal QA surface, not a product page.
 *
 * There is no local build in this project, so "does this still look right?"
 * can only be answered on a deploy. Changing the profile card's geometry
 * changes it for every effect at once, and eyeballing them one at a time by
 * equipping each in turn is not a real check. This renders all of them in the
 * exact card shell the profile page uses, at the same width, so a layout
 * change can be reviewed in one screen.
 *
 * Keep the card markup here in sync with the real profile card (width, banner
 * height, avatar size) — that fidelity is the entire point.
 */

const EFFECTS: { id: string; name: string; tier?: string }[] = [
  { id: "effect_outergod", name: "Outer God: Abyssal Gaze", tier: "SSS" },
  { id: "effect_hollow", name: "Hollow Technique: Purple", tier: "SSS" },
  { id: "effect_dejavu", name: "Dejavu: Temporal Echo", tier: "SSS" },
  { id: "effect_himalaya", name: "The Silent Himalayas", tier: "SSS" },
  { id: "effect_ritual", name: "With This Treasure…", tier: "SSS" },
  { id: "effect_void", name: "Domain Expansion: Infinite Void", tier: "SSS" },
  { id: "effect_unblinking", name: "The Unblinking", tier: "SSS" },
  { id: "effect_gateway", name: "The Gate & The Key", tier: "Unique" },
  { id: "effect_webslinger", name: "The Web-Slinger", tier: "SSS" },
  { id: "effect_portal", name: "Dimension C-137", tier: "SSS" },
  { id: "effect_bankai", name: "Bankai: Senbonzakura Kageyoshi", tier: "SSS" },
  { id: "effect_jungle", name: "The Ancient Jungle", tier: "Rare" },
  { id: "effect_mango", name: "Mango Loco", tier: "Rare" },
  { id: "effect_lotus", name: "The Sacred Lotus Pond", tier: "Rare" },
  { id: "effect_samurai", name: "Ghost Samurai", tier: "Rare" },
  { id: "effect_canopy", name: "Heart of the Forest", tier: "Unique" },
  { id: "effect_mahoraga", name: "Wheel of Adaptation", tier: "Rare" },
  { id: "effect_tempest", name: "Monarch's Tempest", tier: "Rare" },
  { id: "effect_blackhole", name: "Black Hole", tier: "Rare" },
  { id: "effect_fool", name: "Fog of History", tier: "Rare" },
  { id: "effect_evernight", name: "Evernight's Blessing", tier: "Rare" },
  { id: "effect_crimson", name: "The Visceral Crimson Realm", tier: "Donor" },
  { id: "effect_froggie", name: "Froggie Frenzy", tier: "Unique" },
  { id: "effect_ascension", name: "Voltaic Ascension" },
  { id: "effect_aura", name: "Aura" },
  { id: "effect_snow", name: "Snow" },
  { id: "effect_embers", name: "Embers" },
];

export default function EffectGalleryPage() {
  // Solo mode is the honest way to judge one effect: 25 canvases animating at
  // once is not the load any real page produces.
  const [solo, setSolo] = useState<string | null>(null);
  const shown = solo ? EFFECTS.filter((e) => e.id === solo) : EFFECTS;

  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-10 text-white">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-8">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            Internal · QA harness
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Effect Gallery</h1>
          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-slate-400">
            Every effect in the real profile-card shell at its production width (420px),
            so a card-geometry change can be reviewed across all of them at once.
            Click a card to isolate it — 25 live canvases at once is not a fair
            performance read.
          </p>
          {solo && (
            <button
              onClick={() => setSolo(null)}
              className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:bg-white/10"
            >
              ← Back to all {EFFECTS.length}
            </button>
          )}
        </header>

        <div className="flex flex-wrap gap-6">
          {shown.map((fx) => (
            <div key={fx.id} className="w-[420px] shrink-0">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-sm font-black">{fx.name}</span>
                {fx.tier && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-300">
                    {fx.tier}
                  </span>
                )}
              </div>
              <div className="mb-2 font-mono text-[10px] text-slate-600">{fx.id}</div>

              {/* card shell — mirrors the profile page */}
              <button
                onClick={() => setSolo(solo ? null : fx.id)}
                className={`relative block w-full overflow-hidden rounded-3xl border bg-black/50 text-left shadow-2xl backdrop-blur-xl ${effectCardBorderClass(
                  fx.id
                )}`}
              >
                <ProfileEffect effect={fx.id} />

                <div className="relative z-[1] h-36 w-full overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-br from-purple-600/70 via-purple-600/50 to-fuchsia-600/40" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
                </div>

                <div className="relative z-10 px-7 pb-7">
                  <div className="relative -mt-16 mb-1.5 w-fit">
                    <div className="relative z-10 grid h-36 w-36 place-items-center rounded-full border-4 border-[#141414] bg-purple-600 text-4xl font-black">
                      D
                    </div>
                    {DECOR_EFFECTS.has(fx.id) && (
                      <AvatarDecoration frame={null} effect={fx.id} size="lg" />
                    )}
                  </div>

                  <div className="relative z-10 mt-3">
                    <h2 className={`pb-1 text-3xl font-black leading-tight ${effectNameClass(fx.id) || "text-white"}`}>
                      Dejavuh
                    </h2>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
                      <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500" />
                    </div>
                    <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      About me
                    </div>
                    <p className="text-sm font-medium text-purple-200">
                      Legibility check — this text must stay readable through the effect.
                    </p>
                    <div className="my-4 h-px bg-white/10" />
                    <div className="grid grid-cols-2 gap-2">
                      {["Hours", "Arise", "Followers", "Following"].map((s) => (
                        <div key={s} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{s}</div>
                          <div className="text-lg font-black leading-tight text-purple-200">220</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
