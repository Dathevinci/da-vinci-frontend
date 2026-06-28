"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

export default function AnnouncementBanner() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-30 container mx-auto px-4 md:px-12 mt-8 mb-8">
      <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 backdrop-blur-xl border border-purple-500/50 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.25)] relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 via-purple-500 to-fuchsia-500 animate-pulse" />
        
        {/* Banner Header (Always visible) */}
        <div 
          className="p-6 flex flex-col md:flex-row items-center gap-6 justify-between cursor-pointer group"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex-1">
            <h2 className="text-xl md:text-2xl font-black text-white mb-2 flex items-center gap-3">
              <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded tracking-widest uppercase shadow-lg shadow-purple-500/50">Announcement</span>
              Message from Lead Dev <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]">dejavuh</span>
            </h2>
            <p className="text-indigo-100 font-medium text-sm md:text-base pr-8">
              Welcome to Da Vinci! I've just introduced the <strong>Arise Points</strong> system. Click here to learn more!
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/user/dejavuh" onClick={(e) => e.stopPropagation()}>
              <button className="whitespace-nowrap bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-3 rounded-full font-bold shadow-xl shadow-purple-600/30 transition hover:scale-105 active:scale-95">
                Visit Profile
              </button>
            </Link>
            <ChevronDown className={`w-8 h-8 text-purple-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Expandable Content */}
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-purple-500/30 bg-black/20"
            >
              <div className="p-6 space-y-6 text-indigo-100">
                
                {/* Section 1 */}
                <div>
                  <h3 className="text-lg font-bold text-purple-300 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" /> Who is dejavuh?
                  </h3>
                  <p className="pl-4 text-sm leading-relaxed">
                    I am the Lead Developer of the Da Vinci platform. My goal is to build the ultimate cinematic tracker experience for anime enthusiasts. Visit my profile to see my exclusive Hollow Purple animation!
                  </p>
                </div>

                {/* Section 2 */}
                <div>
                  <h3 className="text-lg font-bold text-purple-300 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" /> What are Arise Points?
                  </h3>
                  <p className="pl-4 text-sm leading-relaxed">
                    Arise Points (✧) are the official progression currency of the Da Vinci platform. They show off your dedication and activity within the community.
                  </p>
                </div>

                {/* Section 3 */}
                <div>
                  <h3 className="text-lg font-bold text-purple-300 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" /> How can we get Arise Points?
                  </h3>
                  <ul className="pl-4 text-sm leading-relaxed space-y-2 list-disc list-inside">
                    <li><strong className="text-white">Follow the Lead Developer:</strong> Earn <span className="text-purple-400 font-bold">10 ✧</span> immediately upon following <Link href="/user/dejavuh" className="text-purple-400 hover:underline">dejavuh</Link>.</li>
                    <li><strong className="text-white">Update your Profile Picture:</strong> Personalize your avatar to earn <span className="text-purple-400 font-bold">2 ✧</span> (one-time reward).</li>
                    <li><strong className="text-white">Update your Banner:</strong> Decorate your profile banner to earn <span className="text-purple-400 font-bold">2 ✧</span> (one-time reward).</li>
                    <li><strong className="text-white">Add Anime to Watchlist:</strong> Start tracking your anime! Earn <span className="text-purple-400 font-bold">2 ✧</span> every time you add an anime to your list.</li>
                  </ul>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
