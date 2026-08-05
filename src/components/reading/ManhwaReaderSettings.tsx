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
  onClose,
}: {
  prefs: ManhwaReaderPrefs;
  update: (patch: Partial<ManhwaReaderPrefs>) => void;
  onClose: () => void;
}) {
  const SectionHeader = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mt-6 mb-3 text-xs font-mono font-bold uppercase tracking-wider text-white/70">
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
      className="w-full flex items-center justify-between p-4 rounded-xl bg-[#14171d] hover:bg-[#1a1e26] border border-white/5 transition text-left"
    >
      <div className="pr-4">
        <div className="font-mono font-bold text-white text-[15px]">{label}</div>
        {desc && <div className="font-mono text-xs text-white/40 mt-1 leading-relaxed">{desc}</div>}
      </div>
      <div className={`w-11 h-6 shrink-0 rounded-full p-1 transition-colors ${checked ? 'bg-white' : 'bg-white/10'}`}>
        <div className={`w-4 h-4 rounded-full transition-transform ${checked ? 'bg-black translate-x-5' : 'bg-white/50 translate-x-0'}`} />
      </div>
    </button>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-md" onClick={onClose} aria-hidden />

      {/* Modal matching Screenshots 4 & 5 */}
      <div
        role="dialog"
        className="fixed inset-0 sm:inset-auto sm:top-[5vh] sm:bottom-[5vh] sm:left-1/2 sm:-translate-x-1/2 z-[90] w-full sm:max-w-4xl sm:rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] flex flex-col bg-[#0b0d10] text-white border border-white/10 overflow-hidden font-mono"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-xl font-mono font-black flex items-center gap-2.5 text-white">
              <Settings className="w-5 h-5 text-white" />
              <span>Reader Settings</span>
            </h2>
            <p className="text-xs font-mono text-white/40 mt-1">Customize your reading experience to your liking</p>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Content Area */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-3.5">
            <ToggleCard 
              label="One Page View" 
              desc="Single page at a time" 
              checked={prefs.onePageView} 
              onChange={() => update({ onePageView: !prefs.onePageView })} 
            />
            <ToggleCard 
              label="Plain View" 
              desc="Images only, no animations or comments" 
              checked={prefs.plainView} 
              onChange={() => update({ plainView: !prefs.plainView })} 
            />
            <ToggleCard 
              label="Lock Rotation" 
              desc="Prevent screen rotation" 
              checked={prefs.lockRotation} 
              onChange={() => update({ lockRotation: !prefs.lockRotation })} 
            />
            <ToggleCard 
              label="Auto Next Chapter" 
              desc="Auto-proceed to next chapter when finished" 
              checked={prefs.autoNextChapter} 
              onChange={() => update({ autoNextChapter: !prefs.autoNextChapter })} 
            />

            {/* Reading Direction segmented card */}
            <div className="p-4 rounded-xl bg-[#14171d] border border-white/5">
              <div className="font-mono font-bold text-white text-[15px] mb-3">Reading Direction</div>
              <div className="flex bg-[#090b0e] p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => update({ readingDirection: 'ltr' })}
                  className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-lg transition ${prefs.readingDirection === 'ltr' ? 'bg-white text-black shadow-md' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                >
                  Left to Right
                </button>
                <button 
                  onClick={() => update({ readingDirection: 'rtl' })}
                  className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-lg transition ${prefs.readingDirection === 'rtl' ? 'bg-white text-black shadow-md' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                >
                  Right to Left
                </button>
              </div>
            </div>

            {/* Performance Section */}
            <SectionHeader icon={<Zap className="w-4 h-4 text-white/70" />}>
              Performance
            </SectionHeader>

            <ToggleCard 
              label="Fast Rendering & Offline" 
              desc="Preload & cache all images" 
              checked={prefs.fastRendering} 
              onChange={() => update({ fastRendering: !prefs.fastRendering })} 
            />
            <ToggleCard 
              label="Canvas Rendering" 
              desc="Draw pages to a canvas (anti-copy). Off uses normal images." 
              checked={prefs.canvasRendering} 
              onChange={() => update({ canvasRendering: !prefs.canvasRendering })} 
            />
            <ToggleCard 
              label="Allow Zoom In-out" 
              desc="Pinch / double-tap to zoom pages" 
              checked={prefs.allowZoomInOut} 
              onChange={() => update({ allowZoomInOut: !prefs.allowZoomInOut })} 
            />

            {/* Interface Actions Section */}
            <SectionHeader icon={<Sparkles className="w-4 h-4 text-white/70" />}>
              Interface Actions
            </SectionHeader>

            <ToggleCard 
              label="Tap to Scroll" 
              desc="Tap center to scroll/next" 
              checked={prefs.tapToScroll} 
              onChange={() => update({ tapToScroll: !prefs.tapToScroll })} 
            />
            <ToggleCard 
              label="Tap Zones" 
              desc="Show click areas" 
              checked={prefs.tapZones} 
              onChange={() => update({ tapZones: !prefs.tapZones })} 
            />
            <ToggleCard 
              label="Center Navigation" 
              checked={prefs.centerNavigation} 
              onChange={() => update({ centerNavigation: !prefs.centerNavigation })} 
            />
            <ToggleCard 
              label="Keyboard Shortcuts" 
              checked={prefs.keyboardShortcuts} 
              onChange={() => update({ keyboardShortcuts: !prefs.keyboardShortcuts })} 
            />
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Theme, Gap & Brightness combined card */}
            <div className="p-5 rounded-2xl bg-[#14171d] border border-white/5 space-y-6">
              {/* Theme selector */}
              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-white/40 mb-2.5">
                  THEME
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MANHWA_THEMES.map((th) => (
                    <button
                      key={th.id}
                      onClick={() => update({ theme: th.id })}
                      className={`py-3 text-xs font-mono font-bold rounded-xl transition ${prefs.theme === th.id ? 'bg-white text-black shadow-md' : 'bg-[#090b0e] text-white/80 border border-white/5 hover:border-white/20'}`}
                    >
                      {th.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page Gap selector */}
              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-white/40 mb-2.5">
                  PAGE GAP
                </div>
                <div className="flex bg-[#090b0e] p-1 rounded-xl border border-white/5">
                  {[0, 4, 8].map((gap) => (
                    <button
                      key={gap}
                      onClick={() => update({ pageGap: gap as 0 | 4 | 8 })}
                      className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-lg transition ${prefs.pageGap === gap ? 'bg-white text-black shadow-md' : 'text-white/70 hover:text-white'}`}
                    >
                      {gap}px
                    </button>
                  ))}
                </div>
              </div>

              {/* Brightness slider */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-white/40 mb-2.5">
                  <span>BRIGHTNESS</span>
                  <span className="text-white/80">{prefs.brightness}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">🌙</span>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={prefs.brightness}
                    onChange={(e) => update({ brightness: Number(e.target.value) })}
                    className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                  />
                  <span className="text-sm">☀️</span>
                </div>
                <p className="text-[11px] font-mono text-white/40 mt-3 leading-relaxed">
                  Below 100% dims past your screen's minimum. Above 100% lifts dull, grey scans.
                </p>
              </div>
            </div>

            {/* Comments Section */}
            <SectionHeader icon={<MessageSquare className="w-4 h-4 text-white/70" />}>
              Comments
            </SectionHeader>
            <ToggleCard 
              label="Side Chat" 
              desc="Pin comments to the side while reading" 
              checked={prefs.sideChat} 
              onChange={() => update({ sideChat: !prefs.sideChat })} 
            />

            {/* Auto Scroll Section */}
            <SectionHeader icon={<ArrowUpDown className="w-4 h-4 text-white/70" />}>
              Auto Scroll
            </SectionHeader>
            <ToggleCard 
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
