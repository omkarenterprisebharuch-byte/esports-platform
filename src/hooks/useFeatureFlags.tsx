'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import type { FeatureFlagName, FeatureFlagContext } from '@/lib/feature-flags';

interface FeatureFlagsContextValue {
  flags: Record<string, boolean>;
  isEnabled: (flagName: FeatureFlagName) => boolean;
  isLoading: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: {},
  isEnabled: () => false,
  isLoading: true,
});

interface FeatureFlagsProviderProps {
  children: ReactNode;
  userId?: string;
  userRole?: string;
  /** Initial flags from server-side rendering */
  initialFlags?: Record<string, boolean>;
}

export function FeatureFlagsProvider({
  children,
  userId,
  userRole,
  initialFlags = {},
}: FeatureFlagsProviderProps) {
  const [flags, setFlags] = useState<Record<string, boolean>>(initialFlags);
  const [isLoading, setIsLoading] = useState(Object.keys(initialFlags).length === 0);

  useEffect(() => {
    // If we have initial flags from SSR, no need to fetch
    if (Object.keys(initialFlags).length > 0) {
      setIsLoading(false);
      return;
    }

    // Fetch feature flags from API (for dynamic flags)
    async function fetchFlags() {
      try {
        const params = new URLSearchParams();
        if (userId) params.set('userId', userId);
        if (userRole) params.set('userRole', userRole);

        // For now, use client-side evaluation
        // In the future, this could fetch from an API for dynamic flags
        const { getAllFeatureFlags } = await import('@/lib/feature-flags');
        const context: FeatureFlagContext = { userId, userRole };
        const allFlags = getAllFeatureFlags(context);
        setFlags(allFlags);
      } catch (error) {
        console.error('Failed to fetch feature flags:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFlags();
  }, [userId, userRole, initialFlags]);

  const isEnabled = (flagName: FeatureFlagName): boolean => {
    return flags[flagName] ?? false;
  };

  return (
    <FeatureFlagsContext.Provider value={{ flags, isEnabled, isLoading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Hook to check if a feature flag is enabled
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  const { isEnabled } = useContext(FeatureFlagsContext);
  return isEnabled(flagName);
}

/**
 * Hook to get all feature flags
 */
export function useFeatureFlags(): FeatureFlagsContextValue {
  return useContext(FeatureFlagsContext);
}

/**
 * Component to conditionally render based on feature flag
 */
export function Feature({
  flag,
  children,
  fallback = null,
}: {
  flag: FeatureFlagName;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const isEnabled = useFeatureFlag(flag);
  
  if (isEnabled) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}

/**
 * Component to render only when feature is disabled
 */
export function FeatureOff({
  flag,
  children,
}: {
  flag: FeatureFlagName;
  children: ReactNode;
}) {
  const isEnabled = useFeatureFlag(flag);
  
  if (!isEnabled) {
    return <>{children}</>;
  }
  
  return null;
}
