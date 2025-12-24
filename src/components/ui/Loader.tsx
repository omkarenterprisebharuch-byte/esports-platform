"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface LoaderContextType {
  isLoading: boolean;
  showLoader: () => void;
  hideLoader: () => void;
  setLoading: (loading: boolean) => void;
}

const LoaderContext = createContext<LoaderContextType | undefined>(undefined);

/**
 * Animated blob loader with full-screen overlay
 * Disables all background controls when active
 */
export function Loader({ message }: { message?: string } = {}) {
  return (
    <div className="loader-overlay">
      <div className="loader-content">
        <div className="blob" />
        {message && <p className="loader-message">{message}</p>}
      </div>
      
      <style jsx>{`
        .loader-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }

        .loader-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .loader-message {
          color: #374151;
          font-size: 14px;
          font-weight: 500;
          text-align: center;
          animation: fade-pulse 1.5s ease-in-out infinite;
        }

        @keyframes fade-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        .blob {
          width: 112px;
          height: 112px;
          display: grid;
          background: #fff;
          filter: blur(5.6px) contrast(10);
          padding: 11.2px;
          mix-blend-mode: darken;
          border-radius: 8px;
        }

        .blob::before,
        .blob::after {
          content: "";
          grid-area: 1/1;
          width: 44.8px;
          height: 44.8px;
          background: #111827;
          border-radius: 4px;
          animation: blob-move 2s infinite;
        }

        .blob::after {
          animation-delay: -1s;
        }

        @keyframes blob-move {
          0% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(100%, 0);
          }
          50% {
            transform: translate(100%, 100%);
          }
          75% {
            transform: translate(0, 100%);
          }
          100% {
            transform: translate(0, 0);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Provider for global loading state
 */
export function LoaderProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const showLoader = useCallback(() => setIsLoading(true), []);
  const hideLoader = useCallback(() => setIsLoading(false), []);
  const setLoading = useCallback((loading: boolean) => setIsLoading(loading), []);

  return (
    <LoaderContext.Provider value={{ isLoading, showLoader, hideLoader, setLoading }}>
      {children}
      {isLoading && <Loader />}
    </LoaderContext.Provider>
  );
}

/**
 * Hook to control global loader
 */
export function useLoader() {
  const context = useContext(LoaderContext);
  if (!context) {
    throw new Error("useLoader must be used within LoaderProvider");
  }
  return context;
}

/**
 * Inline loader for page-level loading states
 * Use this when you don't want to block the entire screen
 */
export function PageLoader() {
  return (
    <div className="page-loader">
      <div className="blob-small" />
      
      <style jsx>{`
        .page-loader {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          width: 100%;
        }

        .blob-small {
          width: 80px;
          height: 80px;
          display: grid;
          background: #fff;
          filter: blur(4px) contrast(10);
          padding: 8px;
          mix-blend-mode: darken;
          border-radius: 6px;
        }

        .blob-small::before,
        .blob-small::after {
          content: "";
          grid-area: 1/1;
          width: 32px;
          height: 32px;
          background: #111827;
          border-radius: 3px;
          animation: blob-move 2s infinite;
        }

        .blob-small::after {
          animation-delay: -1s;
        }

        @keyframes blob-move {
          0% { transform: translate(0, 0); }
          25% { transform: translate(100%, 0); }
          50% { transform: translate(100%, 100%); }
          75% { transform: translate(0, 100%); }
          100% { transform: translate(0, 0); }
        }
      `}</style>
    </div>
  );
}

/**
 * Navigation loader that shows during page transitions
 * Automatically shows loader when navigating between pages
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);

  useEffect(() => {
    const currentPath = pathname + searchParams.toString();
    const previousPath = prevPath + searchParams.toString();
    
    // Path changed - navigation completed
    if (currentPath !== previousPath) {
      setPrevPath(pathname);
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, prevPath]);

  // Listen for link clicks to show loader immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (link) {
        const href = link.getAttribute('href');
        // Only show loader for internal navigation (not external links or hash links)
        if (href && 
            href.startsWith('/') && 
            !href.startsWith('//') && 
            href !== pathname &&
            !link.getAttribute('target') &&
            !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          setIsNavigating(true);
        }
      }
    };

    // Listen for programmatic navigation via buttons that trigger router.push
    const handleBeforeUnload = () => {
      setIsNavigating(true);
    };

    document.addEventListener('click', handleClick);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname]);

  if (!isNavigating) return null;

  return <Loader message="Loading..." />;
}
