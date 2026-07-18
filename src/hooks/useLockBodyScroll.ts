import { useEffect } from 'react';

export function useLockBodyScroll() {
  useEffect(() => {
    // Prevent scrolling on mount
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    // Re-enable scrolling when component unmounts
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
}
