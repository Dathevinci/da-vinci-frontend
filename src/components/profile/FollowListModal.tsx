"use client";

import { X } from 'lucide-react';
import Link from 'next/link';

interface UserPreview {
  id: string;
  username: string;
  avatar: string | null;
}

interface FollowListModalProps {
  title: string;
  users: UserPreview[];
  onClose: () => void;
}

export default function FollowListModal({ title, users, onClose }: FollowListModalProps) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-sm flex flex-col max-h-[80vh] shadow-2xl relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto p-2 flex-1">
          {users.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Nothing to show yet.</p>
          ) : (
            users.map((user) => (
              <Link 
                href={`/user/${user.username}`} 
                key={user.id} 
                onClick={onClose}
                className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.username} className="w-12 h-12 rounded-full object-cover border-2 border-white/10" />
                ) : (
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center border-2 border-white/10 text-white font-bold text-xl">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-white font-bold">{user.username}</h3>
                </div>
              </Link>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
