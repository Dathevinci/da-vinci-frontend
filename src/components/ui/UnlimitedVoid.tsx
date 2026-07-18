"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function UnlimitedVoid({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 6500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center overflow-hidden font-serif select-none"
      >
        {/* Deep Space / Nebula Background */}
        <motion.div
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 5, ease: "easeOut" }}
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(30,40,60,0.8) 0%, rgba(10,20,40,0.9) 40%, #000 100%)',
            filter: 'contrast(1.5) brightness(0.9)'
          }}
        />

        {/* The Black Hole / Void Sphere */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 2.5, ease: [0.22, 1, 0.36, 1] }} // spring-like expansion
          className="absolute rounded-full bg-black z-10"
          style={{
            width: '85vmin',
            height: '85vmin',
            boxShadow: '0 0 100px 40px rgba(180,210,255,0.7), inset 0 0 60px 20px rgba(0,0,0,1), 0 0 250px 100px rgba(120,160,255,0.1)'
          }}
        />
        
        {/* The Glowing Edge Rings (Accretion Disk Simulation) */}
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1.3, 1.05], opacity: [0, 1, 1], rotate: 360 }}
          transition={{ duration: 6, ease: "easeOut" }}
          className="absolute rounded-full border-[3px] border-white/60 z-10 mix-blend-screen"
          style={{
            width: '87vmin',
            height: '87vmin',
            boxShadow: '0 0 50px 15px rgba(255,255,255,0.8), inset 0 0 30px 5px rgba(200,230,255,0.5)'
          }}
        />

        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: 180 }}
          animate={{ scale: [0, 1.35, 1.08], opacity: [0, 0.8, 0.8], rotate: -180 }}
          transition={{ duration: 7, ease: "easeOut" }}
          className="absolute rounded-full border-[1px] border-blue-200/40 z-10 mix-blend-screen"
          style={{
            width: '90vmin',
            height: '90vmin',
            boxShadow: '0 0 80px 20px rgba(100,150,255,0.5)'
          }}
        />

        {/* Gojo Silhouette Simulation standing in front of the void */}
        <motion.div
          initial={{ opacity: 0, y: 150, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.5, duration: 2, ease: "easeOut" }}
          className="absolute -bottom-[5vh] z-20 flex flex-col items-center"
        >
          {/* Head */}
          <div className="w-[12vmin] h-[12vmin] bg-black rounded-full shadow-[0_0_20px_5px_rgba(0,0,0,1)] relative z-30" />
          {/* Cloak/Shoulders */}
          <div 
            className="w-[35vmin] h-[45vmin] bg-black rounded-[50%_50%_20%_20%] -mt-6 relative z-20"
            style={{
              boxShadow: '0 -15px 40px 10px rgba(0,0,0,1)',
              filter: 'drop-shadow(0 0 15px rgba(150,200,255,0.3))'
            }}
          />
        </motion.div>

        {/* Typography and Rewards Overlay */}
        <div className="relative z-30 flex flex-col items-center mt-[-15vh]">
          <motion.div
            initial={{ letterSpacing: "-0.5em", opacity: 0, filter: "blur(20px)", scale: 1.5 }}
            animate={{ letterSpacing: "0.2em", opacity: 1, filter: "blur(0px)", scale: 1 }}
            transition={{ delay: 2, duration: 2, ease: "easeOut" }}
            className="text-white text-5xl sm:text-7xl md:text-9xl font-black mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,1)] flex gap-4 md:gap-8"
          >
            <span>無</span>
            <span>量</span>
            <span>空</span>
            <span>処</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3, duration: 1 }}
            className="text-white/90 text-xl sm:text-3xl md:text-5xl tracking-[0.5em] md:tracking-[1em] uppercase font-light drop-shadow-2xl ml-4"
          >
            Unlimited Void
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 4, duration: 0.8, type: "spring", damping: 12 }}
            className="mt-16 bg-white/5 backdrop-blur-md border border-white/20 px-8 py-4 rounded-full text-yellow-400 font-bold text-lg sm:text-2xl md:text-3xl drop-shadow-[0_0_20px_rgba(250,204,21,0.5)] flex items-center gap-3 shadow-2xl"
          >
            <span className="animate-pulse text-yellow-200">✧</span> +10 Arise Points Granted
          </motion.div>
        </div>

        {/* Screen Shatter whiteout at the very end */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1] }}
          transition={{ delay: 6.2, duration: 0.3 }}
          className="absolute inset-0 bg-white z-50 pointer-events-none mix-blend-screen"
        />
      </motion.div>
    </AnimatePresence>
  );
}
