/**
 * IP-based Fraud Detection Utility
 * Tracks login IPs, detects new locations, and implements velocity checking
 */

import pool from "./db";

// Configuration constants
export const FRAUD_CONFIG = {
  // Velocity checking - max failed attempts
  MAX_FAILED_ATTEMPTS_PER_IP: 5, // Max failed attempts from same IP in time window
  MAX_FAILED_ATTEMPTS_PER_EMAIL: 10, // Max failed attempts for same email in time window
  VELOCITY_WINDOW_MINUTES: 15, // Time window for velocity checking
  
  // Suspicious activity thresholds
  MAX_LOGINS_PER_HOUR: 20, // Max successful logins from same IP per hour (account sharing detection)
  MAX_DIFFERENT_USERS_PER_IP: 5, // Max different users logging in from same IP per hour
  
  // Blocking durations
  IP_BLOCK_DURATION_MINUTES: 30, // How long to block an IP after too many failed attempts
  
  // New IP detection
  NEW_IP_ALERT_THRESHOLD: 3, // Alert after this many logins from new IPs in 24 hours
};

export type LoginStatus = 'success' | 'failed' | 'blocked' | 'suspicious';

export interface LoginAttempt {
  userId?: string;
  email: string;
  ipAddress: string;
  userAgent?: string;
  status: LoginStatus;
  failureReason?: string;
}

export interface FraudCheckResult {
  allowed: boolean;
  reason?: string;
  isNewIp: boolean;
  shouldFlag: boolean;
  flagReason?: string;
  riskScore: number; // 0-100, higher = more risky
}

export interface VelocityCheckResult {
  blocked: boolean;
  reason?: string;
  failedAttemptsFromIp: number;
  failedAttemptsForEmail: number;
  remainingBlockTime?: number; // seconds until unblocked
}

/**
 * Check if an IP is blocked due to too many failed attempts
 */
export async function checkVelocity(
  ipAddress: string,
  email: string
): Promise<VelocityCheckResult> {
  const windowStart = new Date(
    Date.now() - FRAUD_CONFIG.VELOCITY_WINDOW_MINUTES * 60 * 1000
  );

  // Check failed attempts from this IP
  const ipFailedResult = await pool.query(
    `SELECT COUNT(*) as count, MAX(created_at) as last_attempt
     FROM login_history 
     WHERE ip_address = $1 
       AND status IN ('failed', 'blocked')
       AND created_at > $2`,
    [ipAddress, windowStart]
  );

  const failedAttemptsFromIp = parseInt(ipFailedResult.rows[0].count) || 0;

  // Check failed attempts for this email
  const emailFailedResult = await pool.query(
    `SELECT COUNT(*) as count
     FROM login_history 
     WHERE email = $1 
       AND status IN ('failed', 'blocked')
       AND created_at > $2`,
    [email.toLowerCase(), windowStart]
  );

  const failedAttemptsForEmail = parseInt(emailFailedResult.rows[0].count) || 0;

  // Check if IP should be blocked
  if (failedAttemptsFromIp >= FRAUD_CONFIG.MAX_FAILED_ATTEMPTS_PER_IP) {
    const lastAttempt = new Date(ipFailedResult.rows[0].last_attempt);
    const blockEndTime = new Date(
      lastAttempt.getTime() + FRAUD_CONFIG.IP_BLOCK_DURATION_MINUTES * 60 * 1000
    );
    const remainingBlockTime = Math.max(0, (blockEndTime.getTime() - Date.now()) / 1000);

    if (remainingBlockTime > 0) {
      return {
        blocked: true,
        reason: `Too many failed login attempts. Try again in ${Math.ceil(remainingBlockTime / 60)} minutes.`,
        failedAttemptsFromIp,
        failedAttemptsForEmail,
        remainingBlockTime,
      };
    }
  }

  // Check if email has too many failed attempts
  if (failedAttemptsForEmail >= FRAUD_CONFIG.MAX_FAILED_ATTEMPTS_PER_EMAIL) {
    return {
      blocked: true,
      reason: "Too many failed login attempts for this account. Please try again later or reset your password.",
      failedAttemptsFromIp,
      failedAttemptsForEmail,
    };
  }

  return {
    blocked: false,
    failedAttemptsFromIp,
    failedAttemptsForEmail,
  };
}

/**
 * Check if this is a known IP for the user
 */
export async function isKnownIp(userId: string, ipAddress: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM known_user_ips WHERE user_id = $1 AND ip_address = $2",
    [userId, ipAddress]
  );
  return result.rows.length > 0;
}

/**
 * Get all known IPs for a user
 */
export async function getKnownIps(userId: string): Promise<string[]> {
  const result = await pool.query(
    "SELECT ip_address FROM known_user_ips WHERE user_id = $1",
    [userId]
  );
  return result.rows.map(row => row.ip_address);
}

/**
 * Add or update a known IP for a user
 */
export async function trackKnownIp(userId: string, ipAddress: string): Promise<void> {
  await pool.query(
    `INSERT INTO known_user_ips (user_id, ip_address, first_seen_at, last_seen_at, login_count)
     VALUES ($1, $2, NOW(), NOW(), 1)
     ON CONFLICT (user_id, ip_address) 
     DO UPDATE SET last_seen_at = NOW(), login_count = known_user_ips.login_count + 1`,
    [userId, ipAddress]
  );
}

/**
 * Check for suspicious patterns that should be flagged
 */
export async function checkSuspiciousPatterns(
  userId: string,
  ipAddress: string,
  email: string
): Promise<{ suspicious: boolean; reasons: string[]; riskScore: number }> {
  const reasons: string[] = [];
  let riskScore = 0;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Check: Multiple users from same IP in short time (possible account sharing or attack)
  const multiUserResult = await pool.query(
    `SELECT COUNT(DISTINCT user_id) as user_count
     FROM login_history 
     WHERE ip_address = $1 
       AND status = 'success'
       AND created_at > $2
       AND user_id IS NOT NULL`,
    [ipAddress, oneHourAgo]
  );

  const usersFromIp = parseInt(multiUserResult.rows[0].user_count) || 0;
  if (usersFromIp >= FRAUD_CONFIG.MAX_DIFFERENT_USERS_PER_IP) {
    reasons.push(`Multiple accounts (${usersFromIp}) logged in from same IP in the last hour`);
    riskScore += 30;
  }

  // Check: Too many logins from same IP (possible automated activity)
  const loginCountResult = await pool.query(
    `SELECT COUNT(*) as login_count
     FROM login_history 
     WHERE ip_address = $1 
       AND status = 'success'
       AND created_at > $2`,
    [ipAddress, oneHourAgo]
  );

  const loginsFromIp = parseInt(loginCountResult.rows[0].login_count) || 0;
  if (loginsFromIp >= FRAUD_CONFIG.MAX_LOGINS_PER_HOUR) {
    reasons.push(`Unusually high login frequency (${loginsFromIp}) from this IP`);
    riskScore += 25;
  }

  // Check: Multiple new IPs for same user in 24 hours
  const newIpsResult = await pool.query(
    `SELECT COUNT(*) as new_ip_count
     FROM login_history 
     WHERE user_id = $1 
       AND is_new_ip = TRUE
       AND created_at > $2`,
    [userId, oneDayAgo]
  );

  const newIpCount = parseInt(newIpsResult.rows[0].new_ip_count) || 0;
  if (newIpCount >= FRAUD_CONFIG.NEW_IP_ALERT_THRESHOLD) {
    reasons.push(`Account accessed from ${newIpCount} new IPs in the last 24 hours`);
    riskScore += 35;
  }

  // Check: Login after many failed attempts (possible successful brute force)
  const recentFailuresResult = await pool.query(
    `SELECT COUNT(*) as fail_count
     FROM login_history 
     WHERE email = $1 
       AND status = 'failed'
       AND created_at > $2`,
    [email.toLowerCase(), oneHourAgo]
  );

  const recentFailures = parseInt(recentFailuresResult.rows[0].fail_count) || 0;
  if (recentFailures >= 3) {
    reasons.push(`Login succeeded after ${recentFailures} failed attempts in the last hour`);
    riskScore += 20;
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
    riskScore: Math.min(100, riskScore),
  };
}

/**
 * Perform comprehensive fraud check before allowing login
 */
export async function performFraudCheck(
  userId: string | undefined,
  email: string,
  ipAddress: string
): Promise<FraudCheckResult> {
  // First, check velocity (rate limiting)
  const velocityResult = await checkVelocity(ipAddress, email);
  
  if (velocityResult.blocked) {
    return {
      allowed: false,
      reason: velocityResult.reason,
      isNewIp: false,
      shouldFlag: true,
      flagReason: velocityResult.reason,
      riskScore: 100,
    };
  }

  // If no user ID (user not found), allow but track
  if (!userId) {
    return {
      allowed: true,
      isNewIp: false,
      shouldFlag: false,
      riskScore: 0,
    };
  }

  // Check if this is a new IP for the user
  const isNew = !(await isKnownIp(userId, ipAddress));

  // Check for suspicious patterns
  const suspiciousCheck = await checkSuspiciousPatterns(userId, ipAddress, email);

  return {
    allowed: true,
    isNewIp: isNew,
    shouldFlag: suspiciousCheck.suspicious,
    flagReason: suspiciousCheck.reasons.join("; "),
    riskScore: suspiciousCheck.riskScore + (isNew ? 10 : 0),
  };
}

/**
 * Record a login attempt in the history
 */
export async function recordLoginAttempt(attempt: LoginAttempt & {
  isNewIp?: boolean;
  flagged?: boolean;
  flagReason?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO login_history 
     (user_id, email, ip_address, user_agent, status, failure_reason, is_new_ip, flagged, flag_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      attempt.userId || null,
      attempt.email.toLowerCase(),
      attempt.ipAddress,
      attempt.userAgent || null,
      attempt.status,
      attempt.failureReason || null,
      attempt.isNewIp || false,
      attempt.flagged || false,
      attempt.flagReason || null,
    ]
  );

  // If successful login, track the IP as known
  if (attempt.status === 'success' && attempt.userId) {
    await trackKnownIp(attempt.userId, attempt.ipAddress);
  }
}

/**
 * Get recent login history for a user
 */
export async function getLoginHistory(
  userId: string,
  limit: number = 20
): Promise<Array<{
  id: string;
  ipAddress: string;
  userAgent: string;
  status: LoginStatus;
  isNewIp: boolean;
  createdAt: Date;
}>> {
  const result = await pool.query(
    `SELECT id, ip_address, user_agent, status, is_new_ip, created_at
     FROM login_history 
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    status: row.status as LoginStatus,
    isNewIp: row.is_new_ip,
    createdAt: row.created_at,
  }));
}

/**
 * Get flagged logins for admin review
 */
export async function getFlaggedLogins(
  onlyUnreviewed: boolean = true,
  limit: number = 50
): Promise<Array<{
  id: string;
  userId: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  status: LoginStatus;
  flagReason: string;
  createdAt: Date;
  reviewed: boolean;
}>> {
  const query = onlyUnreviewed
    ? `SELECT lh.*, u.username 
       FROM login_history lh
       LEFT JOIN users u ON lh.user_id = u.id
       WHERE lh.flagged = TRUE AND lh.reviewed = FALSE
       ORDER BY lh.created_at DESC
       LIMIT $1`
    : `SELECT lh.*, u.username 
       FROM login_history lh
       LEFT JOIN users u ON lh.user_id = u.id
       WHERE lh.flagged = TRUE
       ORDER BY lh.created_at DESC
       LIMIT $1`;

  const result = await pool.query(query, [limit]);

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    username: row.username,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    status: row.status as LoginStatus,
    flagReason: row.flag_reason,
    createdAt: row.created_at,
    reviewed: row.reviewed,
  }));
}

/**
 * Mark a flagged login as reviewed
 */
export async function reviewFlaggedLogin(
  loginId: string,
  reviewerId: string
): Promise<void> {
  await pool.query(
    `UPDATE login_history 
     SET reviewed = TRUE, reviewed_by = $1, reviewed_at = NOW()
     WHERE id = $2`,
    [reviewerId, loginId]
  );
}

/**
 * Get fraud statistics for admin dashboard
 */
export async function getFraudStats(): Promise<{
  totalFlaggedToday: number;
  unreviewedCount: number;
  blockedAttemptsToday: number;
  uniqueSuspiciousIps: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [flaggedResult, unreviewedResult, blockedResult, ipsResult] = await Promise.all([
    pool.query(
      "SELECT COUNT(*) as count FROM login_history WHERE flagged = TRUE AND created_at >= $1",
      [today]
    ),
    pool.query(
      "SELECT COUNT(*) as count FROM login_history WHERE flagged = TRUE AND reviewed = FALSE"
    ),
    pool.query(
      "SELECT COUNT(*) as count FROM login_history WHERE status = 'blocked' AND created_at >= $1",
      [today]
    ),
    pool.query(
      "SELECT COUNT(DISTINCT ip_address) as count FROM login_history WHERE flagged = TRUE AND created_at >= $1",
      [today]
    ),
  ]);

  return {
    totalFlaggedToday: parseInt(flaggedResult.rows[0].count) || 0,
    unreviewedCount: parseInt(unreviewedResult.rows[0].count) || 0,
    blockedAttemptsToday: parseInt(blockedResult.rows[0].count) || 0,
    uniqueSuspiciousIps: parseInt(ipsResult.rows[0].count) || 0,
  };
}
