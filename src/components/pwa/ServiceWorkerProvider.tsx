"use client";

import { useEffect, useState, useCallback } from "react";

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isOnline: true,
    registration: null,
    updateAvailable: false,
  });

  useEffect(() => {
    const isSupported = "serviceWorker" in navigator;
    const isOnline = navigator.onLine;

    setState((prev) => ({ ...prev, isSupported, isOnline }));

    if (!isSupported) return;

    // Register service worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        console.log("[PWA] Service Worker registered:", registration.scope);

        setState((prev) => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[PWA] New content available");
                setState((prev) => ({ ...prev, updateAvailable: true }));
              }
            });
          }
        });

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour

      } catch (error) {
        console.error("[PWA] Service Worker registration failed:", error);
      }
    };

    registerSW();

    // Handle online/offline events
    const handleOnline = () => setState((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Handle controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[PWA] New service worker activated");
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Skip waiting and activate new service worker
  const updateServiceWorker = useCallback(() => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: "SKIP_WAITING" });
      setState((prev) => ({ ...prev, updateAvailable: false }));
      window.location.reload();
    }
  }, [state.registration]);

  // Clear cache
  const clearCache = useCallback(async () => {
    if (state.registration?.active) {
      state.registration.active.postMessage({ type: "CLEAR_CACHE" });
    }
  }, [state.registration]);

  return {
    ...state,
    updateServiceWorker,
    clearCache,
  };
}

// Component to show update available notification
export function UpdateNotification() {
  const { updateAvailable, updateServiceWorker } = useServiceWorker();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 
                   bg-indigo-600 text-white rounded-xl shadow-lg p-4 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Update Available</p>
          <p className="text-xs text-indigo-200">
            A new version is ready to install
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={updateServiceWorker}
          className="flex-1 py-2 bg-white text-indigo-600 text-sm font-medium 
                   rounded-lg hover:bg-indigo-50 transition"
        >
          Update Now
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="px-4 py-2 text-indigo-200 text-sm hover:text-white transition"
        >
          Later
        </button>
      </div>
    </div>
  );
}

// Offline indicator component
export function OfflineIndicator() {
  const { isOnline } = useServiceWorker();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show indicator when going offline
    if (!isOnline) {
      setShow(true);
    } else {
      // Hide after a delay when coming back online
      const timeout = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline]);

  if (!show) return null;

  return (
    <div
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full 
                 text-sm font-medium shadow-lg transition-all duration-300
                 ${isOnline 
                   ? "bg-green-500 text-white" 
                   : "bg-gray-800 text-white"
                 }`}
    >
      {isOnline ? (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Back online
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          You are offline
        </span>
      )}
    </div>
  );
}

// Background sync utility
export async function queueBackgroundSync(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
) {
  if (!("serviceWorker" in navigator) || !("sync" in ServiceWorkerRegistration.prototype)) {
    console.warn("[PWA] Background sync not supported");
    return false;
  }

  try {
    // Store request in IndexedDB
    const db = await openSyncDB();
    const tx = db.transaction("pending-requests", "readwrite");
    await tx.objectStore("pending-requests").add({
      url,
      method,
      headers,
      body,
      timestamp: Date.now(),
    });

    // Request background sync
    const registration = await navigator.serviceWorker.ready;
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
      .sync.register("esports-sync-queue");

    console.log("[PWA] Request queued for background sync");
    return true;
  } catch (error) {
    console.error("[PWA] Failed to queue background sync:", error);
    return false;
  }
}

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("esports-sync-db", 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("pending-requests")) {
        db.createObjectStore("pending-requests", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
