"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Megaphone, Zap, Sparkles, UserCheck, Play } from "lucide-react";
import Link from "next/link";

const announcements = [
  {
    id: 0,
    tag: "Massive UI Overhaul",
    icon: <Sparkles className="w-4 h-4 text-pink-400" />,
    theme: "from-pink-900/80 to-rose-900/80",
    border: "border-pink-500/50",
    shadow: "shadow-[0_0_40px_rgba(244,63,94,0.3)]",
    tagBg: "bg-pink-600 shadow-pink-500/50",
    title: "Cinematic Trailers & Liquid Glass UI",
    author: null,
    shortMessage: "We've overhauled the platform's aesthetics with fluid spring animations, a built-in Cinematic Trailer Player, and Watchlist integration directly on hover cards!",
    link: null,
    buttonText: null,
    content: (
      <div className="space-y-4 text-pink-100">
        <h3 className="text-lg font-bold text-pink-300">What's New in this Update?</h3>
        <ul className="pl-4 text-sm leading-relaxed space-y-2 list-disc list-inside">
          <li><strong className="text-white">Cinematic Trailer Player:</strong> Instantly watch anime trailers without leaving the app! The new trailer modal pops up with a beautiful glassmorphic backdrop.</li>
          <li><strong className="text-white">Liquid Glass Aesthetics:</strong> The entire interface has been upgraded to a premium translucent glass aesthetic with edge-to-edge backdrop blurs.</li>
          <li><strong className="text-white">Dynamic Card Tracking:</strong> Hovering edge cards in the carousel now dynamically adjusts origin points to perfectly prevent clipping.</li>
          <li><strong className="text-white">Interactive Hover Actions:</strong> Add to Watchlist, Like, and Play trailers directly from the Netflix-style popout cards without navigating away!</li>
        </ul>
      </div>
    )
  },
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
      </div>
    )
  }
];

export default function AnnouncementBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [[currentIndex, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let nextIndex = currentIndex + newDirection;
    if (nextIndex < 0) nextIndex = announcements.length - 1;
    if (nextIndex >= announcements.length) nextIndex = 0;
    
    setPage([nextIndex, newDirection]);
    setIsOpen(false); // Close expanded view when shuffling cards
  };

  const current = announcements[currentIndex];

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 150 : -150,
      y: 20,
      scale: 0.8,
      opacity: 0,
      rotateY: direction > 0 ? 15 : -15,
      rotateZ: direction > 0 ? 4 : -4,
    }),
    center: {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      rotateY: 0,
      rotateZ: 0,
      zIndex: 10,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 150 : -150,
      y: -20,
      scale: 1.05,
      opacity: 0,
      rotateY: direction < 0 ? 15 : -15,
      rotateZ: direction < 0 ? -4 : 4,
      zIndex: 0,
    })
  };

  return (
    <div className="relative z-30 container mx-auto px-4 md:px-12 mt-8 mb-8" style={{ perspective: 1200 }}>
      {/* 
        Using popLayout to ensure smooth absolute positioning during the exit phase, 
        giving the physical "Card Shuffle" aesthetic without layout popping.
      */}
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className={`w-full bg-gradient-to-r ${current.theme} backdrop-blur-xl border ${current.border} rounded-2xl ${current.shadow} overflow-hidden shadow-2xl relative`}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-fuchsia-500 animate-pulse" />
          
          {/* Banner Header (Always visible) */}
          <div 
            className="p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6 cursor-pointer group"
            onClick={() => setIsOpen(!isOpen)}
          >
            {/* Slider Controls */}
            <div className="flex items-center gap-2 shrink-0 bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-inner" onClick={(e) => e.stopPropagation()}>
              <button onClick={(e) => paginate(-1, e)} className="p-2 hover:bg-white/20 rounded-full transition text-slate-300 hover:text-white">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-1.5 px-2">
                {announcements.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${currentIndex === i ? 'w-5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'w-1.5 bg-white/20'}`} />
                ))}
              </div>
              <button onClick={(e) => paginate(1, e)} className="p-2 hover:bg-white/20 rounded-full transition text-slate-300 hover:text-white">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-w-0 px-2 sm:px-0 overflow-hidden">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className={`${current.tagBg} text-white text-[10px] sm:text-xs px-2 py-1 rounded tracking-widest uppercase shadow-lg flex items-center gap-1`}>
                  {current.icon} {current.tag}
                </span>
                <span className="truncate drop-shadow-md">{current.title}</span>
                {current.author && <span className={current.authorColor}>{current.author}</span>}
              </h2>
              <p className="text-indigo-100 font-medium text-xs sm:text-sm md:text-base pr-4 sm:pr-8 opacity-90">
                {current.shortMessage}
              </p>
            </div>
            
            <div className="flex items-center gap-4 shrink-0 mt-2 md:mt-0 self-end md:self-auto px-2 sm:px-0">
              {current.link && current.buttonText && (
                <Link href={current.link} onClick={(e) => e.stopPropagation()}>
                  <button className={`whitespace-nowrap bg-gradient-to-r ${current.theme.split(' ')[0].replace('from-', 'from-')} to-indigo-600 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-full font-bold shadow-xl transition hover:scale-105 active:scale-95 text-sm sm:text-base border border-white/20`}>
                    {current.buttonText}
                  </button>
                </Link>
              )}
              <ChevronDown className={`w-6 h-6 sm:w-8 sm:h-8 text-white/50 transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : ''}`} />
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
                className="overflow-hidden border-t border-white/10 bg-black/30 backdrop-blur-sm"
              >
                <div className="p-4 sm:p-6 md:pl-[140px] border-t border-black/20">
                  {current.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
