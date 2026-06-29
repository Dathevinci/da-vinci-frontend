"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function UnlimitedVoid({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 6000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center overflow-hidden font-serif select-none"
      >
        {/* Expanding Void Core */}
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 50], opacity: [0, 1, 1], rotate: 180 }}
          transition={{ duration: 4, ease: "easeIn" }}
          className="absolute w-4 h-4 rounded-full border-[0.5px] border-white/50"
          style={{
            boxShadow: '0 0 100px 50px rgba(255,255,255,0.8), inset 0 0 20px 10px #000'
          }}
        />
        
        {/* Deep Space Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 3 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.8) 50%, #000 100%)'
          }}
        />

        {/* Japanese Texts */}
        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            initial={{ letterSpacing: "-0.5em", opacity: 0, filter: "blur(20px)", scale: 1.5 }}
            animate={{ letterSpacing: "0.2em", opacity: 1, filter: "blur(0px)", scale: 1 }}
            transition={{ delay: 1.5, duration: 2, ease: "easeOut" }}
            className="text-white text-6xl md:text-9xl font-black mb-8 drop-shadow-[0_0_30px_rgba(255,255,255,1)] flex gap-4 md:gap-8"
          >
            <span>無</span>
            <span>量</span>
            <span>空</span>
            <span>処</span>
          </motion.div>

          {/* English Translation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.8, duration: 1 }}
            className="text-slate-300 text-2xl md:text-4xl tracking-[0.5em] md:tracking-[1em] uppercase font-light drop-shadow-xl ml-4"
          >
            Unlimited Void
          </motion.div>
          
          {/* +10 Arise Points text */}
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 4, duration: 0.8, type: "spring", damping: 12 }}
            className="mt-16 bg-white/10 backdrop-blur-md border border-white/20 px-8 py-4 rounded-full text-yellow-400 font-bold text-2xl md:text-3xl drop-shadow-[0_0_20px_rgba(250,204,21,0.5)] flex items-center gap-3"
          >
            <span className="animate-pulse">✧</span> +10 Arise Points Granted
          </motion.div>
        </div>

        {/* Screen Shatter whiteout at the very end */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1] }}
          transition={{ delay: 5.8, duration: 0.2 }}
          className="absolute inset-0 bg-white z-50 pointer-events-none mix-blend-screen"
        />
      </motion.div>
    </AnimatePresence>
  );
}
