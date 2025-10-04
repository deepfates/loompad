import { useState, useEffect } from "react";

export function useOfflineStatus() {
  // In Replit iframe, navigator.onLine is unreliable - assume online by default
  const isInReplit = typeof window !== 'undefined' && window.location !== window.parent.location;
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    return isInReplit ? true : navigator.onLine;
  });
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Skip offline detection in Replit iframe since navigator.onLine is unreliable
    if (isInReplit) {
      return;
    }

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setWasOffline(false);
        // Could trigger a toast notification here
        if (import.meta.env.DEV) {
          console.log("Connection restored");
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      if (import.meta.env.DEV) {
        console.log("Connection lost - working offline");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline, isInReplit]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
  };
}
