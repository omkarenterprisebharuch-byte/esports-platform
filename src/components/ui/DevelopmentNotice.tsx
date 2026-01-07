'use client';

import { useState, useEffect, useCallback } from 'react';

// SVG Icons as components (no external dependencies)
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const AlertTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ConstructionIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

interface DevelopmentNoticeProps {
  /** Auto-dismiss duration in milliseconds (default: 5000ms) */
  autoDismissDelay?: number;
  /** Custom message to display */
  message?: string;
  /** Position of the notice */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  /** Whether to show the notice */
  enabled?: boolean;
}

export function DevelopmentNotice({
  autoDismissDelay = 5000,
  message = "This website is currently under development. You may experience changes and potential bugs as we continue to improve. Thank you for your patience!",
  position = 'bottom-right',
  enabled = true,
}: DevelopmentNoticeProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Handle dismiss with exit animation
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsVisible(false);
    }, 300);
  }, []);

  // Auto-dismiss after specified delay
  useEffect(() => {
    if (!enabled || !isVisible || isExiting) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, autoDismissDelay);

    return () => clearTimeout(timer);
  }, [enabled, isVisible, isExiting, autoDismissDelay, handleDismiss]);

  // Don't render if not enabled or not visible
  if (!enabled || !isVisible) return null;

  // Position classes mapping
  const positionClasses: Record<string, string> = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={`
        fixed z-[9999] max-w-sm w-full mx-4 sm:mx-0
        ${positionClasses[position]}
        transition-all duration-300 ease-in-out
        ${isExiting ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="relative overflow-hidden rounded-lg shadow-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/95 via-amber-900/95 to-orange-900/95 backdrop-blur-sm">
        {/* Animated gradient border effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 animate-pulse" />
        
        {/* Progress bar for auto-dismiss */}
        <div 
          className="absolute top-0 left-0 h-1 bg-gradient-to-r from-yellow-400 to-orange-500"
          style={{
            animation: `shrink ${autoDismissDelay}ms linear forwards`,
          }}
        />
        
        <div className="relative p-4">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-white/10 transition-colors duration-200 group"
            aria-label="Dismiss notice"
          >
            <XIcon className="w-4 h-4 text-yellow-300/70 group-hover:text-yellow-200 transition-colors" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            {/* Icon */}
            <div className="flex-shrink-0 p-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
              <ConstructionIcon className="w-5 h-5 text-yellow-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangleIcon className="w-4 h-4 text-yellow-400" />
                <h3 className="font-semibold text-yellow-200 text-sm">
                  Under Development
                </h3>
              </div>
              <p className="text-yellow-100/80 text-xs leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          {/* Footer with version/date info (optional, flexible for updates) */}
          <div className="mt-3 pt-2 border-t border-yellow-500/20 flex items-center justify-between text-xs text-yellow-300/50">
            <span>Beta Version</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Active Development
            </span>
          </div>
        </div>
      </div>

      {/* CSS for progress bar animation */}
      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

export default DevelopmentNotice;
