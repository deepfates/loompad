import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted" && import.meta.env.DEV) {
      console.log("PWA installed");
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed top-2 left-2 right-2 z-50 p-3 bg-theme-bg-modal border border-theme-border rounded shadow-lg">
      <div className="font-bold">📱 Install LoomPad</div>
      <div className="text-sm my-2 text-theme-border">
        Add to your home screen for the best experience
      </div>
      <div className="flex gap-2">
        <button 
          className="px-3 py-1.5 bg-theme-button text-theme-button-text border border-theme-border rounded text-sm" 
          onClick={handleInstall}
        >
          Install
        </button>
        <button 
          className="px-3 py-1.5 bg-theme-bg text-theme-text border border-theme-border rounded text-sm hover:bg-theme-button-bg" 
          onClick={handleDismiss}
        >
          Later
        </button>
      </div>
    </div>
  );
};
