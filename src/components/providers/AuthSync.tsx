"use client";

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/components/ui/Toast';

export default function AuthSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loginOrRegister } = useUser();
  const { toast } = useToast();
  const syncAttempted = useRef(false);

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
          .then(() => {
            console.log("Successfully synced Discord auth with Da Vinci backend.");
          })
          .catch((err) => {
            console.error("Failed to sync Discord auth:", err);
            toast("Failed to sign in. Please try again.", "error");
          })
          .finally(() => {
            // Clean up the URL
            router.replace('/');
          });
      }
    }
  }, [searchParams, router, loginOrRegister]);

  return null;
}
