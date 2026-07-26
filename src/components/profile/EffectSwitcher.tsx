"use client";

import Link from "next/link";
import { Palette, X } from "lucide-react";
import { EFFECT_ORDER, getEffectMeta } from "@/lib/effectMeta";
import type { EffectSlot } from "./useEffectSlot";

/**
 * Equip an owned profile effect without walking to the shop.
 *
 * Every swatch here is a STATIC gradient div. No <ProfileEffect>, no canvas —
 * see the comment block in Navbar.tsx for the five reasons live effects can't
 * render in a persistent header (the short version: two of them play audio).
 *
 * `variant="menu"` is the desktop dropdown, `variant="sheet"` is the mobile
 * hamburger drawer (single column, 44px+ tap targets).
 */
export function EffectSwitcher({
  slot,
  user,
  variant = "menu",
  onNavigate,
}: {
  slot: EffectSlot;
  user: any;
  variant?: "menu" | "sheet";
  onNavigate?: () => void;
}) {
  // Never build this list by intersecting with SHOP_ITEMS — effect_crimson is
  // absent from the shop catalog and would silently vanish for its owner.
  const owned: string[] = (user?.purchasedEffects ?? []).filter(
    (id: string) => !!id && id !== "effect_crimson"
  );
  // Known ids in rarity order, then anything unrecognised — appended, never
  // dropped. effect_crimson is deliberately absent from EFFECT_ORDER, so it is
  // prepended AFTER the sort; sorting first would bury the exclusive at the very
  // bottom, below the commons, for the one account that owns it.
  const ranked = EFFECT_ORDER.filter((id) => owned.includes(id)).concat(
    owned.filter((id) => !EFFECT_ORDER.includes(id))
  );
  const rows = slot.chosen ? ["effect_crimson", ...ranked] : ranked;

  const sheet = variant === "sheet";

  const header = (
    <div className="flex items-center justify-between px-3 pt-2 pb-1.5">
      <span className="flex items-center gap-1.5">
        <Palette className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Profile Effect</span>
      </span>
      <Link
        href="/shop"
        data-menu-item
        onClick={onNavigate}
        className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
      >
        Get more
      </Link>
    </div>
  );

  // Owns nothing → a CTA, never a hidden section. Hiding it means a user who
  // owns no effects never discovers the feature exists.
  //
  // The one exception: an account can hold an effect it never "purchased"
  // (admin-granted or legacy). Falling through to the CTA there would both
  // contradict the plate directly above — which names the equipped effect — and
  // leave no way to take it off. So keep the switcher whenever something is on.
  if (rows.length === 0 && slot.shown === null) {
    return (
      <>
        {header}
        <div className="mx-1.5 mb-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center">
          <p className="text-[11px] text-slate-400">You don't own any profile effects yet.</p>
          <Link
            href="/shop"
            data-menu-item
            onClick={onNavigate}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-[11px] font-black text-white transition-colors"
          >
            <Palette className="w-3 h-3" /> Browse effects
          </Link>
        </div>
      </>
    );
  }

  // One owned effect is two rows total — don't open a 200px scroll area for it.
  const dense = rows.length >= 2 && !sheet;
  const gridClass = sheet
    ? "px-1.5 pb-2 grid grid-cols-1 gap-1.5 max-h-[38vh] overflow-y-auto overscroll-contain custom-scrollbar"
    : dense
    ? "px-1.5 pb-2 grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto overscroll-contain custom-scrollbar"
    : "px-1.5 pb-2 grid grid-cols-1 gap-1.5";

  const rowPad = sheet ? "px-2 py-3" : "px-2 py-2";

  return (
    <>
      {header}
      {/* overscroll-contain is load-bearing: without it, scrolling this grid
          chains to window and trips the panel's scroll-to-close handler. */}
      <div className={gridClass} role="group" aria-label="Equipped profile effect">
        {/* None / Silence the Realm */}
        <button
          type="button"
          data-menu-item
          role="menuitemradio"
          aria-checked={slot.shown === null}
          disabled={slot.busy}
          onClick={() => slot.equip(null)}
          className={`group relative flex items-center gap-2 rounded-lg ${rowPad} text-left transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
            slot.shown === null ? "bg-white/10 ring-1 ring-fuchsia-400/60" : "hover:bg-white/5"
          }`}
        >
          <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full border border-dashed border-white/20 bg-white/5">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-bold text-slate-200">
              {slot.chosen ? "Silence the Realm" : "None"}
            </span>
          </span>
          {slot.shown === null && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-300" />}
        </button>

        {rows.map((id) => {
          const meta = getEffectMeta(id)!; // never null — id is a non-empty string
          const isOn = slot.shown === id;
          return (
            <button
              key={id}
              type="button"
              data-menu-item
              role="menuitemradio"
              aria-checked={isOn}
              disabled={slot.busy}
              onClick={() => slot.equip(id)}
              title={meta.name}
              className={`group relative flex items-center gap-2 rounded-lg ${rowPad} text-left transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
                isOn ? "bg-white/10 ring-1 ring-fuchsia-400/60" : "hover:bg-white/5"
              }`}
            >
              <span
                className={`h-7 w-7 shrink-0 rounded-full ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] bg-gradient-to-br ${meta.gradient}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-slate-200">{meta.name}</span>
                {/* Ownership is permanent — a closed limited window blocks buying
                    and gifting, never equipping. Framed as prestige, not expiry. */}
                {meta.limited && (
                  <span className="block text-[8px] font-black uppercase tracking-widest text-amber-300/80">Limited</span>
                )}
              </span>
              {isOn && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-300" />}
            </button>
          );
        })}
      </div>
    </>
  );
}
