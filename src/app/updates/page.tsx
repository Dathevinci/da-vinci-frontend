"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/layout/PageTransition";
import UpdatePost from "@/components/updates/UpdatePost";
import { useUser } from "@/hooks/useUser";
import { Megaphone, Plus } from "lucide-react";
import { isAdmin } from "@/lib/admin";
import { useToast } from "@/components/ui/Toast";
import CreateUpdateModal from "@/components/updates/CreateUpdateModal";

export default function UpdatesPage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const isDev = isAdmin(user);
  const canPostUpdate = isDev;

  const fetchUpdates = async () => {
    try {
      const url = new URL(`${API_URL}/api/announcements`);
      if (user) url.searchParams.append("userId", user.id);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setUpdates(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast("Failed to load updates", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      fetchUpdates();
    }
  }, [isLoaded, user]);

  const handleLikeToggle = (id: string, newLikedState: boolean) => {
    setUpdates(prev => 
      prev.map(p => 
        p.id === id 
          ? { ...p, hasLiked: newLikedState, _count: { ...p._count, likes: p._count.likes + (newLikedState ? 1 : -1) } }
          : p
      )
    );
  };

  const handleCreated = (newUpdate: any) => {
    setUpdates([newUpdate, ...updates]);
    setShowCreateModal(false);
  };

  const handleDelete = (id: string) => {
    setUpdates(prev => prev.filter(p => p.id !== id));
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#09090b] pt-24 pb-24 text-white relative">
        <div className="max-w-3xl mx-auto px-4 md:px-0">
          
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
              <Megaphone className="w-8 h-8 text-pink-500" /> Platform Updates
            </h1>
            {canPostUpdate && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo- hover:bg-purple-500 text-white p-2 rounded-full transition shadow-lg"
              >
                <Plus className="w-6 h-6" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : updates.length === 0 ? (
            <div className="text-center text-slate-500 py-20">
              <Megaphone className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl font-bold">No updates yet</p>
              <p>Check back later for platform news and features.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {updates.map((update) => (
                <UpdatePost 
                  key={update.id} 
                  post={update} 
                  onLikeToggle={handleLikeToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

        </div>

        {showCreateModal && (
          <CreateUpdateModal 
            onClose={() => setShowCreateModal(false)} 
            onCreated={handleCreated}
          />
        )}
      </div>
    </PageTransition>
  );
}
