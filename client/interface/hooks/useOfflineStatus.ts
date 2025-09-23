import { useState, useEffect } from "react";

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
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
  }, [wasOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
  };
}
