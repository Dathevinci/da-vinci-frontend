import { useState, useEffect } from "react";
import { IMangaResult } from "@/lib/asura/models";
import Link from "next/link";
import { Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useManhwaModal } from "@/components/providers/ManhwaModalProvider";

export default function ManhwaHeroCarousel({ items }: { items: IMangaResult[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { openManhwa } = useManhwaModal();

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [items]);

  if (!items || items.length === 0) return null;

  // Render a simple horizontal scrolling or 3D-ish carousel
  // For the exact Asura look: 5 items visible. Center is large.
  // We'll use a simpler approach: A flex container with absolute positioning for the cards.
  
  const getCardStyle = (index: number) => {
    const diff = (index - activeIndex + items.length) % items.length;
    let offset = diff;
    if (offset > items.length / 2) offset -= items.length; // -2, -1, 0, 1, 2
    
    // We only show roughly 5 items (-2, -1, 0, 1, 2)
    if (Math.abs(offset) > 3) {
      return { opacity: 0, x: offset > 0 ? 1000 : -1000, scale: 0.5, zIndex: 0 };
    }

    const absOffset = Math.abs(offset);
    const scale = offset === 0 ? 1 : 0.85 - (absOffset * 0.05);
    const x = offset * 220; // 220px apart
    const zIndex = 10 - absOffset;
    const opacity = offset === 0 ? 1 : 0.5 - (absOffset * 0.1);

    return { x, scale, zIndex, opacity };
  };

  return (
    <div className="relative w-full h-[320px] md:h-[400px] overflow-hidden flex items-center justify-center bg-[#09090b] mb-12 py-10">
      {/* Background glow based on active item */}
      <div className="absolute inset-0 bg-red-900/20 blur-[100px] pointer-events-none" />
      
      <div className="relative w-full max-w-[1200px] h-[300px] flex items-center justify-center">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item, i) => {
            const style = getCardStyle(i);
            const isActive = i === activeIndex;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: style.x > 0 ? 300 : -300, scale: 0.5 }}
                animate={{ 
                  opacity: style.opacity, 
                  x: style.x, 
                  scale: style.scale, 
                  zIndex: style.zIndex,
                  pointerEvents: style.opacity === 0 ? "none" : "auto"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
                className="absolute w-[180px] h-[260px] md:w-[220px] md:h-[320px] rounded-xl overflow-hidden cursor-pointer border border-[#2a2a32] shadow-2xl"
                onClick={() => setActiveIndex(i)}
                style={{ 
                  boxShadow: isActive ? '0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(220,38,38,0.3)' : '0 10px 20px rgba(0,0,0,0.5)',
                  filter: isActive ? 'none' : 'brightness(0.6)'
                }}
              >
                {isActive ? (
                  <button onClick={() => openManhwa(item)} className="block w-full h-full relative text-left">
                    {item.image && (
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
                      {item.rating && (
                        <div className="absolute top-2 left-2 bg-black/80 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 backdrop-blur-md">
                          <Star className="w-3 h-3 fill-yellow-400" /> {Number(item.rating).toFixed(1)}
                        </div>
                      )}
                      <h3 className="text-white font-black text-sm md:text-base leading-tight drop-shadow-md text-center">
                        {item.title}
                      </h3>
                    </div>
                  </button>
                ) : (
                  <div className="w-full h-full relative">
                    {item.image && (
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
