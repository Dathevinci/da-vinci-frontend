"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

export default function HeartExplosion({ show }: { show: boolean }) {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    if (show) {
      const newParticles = Array.from({ length: 12 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 12;
        const radius = 30 + Math.random() * 30;
        return {
          id: Date.now() + i,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          scale: 0.3 + Math.random() * 0.5,
          rotation: Math.random() * 360,
        };
      });
      setParticles(newParticles);
      
      const timer = setTimeout(() => {
        setParticles([]);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{ 
              x: p.x, 
              y: p.y - 20,
              scale: p.scale, 
              opacity: 0,
              rotate: p.rotation
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute"
          >
            <Heart className="w-4 h-4 text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
