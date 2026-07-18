"use client";

import { useState } from "react";
import UserProfileModal from "@/components/profile/UserProfileModal";

/**
 * Wraps a user's avatar/name so clicking it opens the Discord-style profile
 * POPOUT (UserProfileModal) instead of navigating to the full page. Drop-in
 * replacement for the hand-written `<Link href={`/user/${username}`}>` sites.
 *
 * Renders as an inline button; `stopPropagation` (default true) keeps the click
 * from bubbling to a parent card's own onClick.
 */
export default function UserLink({
  username,
  className = "",
  children,
  stopPropagation = true,
}: {
  username: string;
  className?: string;
  children: React.ReactNode;
  stopPropagation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (stopPropagation) { e.preventDefault(); e.stopPropagation(); }
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      {open && <UserProfileModal username={username} onClose={() => setOpen(false)} />}
    </>
  );
}
