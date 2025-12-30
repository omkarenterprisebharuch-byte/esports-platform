"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isStandalone: boolean;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<PWAInstallState>({
    isInstallable: false,
    isInstalled: false,
    isIOS: false,
    isStandalone: false,
  });

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isStandalone = 
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    setState((prev) => ({
      ...prev,
      isStandalone,
      isIOS,
      isInstalled: isStandalone,
    }));

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setState((prev) => ({ ...prev, isInstallable: true }));
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setState((prev) => ({
        ...prev,
        isInstallable: false,
        isInstalled: true,
      }));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      if (outcome === "accepted") {
        setInstallPrompt(null);
        setState((prev) => ({ ...prev, isInstallable: false, isInstalled: true }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Install prompt error:", error);
      return false;
    }
  }, [installPrompt]);

  return {
    ...state,
    promptInstall,
  };
}

interface InstallPromptProps {
  className?: string;
}

export default function InstallPrompt({ className = "" }: InstallPromptProps) {
  const { isInstallable, isIOS, isInstalled, isStandalone, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if user dismissed the prompt before
    const wasDismissed = localStorage.getItem("pwa-install-dismissed");
    if (wasDismissed) {
      const dismissedAt = parseInt(wasDismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (!installed) {
      // User declined, dismiss for a while
      handleDismiss();
    }
  };

  // Don't show if already installed, in standalone mode, or dismissed
  if (isInstalled || isStandalone || dismissed) {
    return null;
  }

  // Show iOS-specific guide
  if (isIOS) {
    return (
      <>
        <div
          className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 
                     bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 
                     dark:border-gray-700 p-4 z-50 ${className}`}
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl 
                           flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🎮</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Install Esports Platform
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Add to your home screen for the best experience
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShowIOSGuide(true)}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium 
                           rounded-lg hover:bg-indigo-700 transition"
                >
                  How to Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs 
                           hover:text-gray-700 dark:hover:text-gray-300 transition"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* iOS Install Guide Modal */}
        {showIOSGuide && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl md:rounded-2xl w-full max-w-md p-6 animate-slide-up">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">
                Install on iOS
              </h3>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 
                                 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    1
                  </span>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Tap the <strong>Share</strong> button{" "}
                    <svg className="w-5 h-5 inline text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>{" "}
                    at the bottom of Safari
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 
                                 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    2
                  </span>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Scroll down and tap <strong>Add to Home Screen</strong>
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 
                                 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    3
                  </span>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Tap <strong>Add</strong> in the top right corner
                  </p>
                </li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full mt-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 
                         font-semibold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Show installable prompt for Android/Desktop
  if (!isInstallable) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 
                 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 
                 dark:border-gray-700 p-4 z-50 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl 
                       flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🎮</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
            Install Esports Platform
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Install our app for faster access and offline support
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium 
                       rounded-lg hover:bg-indigo-700 transition"
            >
              Install Now
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs 
                       hover:text-gray-700 dark:hover:text-gray-300 transition"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
