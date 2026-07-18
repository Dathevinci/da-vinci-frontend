"use client";

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useToast } from "@/components/ui/Toast";
import { isAdmin, isLeadDev } from "@/lib/admin";
import DiscordInviteModal from '@/components/layout/DiscordInviteModal';

export default function AuthSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loginOrRegister } = useUser();
  const { toast } = useToast();
  const syncAttempted = useRef(false);
  const [discordData, setDiscordData] = useState<{ username: string; email: string; avatar?: string } | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    const authSuccess = searchParams.get('discord_auth');
    const authError = searchParams.get('auth_error');

    if (authError && !syncAttempted.current) {
      syncAttempted.current = true;
      toast(`Authentication Error: ${authError}`, "error");
      router.replace('/');
      return;
    }

    if (authSuccess === 'success' && !syncAttempted.current) {
      syncAttempted.current = true;
      
      const email = searchParams.get('email');
      const username = searchParams.get('username') || email?.split('@')[0];
      const avatar = searchParams.get('avatar');

      if (email && username) {
        // Sync with backend
        loginOrRegister(username, email, avatar || undefined)
          .then((res) => {
            if (res.requires_invite) {
              setDiscordData({ username, email, avatar: avatar || undefined });
              setShowInviteModal(true);
            } else if (res.success) {
              const uName = (res.user?.username || username).toLowerCase();
              if (uName === 'xhackerdevil') toast('Welcome Bug Founder 🐞', "success");
              else if (isLeadDev(uName)) toast('Welcome Back, Lead Developer 👑', "success");
              else if (isAdmin(uName)) toast('Welcome Back, Admin 👑', "success");
              else toast('Welcome Back!', "success");
              router.replace('/');
            } else {
              toast(res.message || "Failed to sign in. Please try again.", "error");
              router.replace('/');
            }
          })
          .catch((err) => {
            console.error("Failed to sync Discord auth:", err);
            toast("Failed to sign in. Please try again.", "error");
            router.replace('/');
          });
      }
    }
  }, [searchParams, router, loginOrRegister]);

  if (showInviteModal && discordData) {
    return (
      <DiscordInviteModal 
        username={discordData.username}
        email={discordData.email}
        avatar={discordData.avatar}
        onClose={() => { setShowInviteModal(false); router.replace('/'); }}
        onSuccess={() => { setShowInviteModal(false); router.replace('/'); }}
      />
    );
  }

  return null;
}
