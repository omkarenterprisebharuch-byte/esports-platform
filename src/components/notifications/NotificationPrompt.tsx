"use client";

import React, { useState, useEffect } from "react";
import {
  isPushSupported,
  getPermissionStatus,
  enablePushNotifications,
  registerServiceWorker,
  hasActiveSubscription,
} from "@/lib/push-notifications";

interface NotificationPromptProps {
  onClose?: () => void;
  showOnDenied?: boolean;
}

export default function NotificationPrompt({ onClose, showOnDenied = false }: NotificationPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    initializePrompt();
  }, []);

  const initializePrompt = async () => {
    // Check if push is supported
    if (!isPushSupported()) {
      return;
    }

    // Register service worker
    await registerServiceWorker();

    const status = getPermissionStatus();

    // If already granted, check subscription
    if (status === "granted") {
      const hasSubscription = await hasActiveSubscription();
      if (hasSubscription) {
        return;
      }
      // Permission granted but no subscription
      setIsVisible(true);
      return;
    }

    // If denied, show with different message
    if (status === "denied") {
      setIsDenied(true);
      setIsVisible(true);
      return;
    }

    // If never asked, show after delay
    if (status === "default") {
      setTimeout(() => setIsVisible(true), 2000);
    }
  };

  const handleEnable = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await enablePushNotifications();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          setIsVisible(false);
          onClose?.();
        }, 2000);
      } else if (result.isLocalHostIssue) {
        // Localhost limitation - dismiss gracefully
        setIsVisible(false);
        onClose?.();
      } else {
        setError(result.error || "Failed to enable notifications");
      }
    } catch (err) {
      console.error("Failed to enable push notifications:", err);
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("notification_prompt_dismissed", Date.now().toString());
    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-5 max-w-sm">
        {success ? (
          <div className="text-center py-2">
            <div className="text-4xl mb-2">✅</div>
            <p className="font-semibold text-gray-900 dark:text-white">
              Notifications Enabled!
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You&apos;ll receive important updates
            </p>
          </div>
        ) : isDenied ? (
          <div>
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">🔕</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Notifications Blocked
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  To receive updates, enable notifications in your browser settings:
                </p>
              </div>
            </div>
            <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-9 mb-4 list-decimal">
              <li>Click the lock icon in the address bar</li>
              <li>Find &quot;Notifications&quot; setting</li>
              <li>Change from &quot;Block&quot; to &quot;Allow&quot;</li>
              <li>Refresh the page</li>
            </ol>
            <div className="flex justify-end">
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Got it
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-3 mb-3">
              <div className="text-2xl">🔔</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Stay Updated!
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get instant notifications for:
                </p>
              </div>
            </div>

            <ul className="space-y-2 mb-4 ml-9">
              <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-green-500">✓</span>
                Room ID &amp; Password when published
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-green-500">✓</span>
                Tournament start reminders
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-green-500">✓</span>
                Important announcements
              </li>
            </ul>

            {error && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleDismiss}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
              >
                Maybe Later
              </button>
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Enabling...
                  </>
                ) : (
                  "Enable"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
