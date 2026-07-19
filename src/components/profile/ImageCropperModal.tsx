"use client";

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { X, Check } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  isBanner: boolean;
  isGif?: boolean;
  onClose: () => void;
  onCropComplete: (croppedAreaPixels: any) => void;
}

export default function ImageCropperModal({ imageSrc, isBanner, isGif, onClose, onCropComplete }: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useLockBodyScroll();

  const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = () => {
    if (croppedAreaPixels) {
      onCropComplete(isGif ? null : croppedAreaPixels); // Signal that it's a GIF so it skips canvas crop if needed
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-[#141414] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
          <h3 className="text-xl font-bold text-white">Crop {isBanner ? 'Banner' : 'Profile Picture'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="relative w-full h-[50vh] min-h-[400px] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={isBanner ? 3 / 1 : 1 / 1}
            cropShape={isBanner ? 'rect' : 'round'}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
          />
        </div>

        <div className="p-6 bg-[#1a1a1a] flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-300">Zoom</label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-purple-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg font-bold text-slate-300 hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-2.5 bg-indigo- hover:bg-purple-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition"
            >
              <Check className="w-5 h-5" /> Apply Crop
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
