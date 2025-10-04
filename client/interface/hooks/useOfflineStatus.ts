import { useState, useEffect } from "react";

export function useOfflineStatus() {
  // Always assume online for SSR and Replit iframe environments
  // navigator.onLine is unreliable in iframes
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Only check online status in browser (not SSR) and not in iframe
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    // Check if we're in an iframe (like Replit)
    const isInIframe = window.location !== window.parent.location;
    if (isInIframe) {
      // In iframe, navigator.onLine is unreliable, so stay online
      setIsOnline(true);
      return;
    }

    // Only use navigator.onLine outside of iframes
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setWasOffline(false);
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
  }, [wasOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
  };
}
