"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Megaphone, Zap, Sparkles, UserCheck } from "lucide-react";
import Link from "next/link";

const announcements = [
  {
    id: 1,
    tag: "Major Update",
    icon: <Zap className="w-4 h-4 text-yellow-400" />,
    theme: "from-blue-900/80 to-indigo-900/80",
    border: "border-blue-500/50",
    shadow: "shadow-[0_0_30px_rgba(59,130,246,0.25)]",
    tagBg: "bg-blue-600 shadow-blue-500/50",
    title: "Community Feed & Ranks",
    author: null,
    shortMessage: "The Community Feed is completely revamped! Comments now sort by score and display beautiful Rank Badges next to your name.",
    link: null,
    buttonText: null,
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-blue-300">What's New in the Community?</h3>
        <ul className="pl-4 text-sm leading-relaxed space-y-2 list-disc list-inside text-indigo-100">
          <li><strong className="text-white">Nested Replies:</strong> You can now reply directly to specific comments, creating Reddit-style discussion threads!</li>
          <li><strong className="text-white">Rank Badges:</strong> Every comment you post now automatically displays your Arise Point rank badge and icon!</li>
          <li><strong className="text-white">Upvote Rewards:</strong> You automatically earn <span className="text-yellow-400 font-bold">+1 ✧</span> Arise Point when someone upvotes your post!</li>
          <li><strong className="text-white">Score Sorting:</strong> Highly upvoted posts naturally rise to the top of the feed!</li>
          <li><strong className="text-white">Anime Context:</strong> The Global Feed on the Home Page now tells everyone exactly which anime you were discussing!</li>
        </ul>
      </div>
    )
  },
  {
    id: 2,
    tag: "New Features",
    icon: <UserCheck className="w-4 h-4 text-emerald-400" />,
    theme: "from-emerald-900/80 to-teal-900/80",
    border: "border-emerald-500/50",
    shadow: "shadow-[0_0_30px_rgba(16,185,129,0.25)]",
    tagBg: "bg-emerald-600 shadow-emerald-500/50",
    title: "Discord Auth & Profiles",
    author: null,
    shortMessage: "One-click login with Discord is finally here, along with an advanced Profile Image Cropper!",
    link: null,
    buttonText: null,
    content: (
      <div className="space-y-4 text-indigo-100">
        <h3 className="text-lg font-bold text-emerald-300">Identity Upgrades</h3>
        <ul className="pl-4 text-sm leading-relaxed space-y-2 list-disc list-inside">
          <li><strong className="text-white">Discord Integration:</strong> You can now register and log in instantly with one click using the new "Continue with Discord" button!</li>
          <li><strong className="text-white">Avatar Cropper:</strong> Added a sleek image cropper when uploading your profile picture to ensure a perfect 1:1 square.</li>
          <li><strong className="text-white">Cinematic Banners:</strong> Upload a custom background banner for your profile. The new cropper perfectly locks it into a cinematic 3:1 ratio!</li>
          <li><strong className="text-white">Netflix-Style Hover Cards:</strong> Hovering over anime posters now features a smoother Apple iOS-style spring animation.</li>
        </ul>
      </div>
    )
  },
  {
    id: 3,
    tag: "Progression",
    icon: <Sparkles className="w-4 h-4 text-fuchsia-400" />,
    theme: "from-fuchsia-900/80 to-pink-900/80",
    border: "border-fuchsia-500/50",
    shadow: "shadow-[0_0_30px_rgba(217,70,239,0.25)]",
    tagBg: "bg-fuchsia-600 shadow-fuchsia-500/50",
    title: "Arise Point Economy",
    author: null,
    shortMessage: "Track exactly how you earn your points with the brand new Point History Modal!",
    link: null,
    buttonText: null,
    content: (
      <div className="space-y-4 text-pink-100">
        <h3 className="text-lg font-bold text-fuchsia-300">Track Your Journey</h3>
        <ul className="pl-4 text-sm leading-relaxed space-y-2 list-disc list-inside">
          <li><strong className="text-white">Point History Modal:</strong> Click on your Arise Points number inside your profile to open a detailed ledger of every point you've ever earned or spent.</li>
          <li><strong className="text-white">Point Deductions:</strong> If someone removes their upvote, or if you delete your comment, the associated points are accurately removed from your account.</li>
          <li><strong className="text-white">Activity Rewards:</strong> Earn points for adding to watchlists, updating your avatar, following the Lead Developer, and sharing views!</li>
          <li><strong className="text-white">Titles & Colors:</strong> Reaching thresholds (e.g. God-Level) permanently recolors your entire profile to flex your status!</li>
        </ul>
      </div>
    )
  },
  {
    id: 4,
    tag: "Announcement",
    icon: <Megaphone className="w-4 h-4 text-purple-400" />,
    theme: "from-indigo-900/80 to-purple-900/80",
    border: "border-purple-500/50",
    shadow: "shadow-[0_0_30px_rgba(168,85,247,0.25)]",
    tagBg: "bg-purple-600 shadow-purple-500/50",
    title: "Message from Lead Dev",
    author: "dejavuh",
    authorColor: "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]",
    shortMessage: "Welcome to Da Vinci! I've just introduced the Arise Points system. Click here to learn how to earn points!",
    link: "/user/dejavuh",
    buttonText: "Visit Profile",
    content: (
      <div className="space-y-6 text-indigo-100">
        <div>
          <h3 className="text-lg font-bold text-purple-300 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> Who is dejavuh?
          </h3>
          <p className="pl-4 text-sm leading-relaxed">
            I am the Lead Developer of the Da Vinci platform. My goal is to build the ultimate cinematic tracker experience for anime enthusiasts. Visit my profile to see my exclusive Hollow Purple animation!
          </p>
        </div>

        <div>
          <h3 className="text-lg font-bold text-purple-300 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> What are Arise Points?
          </h3>
          <p className="pl-4 text-sm leading-relaxed">
            Arise Points (✧) are the official progression currency of the Da Vinci platform. They show off your dedication and activity within the community.
          </p>
        </div>

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

        <div className="pt-4 border-t border-purple-500/20">
          <h3 className="text-lg font-bold text-purple-300 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> Arise Point Tiers & Profile Themes
          </h3>
          <p className="text-sm text-indigo-200 mb-4">
            Reaching new point thresholds automatically unlocks exclusive Titles and completely changes the color theme of your entire profile!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg">
              <div className="font-bold text-emerald-400">Medium Demigod</div>
              <div className="text-xs text-slate-300">100+ ✧ Points</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
              <div className="font-bold text-blue-400">Demigod</div>
              <div className="text-xs text-slate-300">500+ ✧ Points</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg">
              <div className="font-bold text-yellow-400">Angel</div>
              <div className="text-xs text-slate-300">1,000+ ✧ Points</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
              <div className="font-bold text-orange-400">King of angel</div>
              <div className="text-xs text-slate-300">2,000+ ✧ Points</div>
            </div>
            <div className="bg-red-900/40 border border-red-600/50 p-3 rounded-lg sm:col-span-2 md:col-span-1 shadow-[0_0_15px_rgba(220,38,38,0.2)]">
              <div className="font-bold text-red-500 tracking-wider">Great old one</div>
              <div className="text-xs text-red-300/70">10,000+ ✧ Points</div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 5,
    tag: "Massive QoL Update",
    icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
    theme: "from-cyan-900/80 to-blue-900/80",
    border: "border-cyan-500/50",
    shadow: "shadow-[0_0_30px_rgba(34,211,238,0.25)]",
    tagBg: "bg-cyan-600 shadow-cyan-500/50",
    title: "Privacy, Fluid UI, & Direct Messaging",
    author: null,
    shortMessage: "We've added Private Profiles, Mutual Messaging, Custom Toasts, and ultra-fluid animations across the app!",
    link: null,
    buttonText: null,
    content: (
      <div className="space-y-4 text-cyan-100">
        <h3 className="text-lg font-bold text-cyan-300">Huge Quality of Life Improvements</h3>
        <ul className="pl-4 text-sm leading-relaxed space-y-2 list-disc list-inside">
          <li><strong className="text-white">Private Profiles:</strong> You can now set your profile to private! Only users who you follow back (mutuals) can see your activity.</li>
          <li><strong className="text-white">Mutual Direct Messaging:</strong> A brand new, secure Direct Message system. You can only message mutual followers, preventing spam!</li>
          <li><strong className="text-white">Custom Toasts:</strong> Removed all ugly native browser alerts! We built a gorgeous, non-intrusive Toast Notification system that glides in from the top right.</li>
          <li><strong className="text-white">Fluid Animations:</strong> Anime cards now feature a premium, inline hover scale effect instead of the clunky portal pop-out. Modal scroll bleed has also been fully locked down!</li>
          <li><strong className="text-white">Smartphone Upgrades:</strong> A brand new bottom navigation bar for an app-like experience on mobile devices!</li>
        </ul>
      </div>
    )
  }
];

export default function AnnouncementBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  };

  const prevSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  const current = announcements[currentIndex];

  return (
    <div className="relative z-30 container mx-auto px-4 md:px-12 mt-8 mb-8">
      <div className={`bg-gradient-to-r ${current.theme} backdrop-blur-xl border ${current.border} rounded-2xl ${current.shadow} relative overflow-hidden transition-all duration-500`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-fuchsia-500 animate-pulse" />
        
        {/* Banner Header (Always visible) */}
        <div 
          className="p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6 cursor-pointer group"
          onClick={() => setIsOpen(!isOpen)}
        >
          {/* Slider Controls */}
          <div className="flex items-center gap-2 shrink-0 bg-black/30 p-1.5 rounded-full border border-white/5" onClick={(e) => e.stopPropagation()}>
            <button onClick={prevSlide} className="p-2 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-1.5 px-2">
              {announcements.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${currentIndex === i ? 'w-4 bg-white' : 'w-1.5 bg-white/30'}`} />
              ))}
            </div>
            <button onClick={nextSlide} className="p-2 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-w-0 px-2 sm:px-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className={`${current.tagBg} text-white text-[10px] sm:text-xs px-2 py-1 rounded tracking-widest uppercase shadow-lg flex items-center gap-1`}>
                    {current.icon} {current.tag}
                  </span>
                  <span className="truncate">{current.title}</span>
                  {current.author && <span className={current.authorColor}>{current.author}</span>}
                </h2>
                <p className="text-indigo-100 font-medium text-xs sm:text-sm md:text-base pr-4 sm:pr-8">
                  {current.shortMessage}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          
          <div className="flex items-center gap-4 shrink-0 mt-2 md:mt-0 self-end md:self-auto px-2 sm:px-0">
            {current.link && current.buttonText && (
              <Link href={current.link} onClick={(e) => e.stopPropagation()}>
                <button className={`whitespace-nowrap bg-gradient-to-r ${current.theme.split(' ')[0].replace('from-', 'from-')} to-indigo-600 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-full font-bold shadow-xl transition hover:scale-105 active:scale-95 text-sm sm:text-base border border-white/10`}>
                  {current.buttonText}
                </button>
              </Link>
            )}
            <ChevronDown className={`w-6 h-6 sm:w-8 sm:h-8 text-white/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
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
              className="overflow-hidden border-t border-white/10 bg-black/20"
            >
              <div className="p-4 sm:p-6 md:pl-[140px] border-t border-black/20">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {current.content}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
