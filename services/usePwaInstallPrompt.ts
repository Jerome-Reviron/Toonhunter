import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [hasInstalled, setHasInstalled] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window as any).navigator.standalone === true;

    if (isStandalone) {
      setHasInstalled(true);
      localStorage.setItem("pwa-installed", "true");
    } else {
      setHasInstalled(localStorage.getItem("pwa-installed") === "true");
      setHasDismissed(localStorage.getItem("pwa-install-dismissed") === "true");
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const bipEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(bipEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setHasInstalled(true);
      localStorage.setItem("pwa-installed", "true");
    } else {
      setHasDismissed(true);
      localStorage.setItem("pwa-install-dismissed", "true");
    }

    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return {
    isInstallable,
    hasInstalled,
    hasDismissed,
    install,
  };
}
