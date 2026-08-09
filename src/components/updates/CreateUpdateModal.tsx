"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, UploadCloud, Loader2 } from "lucide-react";
import { isAdmin } from "@/lib/admin";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";

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
    if (!user) return;
    const isDev = isAdmin(user);
    if (!isDev) return;
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/announcements`, {
        method: "POST",
        headers: authHeaders(),
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
    // z-[100], matching the delete-confirm dialog next door. At z-50 the Dock
    // (z-75) floated over this composer — a dialog has to outrank the
    // navigation it interrupts, or a long form gets a toolbar across it.
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
        className="relative max-h-[95dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b11] shadow-2xl"
      >
        {/* The same wash the page and the cards carry, so the composer looks
            like the surface it posts to. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(139,92,246,0.14),transparent_70%)]"
        />

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#0b0b11]/95 px-6 py-4 backdrop-blur">
          <h2 className="font-fell text-2xl text-white">Create Update</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative space-y-5 p-6">
          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wide text-slate-500">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              /* 16px on mobile so iOS Safari doesn't zoom the page on focus
                 and leave it zoomed — the rule every input here follows. */
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 font-mono text-base text-white transition focus:border-violet-400/50 focus:outline-none sm:text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wide text-slate-500">Tags (comma separated)</label>
            <input
              type="text"
              value={tag}
              onChange={e => setTag(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 font-mono text-base text-white transition focus:border-violet-400/50 focus:outline-none sm:text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wide text-slate-500">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="h-40 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 font-mono text-base leading-relaxed text-white transition focus:border-violet-400/50 focus:outline-none sm:text-sm"
              required
            />
            {/* The changelog renderer reads these markers, and nothing else
                told whoever writes a release that they exist. */}
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-600">
              Wrap a section header in ── rules and start it with NEW, FIXED, IMPROVED,
              CHANGED or REMOVED for a coloured chip. Lines starting with • become a list.
            </p>
          </div>

          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wide text-slate-500">Image (Optional)</label>
            {imageUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-white/10">
                <img src={imageUrl} alt="Preview" className="h-32 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="update-image" />
                <label
                  htmlFor="update-image"
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-2.5 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {uploading ? "Uploading…" : "Upload Image"}
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-white/[0.07] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-5 py-2.5 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title || !content}
              className="flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/15 px-5 py-2.5 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:opacity-40 disabled:hover:border-violet-400/30 disabled:hover:bg-violet-500/15"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Post Update
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
