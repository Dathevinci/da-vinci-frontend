"use client";

import { X, Zap, Sparkles, MessageSquare, ArrowUpDown, Settings } from "lucide-react";
import {
  MANHWA_THEMES,
  themeById,
  type ManhwaReaderPrefs,
} from "@/lib/manhwa/readerPrefs";

export default function ManhwaReaderSettings({
  prefs,
  update,
  isOpen,
  onClose,
}: {
  prefs: ManhwaReaderPrefs;
  update: (patch: Partial<ManhwaReaderPrefs>) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const SectionHeader = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="flex items-center gap-2.5 mt-8 mb-4 text-[13px] font-mono font-bold tracking-wide text-white">
      {icon}
      <span>{children}</span>
    </div>
  );

  const ToggleCard = ({ 
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
      className="w-full flex items-center justify-between p-4 rounded-xl bg-[#131313] hover:bg-[#1a1a1a] border border-transparent transition text-left"
    >
      <div className="pr-4">
        <div className="font-mono font-bold text-white text-[14px]">{label}</div>
        {desc && <div className="font-mono text-[12px] text-white/50 mt-1 leading-relaxed">{desc}</div>}
      </div>
      <div className={`w-11 h-6 shrink-0 rounded-full p-0.5 transition-colors ${checked ? 'bg-white' : 'bg-[#2a2a2a]'}`}>
        <div className={`w-5 h-5 rounded-full transition-transform ${checked ? 'bg-black translate-x-5' : 'bg-[#181818] translate-x-0'}`} />
      </div>
    </button>
  );

  return (
    <>
      <div className={`fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose} aria-hidden />

      <div
        role="dialog"
        className={`fixed inset-0 sm:inset-auto sm:top-[5vh] sm:bottom-[5vh] sm:left-1/2 sm:-translate-x-1/2 z-[90] w-full sm:w-[900px] sm:rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] flex flex-col bg-[#09090b] text-white border border-[#222] overflow-hidden font-mono transform transition-all duration-300 ease-out ${isOpen ? 'scale-100 opacity-100 pointer-events-auto translate-y-0' : 'scale-95 opacity-0 pointer-events-none translate-y-4'}`}
      >
        <div className="flex items-center justify-between p-6 border-b border-[#222] shrink-0 bg-[#09090b]">
          <div>
            <h2 className="text-[20px] font-mono font-bold flex items-center gap-2.5 text-white tracking-wide">
              <Settings className="w-6 h-6 text-white" strokeWidth={2} />
              <span>Reader Settings</span>
            </h2>
            <p className="text-[13px] font-mono text-white/50 mt-2">Customize your reading experience to your liking</p>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-full transition self-start">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#09090b]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
            {/* Left Column */}
            <div className="space-y-3">
              <ToggleCard label="One Page View" desc="Single page at a time" checked={prefs.onePageView} onChange={() => update({ onePageView: !prefs.onePageView })} />
              <ToggleCard label="Plain View" desc="Images only, no animations or comments" checked={prefs.plainView} onChange={() => update({ plainView: !prefs.plainView })} />
              <ToggleCard label="Lock Rotation" desc="Prevent screen rotation" checked={prefs.lockRotation} onChange={() => update({ lockRotation: !prefs.lockRotation })} />
              <ToggleCard label="Auto Next Chapter" desc="Auto-proceed to next chapter when finished" checked={prefs.autoNextChapter} onChange={() => update({ autoNextChapter: !prefs.autoNextChapter })} />

              <div className="p-4 rounded-xl bg-[#131313]">
                <div className="font-mono font-bold text-white text-[14px] mb-4">Reading Direction</div>
                <div className="flex bg-[#000] p-1 rounded-xl">
                  <button onClick={() => update({ readingDirection: prefs.readingDirection === 'ltr' ? 'vertical' : 'ltr' })} className={`flex-1 py-2.5 text-[13px] font-mono font-bold rounded-lg transition ${prefs.readingDirection === 'ltr' ? 'bg-white text-black' : 'text-white hover:bg-[#1a1a1a]'}`}>Left to Right</button>
                  <button onClick={() => update({ readingDirection: prefs.readingDirection === 'rtl' ? 'vertical' : 'rtl' })} className={`flex-1 py-2.5 text-[13px] font-mono font-bold rounded-lg transition ${prefs.readingDirection === 'rtl' ? 'bg-white text-black' : 'text-white hover:bg-[#1a1a1a]'}`}>Right to Left</button>
                </div>
              </div>

              <SectionHeader icon={<Zap className="w-4 h-4 text-white" />}>Performance</SectionHeader>
              <ToggleCard label="Fast Rendering & Offline" desc="Preload & cache all images" checked={prefs.fastRendering} onChange={() => update({ fastRendering: !prefs.fastRendering })} />
              <ToggleCard label="Canvas Rendering" desc="Draw pages to a canvas (anti-copy). Off uses normal images." checked={prefs.canvasRendering} onChange={() => update({ canvasRendering: !prefs.canvasRendering })} />
              <ToggleCard label="Allow Zoom In-out" desc="Pinch / double-tap to zoom pages" checked={prefs.allowZoomInOut} onChange={() => update({ allowZoomInOut: !prefs.allowZoomInOut })} />
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div className="p-5 rounded-2xl bg-[#131313] space-y-7">
                <div>
                  <div className="text-[12px] font-mono font-bold uppercase tracking-wider text-white/50 mb-3">THEME</div>
                  <div className="grid grid-cols-2 gap-2">
                    {MANHWA_THEMES.map((th) => (
                      <button key={th.id} onClick={() => update({ theme: th.id })} className={`py-3 text-[13px] font-mono font-bold rounded-xl transition ${prefs.theme === th.id ? 'bg-white text-black' : 'bg-[#000] text-white hover:bg-[#1a1a1a]'}`}>{th.name}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[12px] font-mono font-bold uppercase tracking-wider text-white/50 mb-3">PAGE GAP</div>
                  <div className="flex bg-[#000] p-1 rounded-xl">
                    {[0, 4, 8].map((gap) => (
                      <button key={gap} onClick={() => update({ pageGap: gap as 0 | 4 | 8 })} className={`flex-1 py-2.5 text-[13px] font-mono font-bold rounded-lg transition ${prefs.pageGap === gap ? 'bg-white text-black' : 'text-white hover:bg-[#1a1a1a]'}`}>{gap}px</button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[12px] font-mono font-bold uppercase tracking-wider text-white/50 mb-3">
                    <span>BRIGHTNESS</span>
                    <span className="text-white">{prefs.brightness}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">🌙</span>
                    <input type="range" min="10" max="100" value={prefs.brightness} onChange={(e) => update({ brightness: Number(e.target.value) })} className="flex-1 h-1.5 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" />
                    <span className="text-sm text-white/80">☀️</span>
                  </div>
                  <p className="text-[12px] font-mono text-white/40 mt-4 leading-relaxed">Below 100% dims past your screen's minimum. Above 100% lifts dull, grey scans.</p>
                </div>
              </div>

              <SectionHeader icon={<MessageSquare className="w-4 h-4 text-white" />}>Comments</SectionHeader>
              <ToggleCard label="Side Chat" desc="Pin comments to the side while reading" checked={prefs.sideChat} onChange={() => update({ sideChat: !prefs.sideChat })} />

              <SectionHeader icon={<ArrowUpDown className="w-4 h-4 text-white" />}>Auto Scroll</SectionHeader>
              <ToggleCard label="Enable Auto Scroll" checked={prefs.autoScroll} onChange={() => update({ autoScroll: !prefs.autoScroll })} />
            </div>
          </div>

          {/* Full Width Bottom Section */}
          <div className="mt-8 pt-8 border-t border-[#222]">
            <SectionHeader icon={<Sparkles className="w-4 h-4 text-white" />}>Interface Actions</SectionHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              <ToggleCard label="Tap to Scroll" desc="Tap center to scroll/next" checked={prefs.tapToScroll} onChange={() => update({ tapToScroll: !prefs.tapToScroll })} />
              <ToggleCard label="Tap Zones" desc="Show click areas" checked={prefs.tapZones} onChange={() => update({ tapZones: !prefs.tapZones })} />
              <ToggleCard label="Center Navigation" checked={prefs.centerNavigation} onChange={() => update({ centerNavigation: !prefs.centerNavigation })} />
              <ToggleCard label="Keyboard Shortcuts" checked={prefs.keyboardShortcuts} onChange={() => update({ keyboardShortcuts: !prefs.keyboardShortcuts })} />
              <ToggleCard label="Dark Controls" checked={false} onChange={() => {}} />
              <ToggleCard label="Show Page Numbers" checked={false} onChange={() => {}} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
