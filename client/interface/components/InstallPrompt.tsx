import { useState, useEffect, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const promptRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const root =
      typeof document !== "undefined" ? document.documentElement : null;
    if (!root) {
      return;
    }

    const GAP = 12; // match theme spacing so LOOM clears the banner comfortably

    const updateOffset = () => {
      const height = promptRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--install-banner-offset", `${height + GAP}px`);
    };

    if (showPrompt) {
      updateOffset();

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined" && promptRef.current) {
        resizeObserver = new ResizeObserver(updateOffset);
        resizeObserver.observe(promptRef.current);
      }

      return () => {
        resizeObserver?.disconnect();
        root.style.removeProperty("--install-banner-offset");
      };
    } else {
      root.style.removeProperty("--install-banner-offset");
    }
  }, [showPrompt]);

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
    <div
      ref={promptRef}
      className="fixed top-2 left-2 right-2 z-50 p-3 bg-theme-bg-modal border border-theme-border rounded shadow-lg"
    >
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
