"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { LoaderProvider, Loader } from "@/components/ui/Loader";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { clearRegistrationCache, useIdleTimeout, clearSessionData } from "@/hooks";
import { api, logout, isAuthenticated, isLogoutInProgress, setLogoutInProgress } from "@/lib/api-client";
import { OwnerSidebar } from "@/components/owner/OwnerSidebar";
import { AppHeader } from "@/components/app/AppHeader";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import Footer from "@/components/ui/Footer";

// Lazy load notification prompt
const NotificationPrompt = dynamic(
  () => import("@/components/notifications/NotificationPrompt"),
  { ssr: false, loading: () => null }
);

interface User {
  id: number;
  username: string;
  email: string;
  is_host: boolean;
  is_admin?: boolean;
  role?: "player" | "organizer" | "owner";
  avatar_url?: string;
}

// Module-level cache for owner user data
let cachedOwnerUser: User | null = null;
let ownerCacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Owner Panel Layout
 * 
 * This layout:
 * - Requires OWNER role ONLY
 * - Uses OwnerSidebar 
 * - Provides owner-specific styling (purple theme)
 */
export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(cachedOwnerUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!cachedOwnerUser);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const router = useRouter();
  const fetchedRef = useRef(false);

  // Idle timeout
  useIdleTimeout({
    enabled: !!user,
    timeout: 30 * 60 * 1000,
    warningTime: 2 * 60 * 1000,
    onWarning: () => setShowIdleWarning(true),
    onIdle: () => {
      cachedOwnerUser = null;
      ownerCacheTimestamp = 0;
    },
  });

  const fetchUserData = useCallback(async (forceRefresh = false) => {
    if (isLogoutInProgress()) {
      setInitialLoading(false);
      return;
    }
    
    if (!isAuthenticated()) {
      setInitialLoading(false);
      router.push("/login?redirect=/owner&reason=protected");
      return;
    }

    const now = Date.now();
    if (!forceRefresh && cachedOwnerUser && (now - ownerCacheTimestamp) < CACHE_DURATION) {
      setUser(cachedOwnerUser);
      setInitialLoading(false);
      return;
    }

    try {
      const userData = await api<User>("/api/auth/me");

      if (userData.success && userData.data) {
        // STRICT: Only owner role can access
        if (userData.data.role !== "owner") {
          // Not authorized - redirect to app or admin
          const isAdmin = userData.data.is_host || 
                         userData.data.is_admin || 
                         userData.data.role === "organizer";
          router.push(isAdmin ? "/admin" : "/app");
          return;
        }
        
        cachedOwnerUser = userData.data;
        ownerCacheTimestamp = Date.now();
        setUser(userData.data);
      } else {
        if (!isLogoutInProgress()) {
          cachedOwnerUser = null;
          router.push("/login?redirect=/owner&reason=protected");
        }
        return;
      }
    } catch {
      if (!isLogoutInProgress()) {
        cachedOwnerUser = null;
        router.push("/login?redirect=/owner&reason=protected");
      }
    } finally {
      setInitialLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (fetchedRef.current) {
      if (cachedOwnerUser) {
        // Re-verify owner status
        if (cachedOwnerUser.role !== "owner") {
          router.push("/app");
          return;
        }
        setInitialLoading(false);
        setUser(cachedOwnerUser);
      } else {
        setInitialLoading(false);
      }
      return;
    }
    fetchedRef.current = true;
    
    const safetyTimeout = setTimeout(() => {
      if (initialLoading && !isLogoutInProgress()) {
        console.warn("Owner loading timeout - redirecting to login");
        setInitialLoading(false);
        router.push("/login");
      }
    }, 10000);
    
    fetchUserData().finally(() => clearTimeout(safetyTimeout));
    
    return () => clearTimeout(safetyTimeout);
  }, [fetchUserData, initialLoading, router]);

  const handleLogout = async () => {
    setLogoutInProgress(true);
    cachedOwnerUser = null;
    ownerCacheTimestamp = 0;
    clearSessionData();
    await clearRegistrationCache();
    await logout();
  };

  const dismissIdleWarning = () => setShowIdleWarning(false);

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Loader message="Loading owner portal..." />
      </div>
    );
  }

  // Not authorized or redirect in progress
  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <LoaderProvider>
        <OwnerLayoutContent 
          user={user}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          handleLogout={handleLogout}
          showIdleWarning={showIdleWarning}
          dismissIdleWarning={dismissIdleWarning}
        >
          {children}
        </OwnerLayoutContent>
      </LoaderProvider>
    </SidebarProvider>
  );
}

function OwnerLayoutContent({ 
  user, 
  sidebarOpen, 
  setSidebarOpen, 
  handleLogout,
  showIdleWarning,
  dismissIdleWarning,
  children 
}: {
  user: User;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  handleLogout: () => void;
  showIdleWarning: boolean;
  dismissIdleWarning: () => void;
  children: React.ReactNode;
}) {
  const { isCollapsed } = useSidebar();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Owner Sidebar */}
      <OwnerSidebar 
        user={user} 
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Header */}
      <AppHeader 
        user={user}
        onMenuClick={() => setSidebarOpen(true)}
      />

      {/* Main Content */}
      <main className={`lg:pt-16 min-h-screen transition-all duration-300 ${isCollapsed ? "lg:ml-20" : "lg:ml-72"}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <ErrorBoundary>
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
              </div>
            }>
              {children}
            </Suspense>
          </ErrorBoundary>
        </div>
        <Footer />
      </main>

      {/* Notification Prompt */}
      <NotificationPrompt showOnDenied />
      
      {/* Idle Warning Modal */}
      {showIdleWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={dismissIdleWarning}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Session Expiring Soon
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You&apos;ve been inactive for a while. Your session will expire in 2 minutes.
              </p>
              <button
                onClick={dismissIdleWarning}
                className="w-full py-3 px-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition"
              >
                I&apos;m Still Here
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
