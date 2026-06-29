"use client";

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';

export default function AuthSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loginOrRegister } = useUser();
  const syncAttempted = useRef(false);

  useEffect(() => {
    const authSuccess = searchParams.get('discord_auth');
    const authError = searchParams.get('auth_error');

    if (authError && !syncAttempted.current) {
      syncAttempted.current = true;
      alert(`Authentication Error: ${authError}`);
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
            alert("Failed to sign in. Please try again.");
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
