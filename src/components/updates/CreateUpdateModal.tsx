"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, UploadCloud, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";

interface CreateUpdateModalProps {
  onClose: () => void;
  onCreated: (update: any) => void;
}

export default function CreateUpdateModal({ onClose, onCreated }: CreateUpdateModalProps) {
  const { user } = useUser();
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("Platform Updates");
  const [imageUrl, setImageUrl] = useState("");
  
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      toast("Cloudinary config missing", "error");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setImageUrl(data.secure_url);
      }
    } catch (err) {
      toast("Failed to upload image", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.username.toLowerCase() !== "dejavuh") return;
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          title,
          content,
          tag,
          image: imageUrl || null
        })
      });

      const data = await res.json();
      if (data.success) {
        toast("Announcement posted!", "success");
        onCreated(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast(err.message || "Failed to post", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
          <h2 className="text-xl font-bold text-white">Create Update</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Tags (comma separated)</label>
            <input 
              type="text" 
              value={tag} 
              onChange={e => setTag(e.target.value)} 
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Content</label>
            <textarea 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 h-32 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Image (Optional)</label>
            {imageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-white/10">
                <img src={imageUrl} alt="Preview" className="w-full h-32 object-cover" />
                <button 
                  type="button" 
                  onClick={() => setImageUrl("")} 
                  className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white hover:bg-red-500 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="update-image" />
                <label 
                  htmlFor="update-image"
                  className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-4 py-2 rounded-lg font-bold cursor-pointer transition w-full justify-center border border-indigo-500/30"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                  {uploading ? "Uploading..." : "Upload Image"}
                </label>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2 rounded-lg font-bold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting || !title || !content}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold transition flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Post Update
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
