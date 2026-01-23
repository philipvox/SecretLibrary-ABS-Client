/**
 * src/core/services/serverVersionService.ts
 *
 * Server version compatibility service.
 * Checks server version against minimum supported version and alerts user of mismatches.
 */

import { apiClient } from '@/core/api';
import { endpoints } from '@/core/api/endpoints';
import { trackEvent } from '@/core/monitoring';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('ServerVersion');

// Minimum supported AudiobookShelf server version
// Format: major.minor.patch (semver)
const MIN_SUPPORTED_VERSION = '2.7.0';

// Version below which critical features may not work
const CRITICAL_MIN_VERSION = '2.5.0';

export interface ServerStatus {
  isInit: boolean;
  serverVersion?: string;
  authMethods?: string[];
  ConfigPath?: string;
  MetadataPath?: string;
  isEmailer?: boolean;
}

export interface VersionCheckResult {
  serverVersion: string | null;
  isCompatible: boolean;
  isCriticalMismatch: boolean;
  minSupported: string;
  message: string | null;
}

/**
 * Parse semver version string to comparable numbers
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  // Remove 'v' prefix if present and any build metadata
  const cleaned = version.replace(/^v/, '').split('-')[0].split('+')[0];
  const parts = cleaned.split('.');

  if (parts.length < 2) return null;

  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2] || '0', 10);

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) return null;

  return { major, minor, patch };
}

/**
 * Compare two semver versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  if (!versionA || !versionB) return 0;

  if (versionA.major !== versionB.major) {
    return versionA.major < versionB.major ? -1 : 1;
  }
  if (versionA.minor !== versionB.minor) {
    return versionA.minor < versionB.minor ? -1 : 1;
  }
  if (versionA.patch !== versionB.patch) {
    return versionA.patch < versionB.patch ? -1 : 1;
  }

  return 0;
}

class ServerVersionService {
  private cachedServerVersion: string | null = null;
  private lastCheck: number = 0;
  private readonly CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour cache

  // Callback for version mismatch notifications
  private onVersionMismatch: ((result: VersionCheckResult) => void) | null = null;

  /**
   * Set callback for version mismatch notifications
   * Used by app to show alerts/banners
   */
  setVersionMismatchCallback(callback: ((result: VersionCheckResult) => void) | null): void {
    this.onVersionMismatch = callback;
  }

  /**
   * Fetch server status and check version compatibility
   */
  async checkServerVersion(forceRefresh: boolean = false): Promise<VersionCheckResult> {
    const now = Date.now();

    // Use cached version if recent
    if (!forceRefresh && this.cachedServerVersion && now - this.lastCheck < this.CHECK_INTERVAL_MS) {
      return this.evaluateVersion(this.cachedServerVersion);
    }

    try {
      // Fetch server status (unauthenticated endpoint)
      const baseUrl = apiClient.getBaseURL();
      if (!baseUrl) {
        log.debug('No base URL configured - skipping version check');
        return {
          serverVersion: null,
          isCompatible: true, // Assume compatible if we can't check
          isCriticalMismatch: false,
          minSupported: MIN_SUPPORTED_VERSION,
          message: null,
        };
      }

      const response = await fetch(`${baseUrl}${endpoints.server.status}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        log.warn(`Server status endpoint failed: ${response.status}`);
        // Track for monitoring
        trackEvent('server_version_check_failed', {
          status: response.status,
        }, 'warning');

        return {
          serverVersion: null,
          isCompatible: true, // Assume compatible if check fails
          isCriticalMismatch: false,
          minSupported: MIN_SUPPORTED_VERSION,
          message: null,
        };
      }

      const status: ServerStatus = await response.json();
      const serverVersion = status.serverVersion || null;

      log.debug(`Server version: ${serverVersion}`);

      if (serverVersion) {
        this.cachedServerVersion = serverVersion;
        this.lastCheck = now;
      }

      const result = this.evaluateVersion(serverVersion);

      // Notify callback if there's a mismatch
      if (!result.isCompatible && this.onVersionMismatch) {
        this.onVersionMismatch(result);
      }

      // Track version for analytics
      trackEvent('server_version_checked', {
        serverVersion: serverVersion || 'unknown',
        isCompatible: result.isCompatible,
        isCriticalMismatch: result.isCriticalMismatch,
        minSupported: MIN_SUPPORTED_VERSION,
      }, result.isCriticalMismatch ? 'error' : 'info');

      return result;
    } catch (error) {
      log.warn('Version check failed:', error);
      return {
        serverVersion: null,
        isCompatible: true, // Assume compatible on error
        isCriticalMismatch: false,
        minSupported: MIN_SUPPORTED_VERSION,
        message: null,
      };
    }
  }

  /**
   * Evaluate version compatibility
   */
  private evaluateVersion(serverVersion: string | null): VersionCheckResult {
    if (!serverVersion) {
      return {
        serverVersion: null,
        isCompatible: true,
        isCriticalMismatch: false,
        minSupported: MIN_SUPPORTED_VERSION,
        message: null,
      };
    }

    const isBelowMinSupported = compareVersions(serverVersion, MIN_SUPPORTED_VERSION) < 0;
    const isBelowCritical = compareVersions(serverVersion, CRITICAL_MIN_VERSION) < 0;

    let message: string | null = null;
    if (isBelowCritical) {
      message = `Your server (v${serverVersion}) is significantly outdated. Please upgrade to v${MIN_SUPPORTED_VERSION} or later for best compatibility.`;
    } else if (isBelowMinSupported) {
      message = `Your server (v${serverVersion}) may have limited compatibility. Consider upgrading to v${MIN_SUPPORTED_VERSION} or later.`;
    }

    return {
      serverVersion,
      isCompatible: !isBelowMinSupported,
      isCriticalMismatch: isBelowCritical,
      minSupported: MIN_SUPPORTED_VERSION,
      message,
    };
  }

  /**
   * Get cached server version (if available)
   */
  getCachedVersion(): string | null {
    return this.cachedServerVersion;
  }

  /**
   * Clear cached version (on logout, server change, etc.)
   */
  clearCache(): void {
    this.cachedServerVersion = null;
    this.lastCheck = 0;
  }
}

export const serverVersionService = new ServerVersionService();
