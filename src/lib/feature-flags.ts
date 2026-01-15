/**
 * Feature Flags System
 * 
 * Provides runtime feature toggles for:
 * - Gradual rollouts (percentage-based)
 * - A/B testing
 * - Environment-specific features
 * - User-specific overrides
 * 
 * Usage:
 *   import { isFeatureEnabled, useFeatureFlag } from '@/lib/feature-flags';
 *   
 *   // Server-side
 *   if (isFeatureEnabled('NEW_CHECKOUT')) { ... }
 *   
 *   // Client-side (hook)
 *   const isEnabled = useFeatureFlag('NEW_CHECKOUT');
 */

export type FeatureFlagName =
  | 'NEW_REGISTRATION_FLOW'
  | 'ENHANCED_LEADERBOARD'
  | 'CHAT_FEATURE'
  | 'TOURNAMENT_BRACKETS'
  | 'WALLET_V2'
  | 'DARK_MODE_V2'
  | 'PUSH_NOTIFICATIONS'
  | 'SOCIAL_LOGIN'
  | 'TWO_FACTOR_AUTH'
  | 'BETA_FEATURES';

interface FeatureFlag {
  name: FeatureFlagName;
  description: string;
  /** Whether the flag is enabled by default */
  defaultEnabled: boolean;
  /** Percentage of users to enable for (0-100) */
  rolloutPercentage?: number;
  /** Environment overrides */
  environments?: {
    development?: boolean;
    production?: boolean;
    test?: boolean;
  };
  /** Specific user IDs that should have this enabled */
  enabledForUsers?: string[];
  /** Specific user roles that should have this enabled */
  enabledForRoles?: string[];
  /** Start date for the feature (ISO string) */
  startDate?: string;
  /** End date for the feature (ISO string) */
  endDate?: string;
}

// Feature flag configuration
const FEATURE_FLAGS: Record<FeatureFlagName, FeatureFlag> = {
  NEW_REGISTRATION_FLOW: {
    name: 'NEW_REGISTRATION_FLOW',
    description: 'New streamlined tournament registration flow',
    defaultEnabled: false,
    rolloutPercentage: 0,
    environments: {
      development: true,
      production: false,
    },
  },
  ENHANCED_LEADERBOARD: {
    name: 'ENHANCED_LEADERBOARD',
    description: 'Enhanced leaderboard with animations and stats',
    defaultEnabled: true,
    environments: {
      development: true,
      production: true,
    },
  },
  CHAT_FEATURE: {
    name: 'CHAT_FEATURE',
    description: 'In-tournament chat functionality',
    defaultEnabled: true,
    environments: {
      development: true,
      production: true,
    },
  },
  TOURNAMENT_BRACKETS: {
    name: 'TOURNAMENT_BRACKETS',
    description: 'Visual tournament bracket display',
    defaultEnabled: false,
    rolloutPercentage: 0,
    environments: {
      development: true,
      production: false,
    },
  },
  WALLET_V2: {
    name: 'WALLET_V2',
    description: 'New wallet interface with transaction history',
    defaultEnabled: false,
    rolloutPercentage: 0,
    environments: {
      development: true,
      production: false,
    },
  },
  DARK_MODE_V2: {
    name: 'DARK_MODE_V2',
    description: 'Improved dark mode with better contrast',
    defaultEnabled: true,
    environments: {
      development: true,
      production: true,
    },
  },
  PUSH_NOTIFICATIONS: {
    name: 'PUSH_NOTIFICATIONS',
    description: 'Web push notifications for tournaments',
    defaultEnabled: true,
    environments: {
      development: true,
      production: true,
    },
  },
  SOCIAL_LOGIN: {
    name: 'SOCIAL_LOGIN',
    description: 'Login with Google/Discord',
    defaultEnabled: false,
    rolloutPercentage: 0,
    environments: {
      development: true,
      production: false,
    },
  },
  TWO_FACTOR_AUTH: {
    name: 'TWO_FACTOR_AUTH',
    description: 'Two-factor authentication support',
    defaultEnabled: false,
    rolloutPercentage: 0,
    environments: {
      development: true,
      production: false,
    },
  },
  BETA_FEATURES: {
    name: 'BETA_FEATURES',
    description: 'Enable all beta features for testing',
    defaultEnabled: false,
    enabledForRoles: ['owner', 'admin'],
    environments: {
      development: true,
      production: false,
    },
  },
};

/**
 * Get current environment
 */
function getCurrentEnvironment(): 'development' | 'production' | 'test' {
  if (process.env.NODE_ENV === 'test') return 'test';
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
}

/**
 * Generate a consistent hash for a user ID (for percentage rollouts)
 */
function hashUserId(userId: string, flagName: string): number {
  const str = `${userId}-${flagName}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Check if a date is within a feature's active window
 */
function isWithinDateRange(flag: FeatureFlag): boolean {
  const now = new Date();
  
  if (flag.startDate && new Date(flag.startDate) > now) {
    return false;
  }
  
  if (flag.endDate && new Date(flag.endDate) < now) {
    return false;
  }
  
  return true;
}

interface FeatureFlagContext {
  userId?: string;
  userRole?: string;
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(
  flagName: FeatureFlagName,
  context?: FeatureFlagContext
): boolean {
  const flag = FEATURE_FLAGS[flagName];
  
  if (!flag) {
    console.warn(`Unknown feature flag: ${flagName}`);
    return false;
  }
  
  // Check environment override first
  const env = getCurrentEnvironment();
  if (flag.environments && flag.environments[env] !== undefined) {
    // If environment explicitly sets to false, return false
    if (flag.environments[env] === false) {
      return false;
    }
  }
  
  // Check date range
  if (!isWithinDateRange(flag)) {
    return false;
  }
  
  // Check if user is in enabled users list
  if (context?.userId && flag.enabledForUsers?.includes(context.userId)) {
    return true;
  }
  
  // Check if user role is in enabled roles list
  if (context?.userRole && flag.enabledForRoles?.includes(context.userRole)) {
    return true;
  }
  
  // Check percentage rollout for authenticated users
  if (context?.userId && flag.rolloutPercentage !== undefined) {
    const userHash = hashUserId(context.userId, flagName);
    if (userHash < flag.rolloutPercentage) {
      return true;
    }
  }
  
  // Check environment override for true
  if (flag.environments && flag.environments[env] === true) {
    return true;
  }
  
  // Fall back to default
  return flag.defaultEnabled;
}

/**
 * Get all feature flags and their current status
 */
export function getAllFeatureFlags(context?: FeatureFlagContext): Record<FeatureFlagName, boolean> {
  const flags = {} as Record<FeatureFlagName, boolean>;
  
  for (const flagName of Object.keys(FEATURE_FLAGS) as FeatureFlagName[]) {
    flags[flagName] = isFeatureEnabled(flagName, context);
  }
  
  return flags;
}

/**
 * Get feature flag configuration (for admin UI)
 */
export function getFeatureFlagConfig(flagName: FeatureFlagName): FeatureFlag | undefined {
  return FEATURE_FLAGS[flagName];
}

/**
 * Get all feature flag configurations (for admin UI)
 */
export function getAllFeatureFlagConfigs(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS);
}

// Export types
export type { FeatureFlag, FeatureFlagContext };
