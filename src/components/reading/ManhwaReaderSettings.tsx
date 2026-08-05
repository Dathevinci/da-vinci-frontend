"use client";

import { X } from "lucide-react";
import {
  MANHWA_THEMES,
  themeById,
  type ManhwaReaderPrefs,
} from "@/lib/manhwa/readerPrefs";

export default function ManhwaReaderSettings({
  prefs,
  update,
  onClose,
}: {
  prefs: ManhwaReaderPrefs;
  update: (patch: Partial<ManhwaReaderPrefs>) => void;
  onClose: () => void;
}) {
  const t = themeById(prefs.theme);

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-3 text-sm font-black uppercase tracking-widest text-white/50">
      {children}
    </div>
  );

  const Toggle = ({ 
    label, 
    desc, 
    checked, 
    onChange 
  }: { 
    label: string, 
    desc?: string, 
    checked: boolean, 
    onChange: () => void 
  }) => (
    <button 
      onClick={onChange}
      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition text-left"
    >
      <div>
        <div className="font-bold text-white text-[15px]">{label}</div>
        {desc && <div className="text-xs text-white/50 mt-0.5">{desc}</div>}
      </div>
      <div className={`w-10 h-6 rounded-full p-1 transition-colors ${checked ? 'bg-white' : 'bg-white/10'}`}>
        <div className={`w-4 h-4 rounded-full transition-transform ${checked ? 'bg-black translate-x-4' : 'bg-white/50 translate-x-0'}`} />
      </div>
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        className="fixed inset-0 sm:inset-y-auto sm:top-[10vh] sm:bottom-[10vh] sm:left-1/2 sm:-translate-x-1/2 z-[70] w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ backgroundColor: "#09090b", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center">⚙️</span>
              Reader Settings
            </h2>
            <p className="text-sm text-white/50 mt-1">Customize your reading experience to your liking</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
          {/* Left Column */}
          <div className="flex-1 space-y-4">
            <Toggle 
              label="One Page View" 
              desc="Single page at a time" 
              checked={prefs.onePageView} 
              onChange={() => update({ onePageView: !prefs.onePageView })} 
            />
            <Toggle 
              label="Plain View" 
              desc="Images only, no animations or comments" 
              checked={prefs.plainView} 
              onChange={() => update({ plainView: !prefs.plainView })} 
            />
            <Toggle 
              label="Lock Rotation" 
              desc="Prevent screen rotation" 
              checked={prefs.lockRotation} 
              onChange={() => update({ lockRotation: !prefs.lockRotation })} 
            />
            <Toggle 
              label="Auto Next Chapter" 
              desc="Auto-proceed to next chapter when finished" 
              checked={prefs.autoNextChapter} 
              onChange={() => update({ autoNextChapter: !prefs.autoNextChapter })} 
            />

            <div className="p-4 rounded-xl bg-white/5 mt-4">
              <div className="font-bold text-white text-[15px] mb-3">Reading Direction</div>
              <div className="flex bg-black/50 p-1 rounded-lg">
                <button 
                  onClick={() => update({ readingDirection: 'ltr' })}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition ${prefs.readingDirection === 'ltr' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                >
                  Left to Right
                </button>
                <button 
                  onClick={() => update({ readingDirection: 'rtl' })}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition ${prefs.readingDirection === 'rtl' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                >
                  Right to Left
                </button>
              </div>
            </div>

            <SectionTitle>⚡ Performance</SectionTitle>
            <Toggle 
              label="Fast Rendering & Offline" 
              desc="Preload & cache all images" 
              checked={prefs.fastRendering} 
              onChange={() => update({ fastRendering: !prefs.fastRendering })} 
            />
            <Toggle 
              label="Canvas Rendering" 
              desc="Draw pages to a canvas (anti-copy). Off uses normal images." 
              checked={prefs.canvasRendering} 
              onChange={() => update({ canvasRendering: !prefs.canvasRendering })} 
            />
            <Toggle 
              label="Allow Zoom In-out" 
              desc="Pinch / double-tap to zoom pages" 
              checked={prefs.allowZoomInOut} 
              onChange={() => update({ allowZoomInOut: !prefs.allowZoomInOut })} 
            />
          </div>

          {/* Right Column */}
          <div className="flex-1 space-y-6">
            <div className="p-5 rounded-xl bg-white/5 space-y-5">
              <div>
                <div className="text-xs font-black text-white/50 uppercase tracking-wider mb-2">Theme</div>
                <div className="grid grid-cols-2 gap-2">
                  {MANHWA_THEMES.map((th) => (
                    <button
                      key={th.id}
                      onClick={() => update({ theme: th.id })}
                      className={`py-2 text-sm font-bold rounded-lg transition border ${prefs.theme === th.id ? 'bg-white text-black border-white' : 'bg-[#09090b] text-white border-white/10 hover:border-white/30'}`}
                    >
                      {th.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-black text-white/50 uppercase tracking-wider mb-2">Page Gap</div>
                <div className="flex bg-black/50 p-1 rounded-lg">
                  {[0, 4, 8].map((gap) => (
                    <button
                      key={gap}
                      onClick={() => update({ pageGap: gap as 0 | 4 | 8 })}
                      className={`flex-1 py-1.5 text-sm font-bold rounded-md transition ${prefs.pageGap === gap ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                    >
                      {gap}px
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-black text-white/50 uppercase tracking-wider mb-2">
                  <span>Brightness</span>
                  <span>{prefs.brightness}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg">🌙</span>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={prefs.brightness}
                    onChange={(e) => update({ brightness: Number(e.target.value) })}
                    className="flex-1 h-1 bg-white/20 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                  />
                  <span className="text-lg">☀️</span>
                </div>
                <p className="text-xs text-white/40 mt-3 leading-relaxed">
                  Below 100% dims past your screen's minimum. Above 100% lifts dull, grey scans.
                </p>
              </div>
            </div>

            <SectionTitle>💬 Comments</SectionTitle>
            <Toggle 
              label="Side Chat" 
              desc="Pin comments to the side while reading" 
              checked={prefs.sideChat} 
              onChange={() => update({ sideChat: !prefs.sideChat })} 
            />

            <SectionTitle>↕️ Auto Scroll</SectionTitle>
            <Toggle 
              label="Enable Auto Scroll" 
              checked={prefs.autoScroll} 
              onChange={() => update({ autoScroll: !prefs.autoScroll })} 
            />
          </div>
        </div>
      </div>
    </>
  );
}
