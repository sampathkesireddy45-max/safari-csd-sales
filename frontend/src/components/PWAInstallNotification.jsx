import React, { useState, useEffect } from "react";
import { Download, X, Smartphone, CheckCircle2 } from "lucide-react";

const PWAInstallNotification = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone/PWA installed mode
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem("safari_pwa_dismissed");

    // Standard Android / Chrome / Edge PWA install prompt handler
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isDismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSSafari =
      /iphone|ipad|ipod/.test(userAgent) &&
      !window.MSStream &&
      /safari/.test(userAgent) &&
      !/crios|fxios/.test(userAgent);

    if (isIOSSafari && !isDismissed) {
      setIsIOS(true);
      setShowPrompt(true);
    }

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log("Safari CSD PWA installed successfully");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);

    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("safari_pwa_dismissed", "true");
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900 dark:bg-slate-850 text-white p-4 rounded-2xl shadow-2xl border border-indigo-500/40 backdrop-blur-lg flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 p-1 shadow-md">
          <img src="/icon-192.png" alt="Safari CSD Icon" className="w-10 h-10 rounded-lg object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-white tracking-wide">
              Install Safari CSD App
            </h4>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-300 mt-1 leading-snug">
            {isIOS
              ? "Tap the Share button ⎋ in Safari and choose 'Add to Home Screen' for instant offline access."
              : "Install on your device for fast offline counter sales and 1-tap home-screen access."}
          </p>

          {!isIOS && deferredPrompt && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install Now</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
              >
                Not Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PWAInstallNotification;
