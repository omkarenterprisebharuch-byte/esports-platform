/**
 * Device Detection Utility
 * Parses user-agent strings to identify devices and detect new logins
 */

export interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  fingerprint: string; // Unique identifier for the device+browser combo
}

/**
 * Parse user agent string to extract device information
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();
  
  // Detect device type
  let deviceType: DeviceInfo['deviceType'] = 'unknown';
  if (/mobile|android.*mobile|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad|android(?!.*mobile)|kindle|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/windows|macintosh|linux|cros/i.test(ua)) {
    deviceType = 'desktop';
  }

  // Detect browser
  let browser = 'Unknown';
  let browserVersion = '';
  
  if (/edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
    browserVersion = extractVersion(ua, /edg\/(\d+(\.\d+)?)/i);
  } else if (/chrome/i.test(ua) && !/chromium|edg/i.test(ua)) {
    browser = 'Google Chrome';
    browserVersion = extractVersion(ua, /chrome\/(\d+(\.\d+)?)/i);
  } else if (/firefox/i.test(ua)) {
    browser = 'Mozilla Firefox';
    browserVersion = extractVersion(ua, /firefox\/(\d+(\.\d+)?)/i);
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = 'Safari';
    browserVersion = extractVersion(ua, /version\/(\d+(\.\d+)?)/i);
  } else if (/opera|opr\//i.test(ua)) {
    browser = 'Opera';
    browserVersion = extractVersion(ua, /(?:opera|opr)\/(\d+(\.\d+)?)/i);
  } else if (/msie|trident/i.test(ua)) {
    browser = 'Internet Explorer';
    browserVersion = extractVersion(ua, /(?:msie |rv:)(\d+(\.\d+)?)/i);
  }

  // Detect OS
  let os = 'Unknown';
  let osVersion = '';
  
  if (/windows nt/i.test(ua)) {
    os = 'Windows';
    const ntVersion = extractVersion(ua, /windows nt (\d+\.\d+)/i);
    osVersion = mapWindowsVersion(ntVersion);
  } else if (/mac os x/i.test(ua)) {
    os = 'macOS';
    osVersion = extractVersion(ua, /mac os x (\d+[._]\d+)/i).replace('_', '.');
  } else if (/android/i.test(ua)) {
    os = 'Android';
    osVersion = extractVersion(ua, /android (\d+(\.\d+)?)/i);
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
    osVersion = extractVersion(ua, /os (\d+[._]\d+)/i).replace('_', '.');
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  } else if (/cros/i.test(ua)) {
    os = 'Chrome OS';
  }

  // Create fingerprint (combination of device type, OS, and browser)
  const fingerprint = `${deviceType}:${os}:${browser}`.toLowerCase().replace(/\s+/g, '-');

  return {
    deviceType,
    browser,
    browserVersion,
    os,
    osVersion,
    fingerprint,
  };
}

/**
 * Extract version number from user agent string
 */
function extractVersion(ua: string, pattern: RegExp): string {
  const match = ua.match(pattern);
  return match ? match[1] : '';
}

/**
 * Map Windows NT version to marketing name
 */
function mapWindowsVersion(ntVersion: string): string {
  const versionMap: Record<string, string> = {
    '10.0': '10/11',
    '6.3': '8.1',
    '6.2': '8',
    '6.1': '7',
    '6.0': 'Vista',
    '5.1': 'XP',
  };
  return versionMap[ntVersion] || ntVersion;
}

/**
 * Format device info for display
 */
export function formatDeviceInfo(device: DeviceInfo): string {
  let parts = [];
  
  if (device.browser !== 'Unknown') {
    parts.push(`${device.browser}${device.browserVersion ? ' ' + device.browserVersion : ''}`);
  }
  
  if (device.os !== 'Unknown') {
    parts.push(`${device.os}${device.osVersion ? ' ' + device.osVersion : ''}`);
  }
  
  if (device.deviceType !== 'unknown') {
    parts.push(device.deviceType.charAt(0).toUpperCase() + device.deviceType.slice(1));
  }
  
  return parts.join(' on ') || 'Unknown device';
}

/**
 * Get a friendly device name for display
 */
export function getDeviceName(device: DeviceInfo): string {
  const deviceEmoji = {
    desktop: '💻',
    mobile: '📱',
    tablet: '📱',
    unknown: '🖥️',
  };
  
  return `${deviceEmoji[device.deviceType]} ${device.browser} on ${device.os}`;
}

/**
 * Check if two device fingerprints match (same device type, OS, and browser)
 */
export function isSameDevice(fingerprint1: string, fingerprint2: string): boolean {
  return fingerprint1 === fingerprint2;
}

/**
 * Check if a fingerprint exists in a list of known devices
 */
export function isKnownDevice(fingerprint: string, knownFingerprints: string[]): boolean {
  return knownFingerprints.includes(fingerprint);
}
