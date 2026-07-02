"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function HeartExplosion({ show, coordinates }: { show: boolean, coordinates?: { x: number, y: number } | null }) {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    if (show) {
      const newParticles = Array.from({ length: 12 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 12;
        const radius = 30 + Math.random() * 40;
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

  if (!show || particles.length === 0) return null;

  const content = (
    <div 
      className={coordinates ? "fixed z-[9999] pointer-events-none" : "absolute inset-0 z-[9999] pointer-events-none flex items-center justify-center"}
      style={coordinates ? { left: coordinates.x, top: coordinates.y } : undefined}
    >
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
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <Heart className="w-5 h-5 text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  if (typeof document !== 'undefined' && coordinates) {
    return createPortal(content, document.body);
  }

  return content;
}
