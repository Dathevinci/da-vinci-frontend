"use client";

import { X, Minus, Plus, AlignLeft, AlignJustify, RotateCcw } from "lucide-react";
import {
  READER_THEMES, READER_FONTS, READER_SPACING, READER_WIDTHS,
  SIZE_MIN, SIZE_MAX, themeById,
  type ReaderPrefs,
} from "@/lib/novel/readerPrefs";

export default function ReaderSettings({
  prefs,
  update,
  reset,
  onClose,
}: {
  prefs: ReaderPrefs;
  update: (patch: Partial<ReaderPrefs>) => void;
  reset: () => void;
  onClose: () => void;
}) {
  const t = themeById(prefs.theme);

  // Chip styling adapts to the active theme (so the panel previews it live).
  const chipBase = "rounded-lg text-sm font-bold border transition disabled:opacity-40";
  const inactive = { borderColor: t.border, color: t.muted, backgroundColor: "transparent" };
  const activeCls = "bg-pink-500 border-pink-500 text-white";

  const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] font-black uppercase tracking-[0.14em] mb-2" style={{ color: t.muted }}>
      {children}
    </p>
  );

  return (
    <>
      {/* invisible click-catcher — no dark overlay, so the text stays visible
          and you can watch it change as you tune the settings */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-label="Reading settings"
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto w-full sm:max-w-lg rounded-t-2xl border shadow-[0_-20px_50px_rgba(0,0,0,0.5)] p-5 pb-7 space-y-5 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: t.panel, borderColor: t.border, color: t.text }}
      >
        {/* grabber + header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black">Reading settings</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={reset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:opacity-80"
              style={{ color: t.muted }}
              title="Reset to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:opacity-80" style={{ color: t.muted }} aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Theme */}
        <div>
          <Label>Theme</Label>
          <div className="flex flex-wrap gap-2.5">
            {READER_THEMES.map((th) => {
              const on = prefs.theme === th.id;
              return (
                <button
                  key={th.id}
                  onClick={() => update({ theme: th.id })}
                  title={th.name}
                  className={`relative h-12 w-12 rounded-xl border-2 flex items-center justify-center font-serif text-base font-bold transition ${on ? "border-pink-500 scale-105" : ""}`}
                  style={{ background: th.bg, color: th.text, borderColor: on ? undefined : th.border }}
                >
                  Aa
                </button>
              );
            })}
          </div>
        </div>

        {/* Font */}
        <div>
          <Label>Font</Label>
          <div className="grid grid-cols-3 gap-2">
            {READER_FONTS.map((f) => {
              const on = prefs.font === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => update({ font: f.id })}
                  className={`${chipBase} py-2.5 ${on ? activeCls : "hover:opacity-80"}`}
                  style={on ? { fontFamily: f.css } : { ...inactive, fontFamily: f.css }}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Size */}
        <div>
          <Label>Text size</Label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => update({ size: Math.max(SIZE_MIN, prefs.size - 1) })}
              disabled={prefs.size <= SIZE_MIN}
              className={`${chipBase} h-10 w-10 flex items-center justify-center hover:opacity-80`}
              style={inactive}
              aria-label="Smaller"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 flex items-center gap-3">
              <span className="text-sm font-black tabular-nums w-7 text-center">{prefs.size}</span>
              <input
                type="range"
                min={SIZE_MIN}
                max={SIZE_MAX}
                value={prefs.size}
                onChange={(e) => update({ size: Number(e.target.value) })}
                className="flex-1 accent-pink-500"
                aria-label="Text size"
              />
            </div>
            <button
              onClick={() => update({ size: Math.min(SIZE_MAX, prefs.size + 1) })}
              disabled={prefs.size >= SIZE_MAX}
              className={`${chipBase} h-10 w-10 flex items-center justify-center hover:opacity-80`}
              style={inactive}
              aria-label="Larger"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Spacing + Width */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Spacing</Label>
            <div className="flex flex-col gap-2">
              {READER_SPACING.map((s) => {
                const on = prefs.spacing === s.id;
                return (
                  <button key={s.id} onClick={() => update({ spacing: s.id })}
                    className={`${chipBase} py-2 ${on ? activeCls : "hover:opacity-80"}`}
                    style={on ? undefined : inactive}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Width</Label>
            <div className="flex flex-col gap-2">
              {READER_WIDTHS.map((w) => {
                const on = prefs.width === w.id;
                return (
                  <button key={w.id} onClick={() => update({ width: w.id })}
                    className={`${chipBase} py-2 ${on ? activeCls : "hover:opacity-80"}`}
                    style={on ? undefined : inactive}>
                    {w.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Alignment */}
        <div>
          <Label>Alignment</Label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => update({ justify: false })}
              className={`${chipBase} py-2.5 flex items-center justify-center gap-2 ${!prefs.justify ? activeCls : "hover:opacity-80"}`}
              style={!prefs.justify ? undefined : inactive}>
              <AlignLeft className="w-4 h-4" /> Left
            </button>
            <button onClick={() => update({ justify: true })}
              className={`${chipBase} py-2.5 flex items-center justify-center gap-2 ${prefs.justify ? activeCls : "hover:opacity-80"}`}
              style={prefs.justify ? undefined : inactive}>
              <AlignJustify className="w-4 h-4" /> Justify
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
