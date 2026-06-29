"use client";
import { useSession } from "next-auth/react";
import { useUser } from "@/hooks/useUser";
import { useEffect, useRef } from "react";

export default function DiscordSync() {
  const { data: session, status } = useSession();
  const { user, loginOrRegister, updateProfile } = useUser();
  const syncAttempted = useRef(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user && !user && !syncAttempted.current) {
      syncAttempted.current = true;
      const sync = async () => {
        const { name, email, image } = session.user;
        if (!email) return;
        
        const username = name?.replace(/\s+/g, '') || email.split('@')[0];
        const res = await loginOrRegister(username, email);
        if (res?.success && image) {
          // Sync discord avatar to our backend
          await updateProfile({ avatar: image });
        }
      };
      sync();
    }
  }, [status, session, user, loginOrRegister, updateProfile]);

  return null;
}
