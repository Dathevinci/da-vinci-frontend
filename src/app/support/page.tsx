"use client";

import { useState, useEffect } from "react";
import { Coffee, Heart, Shield, Crown, Zap, Star, ExternalLink, Info, Sparkles, Diamond } from "lucide-react";
import { motion } from "framer-motion";
import PageTransition from "@/components/layout/PageTransition";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import BuyPointsModal from "@/components/shop/BuyPointsModal";
import { currencySymbol } from "@/lib/kofiBundles";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface KofiStats {
  monthlyTotal: number;
  currency: string;
  recent: { name: string; linked: boolean; amount: number; currency: string; tierName: string | null; type: string; createdAt: string }[];
}

export default function SupportPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<KofiStats | null>(null);
  const [showBuyPoints, setShowBuyPoints] = useState(false);
  const monthlyGoal = 100;

  useEffect(() => {
    fetch(`${API_URL}/api/kofi/stats`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d); })
      .catch(() => {});
  }, []);

  const currency = stats?.currency || "GBP";
  const sym = currencySymbol(currency);
  const currentDonation = stats?.monthlyTotal ?? 0;
  const progress = Math.min((currentDonation / monthlyGoal) * 100, 100);
  const recent = stats?.recent || [];
  const topSupporter = recent[0];



  return (
    <PageTransition>
      <div className="min-h-screen pt-24 pb-12 bg-[#09090b] text-white relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#ff5e5b]/10 blur-[150px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none -translate-x-1/3 translate-y-1/3"></div>

        <div className="max-w-5xl mx-auto px-4 md:px-8 relative z-10">
          
          <div className="text-center mb-16 mt-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="w-20 h-20 bg-[#ff5e5b]/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-[#ff5e5b]/30 shadow-[0_0_40px_rgba(255,94,91,0.2)] rotate-3"
            >
              <Heart className="w-10 h-10 text-[#ff5e5b]" />
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-6xl font-black mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400"
            >
              Keep Da Vinci Alive
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed"
            >
              We don't run ads because they ruin the experience. But running high-quality servers isn't free. Help us stay ad-free by becoming a supporter!
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            
            {/* Left Column: Progress & CTA */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="lg:col-span-3 space-y-8"
            >
              {/* Server Cost Tracker Container */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full"></div>
                
                <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3 relative z-10">
                  <Coffee className="w-6 h-6 text-purple-400" />
                  Monthly Server Cost
                </h2>

                <div className="relative z-10 mb-8">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Current Funds</span>
                      <div className="text-4xl font-black text-white mt-1">{sym}{currentDonation}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Goal</span>
                      <div className="text-2xl font-bold text-slate-500 mt-1">{sym}{monthlyGoal}</div>
                    </div>
                  </div>
                  
                  <div className="w-full h-4 bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-[#ff5e5b] to-rose-400 relative rounded-full"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}></div>
                    </div>
                  </div>
                  <div className="mt-4 text-center text-sm font-medium text-slate-400">
                    {progress < 100 ? `${(100 - progress).toFixed(0)}% remaining to keep the servers running this month!` : "Monthly goal reached! Thank you!"}
                  </div>
                </div>

                <a 
                  href="https://ko-fi.com/dathevinci" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-[#ff5e5b] to-[#ff4542] hover:from-[#ff4542] hover:to-[#e63e3b] text-white font-black text-lg py-5 px-6 rounded-2xl transition-all flex justify-center items-center gap-3 shadow-[0_10px_30px_rgba(255,94,91,0.3)] transform hover:scale-[1.02] active:scale-[0.98] relative z-10"
                >
                  <Coffee className="w-6 h-6" />
                  Support on Ko-fi
                  <ExternalLink className="w-5 h-5 opacity-70" />
                </a>

                {/* How perks auto-apply */}
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] p-4 relative z-10">
                  <Info className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-100/90 leading-relaxed">
                    To get your <span className="font-bold">Supporter badge</span> and <span className="font-bold">Arise Points</span> automatically, write your Da Vinci username{user?.username ? <> (<span className="font-black text-amber-200">{user.username}</span>)</> : null} in the Ko-fi message when you pay.
                  </p>
                </div>

                {/* Buy Arise Points with real money */}
                <button
                  onClick={() => setShowBuyPoints(true)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-500/40 bg-purple-500/10 py-4 font-black text-purple-100 transition hover:bg-purple-500/20 hover:scale-[1.01] relative z-10"
                >
                  <Diamond className="w-5 h-5 text-fuchsia-400" /> Buy Arise Points
                </button>
              </div>

              {/* Info box */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 flex items-start gap-4">
                <Info className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-purple-300 mb-2">Why support us?</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Da Vinci is built by anime fans, for anime fans. We completely refuse to use intrusive ads or pop-ups. Your donations directly pay for the high-speed servers, database costs, and continuous development of new features.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Right Column: Ranks */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="lg:col-span-2 space-y-4"
            >
              <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3 px-2">
                <Star className="w-6 h-6 text-amber-400" />
                Donation Perks
              </h2>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl mb-6">
                <ul className="space-y-4 text-slate-300 font-medium">
                  <li className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                    <span>Exclusive animated profile effects to show off your status</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Crown className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                    <span>Custom "Supporter" rank displayed publicly on your profile badge</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-fuchsia-400 shrink-0 mt-0.5" />
                    <span>1k Arise Points to spend on anything in the cosmetic shop</span>
                  </li>
                </ul>
              </div>

              <div className="relative overflow-hidden p-6 rounded-2xl border border-red-500/30 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.15)] group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[40px] rounded-full"></div>
                <div className="relative z-10 text-center">
                  <Heart className="w-8 h-8 text-red-500 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Recent Supporter</p>
                  <p className="text-2xl font-black text-white mb-2">{topSupporter?.name || "Māna-Yood-Sushāī"}</p>
                  <p className="text-sm text-red-200">
                    {topSupporter ? (
                      "Thank you for keeping Da Vinci alive! 💛"
                    ) : (
                      <>Thank you! Unlocked the exclusive <strong>Crimson Realm</strong> animated profile effect!</>
                    )}
                  </p>
                </div>
              </div>

              {recent.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent supporters</p>
                  <div className="flex flex-wrap gap-2">
                    {recent.slice(0, 8).map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200">
                        <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
                        {r.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        </div>
      </div>

      {showBuyPoints && <BuyPointsModal username={user?.username || ""} onClose={() => setShowBuyPoints(false)} />}
    </PageTransition>
  );
}
