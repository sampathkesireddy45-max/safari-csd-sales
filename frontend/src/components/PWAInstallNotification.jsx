import React, { useState, useEffect, useCallback } from "react";
import { Download, X } from "lucide-react";

const PWAInstallNotification = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check whether the app is currently installed on this device
  const checkInstalledStatus = useCallback(async () => {
    // 1. Running inside the installed PWA standalone window
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: window-controls-overlay)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      setShowPrompt(false);
      localStorage.setItem("safari_pwa_installed", "true");
      return true;
    }

    // 2. Check navigator.getInstalledRelatedApps (Supported on Chrome/Edge Desktop & Android)
    if ("getInstalledRelatedApps" in navigator) {
      try {
        const relatedApps = await navigator.getInstalledRelatedApps();
        if (relatedApps && relatedApps.length > 0) {
          // PWA is currently installed: stop the notification popup
          setIsInstalled(true);
          setShowPrompt(false);
          localStorage.setItem("safari_pwa_installed", "true");
          return true;
        } else {
          // PWA is NOT installed (or was uninstalled): permit the notification popup to appear again
          setIsInstalled(false);
          localStorage.removeItem("safari_pwa_installed");
          return false;
        }
      } catch (err) {
        console.warn("Notice checking getInstalledRelatedApps:", err);
      }
    }

    // Fallback: If not in standalone mode, check stored flag
    const storedInstalled = localStorage.getItem("safari_pwa_installed") === "true";
    if (storedInstalled) {
      // If stored as installed, mark installed unless beforeinstallprompt fires to disprove it
      setIsInstalled(true);
      setShowPrompt(false);
      return true;
    }

    setIsInstalled(false);
    return false;
  }, []);

  useEffect(() => {
    // Initial verification
    checkInstalledStatus();

    // Re-check when window gains focus (e.g. after uninstalling in OS Settings or Chrome Apps)
    const handleWindowFocus = () => {
      checkInstalledStatus();
    };
    window.addEventListener("focus", handleWindowFocus);

    // Watch for standalone display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleMediaChange = (e) => {
      if (e.matches) {
        setIsInstalled(true);
        setShowPrompt(false);
        localStorage.setItem("safari_pwa_installed", "true");
      } else {
        checkInstalledStatus();
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMediaChange);
    }

    // Standard Android / Chrome / Edge PWA install prompt handler:
    // Chromium ONLY fires 'beforeinstallprompt' if the app is NOT installed (or was uninstalled).
    const handleBeforeInstallPrompt = async (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Verify whether the app is actually installed
      const alreadyInstalled = await checkInstalledStatus();

      // If already installed, stop notification popup completely
      if (alreadyInstalled) {
        setShowPrompt(false);
        return;
      }

      // App is NOT installed (or was uninstalled): clear any stale installed flag and show the popup
      setIsInstalled(false);
      localStorage.removeItem("safari_pwa_installed");

      const isDismissed = sessionStorage.getItem("safari_pwa_dismissed");
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

    if (isIOSSafari) {
      const isStandalone = window.navigator.standalone === true;
      const isDismissed = sessionStorage.getItem("safari_pwa_dismissed");
      if (!isStandalone) {
        setIsIOS(true);
        if (!isDismissed) {
          setShowPrompt(true);
        }
      } else {
        setIsInstalled(true);
        setShowPrompt(false);
      }
    }

    // Listen for successful installation: STOP popup immediately
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.setItem("safari_pwa_installed", "true");
      sessionStorage.removeItem("safari_pwa_dismissed");
      console.log("Safari CSD PWA installed successfully - notification popup stopped.");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMediaChange);
      }
    };
  }, [checkInstalledStatus]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);

    if (outcome === "accepted") {
      setIsInstalled(true);
      setShowPrompt(false);
      localStorage.setItem("safari_pwa_installed", "true");
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("safari_pwa_dismissed", "true");
  };

  // If the app is installed or prompt shouldn't show, render nothing
  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-indigo-500/40 backdrop-blur-lg flex items-start gap-3.5">
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
