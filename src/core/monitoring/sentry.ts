/**
 * src/core/monitoring/sentry.ts
 *
 * Crash reporting and error tracking via Sentry.
 * Gracefully degrades if Sentry is not installed.
 *
 * To enable Sentry:
 * 1. Run: npx expo install @sentry/react-native
 * 2. Add to app.json plugins:
 *    ["@sentry/react-native/expo", { "organization": "your-org", "project": "secret-library" }]
 * 3. Set EXPO_PUBLIC_SENTRY_DSN in your environment
 */

// Try to import Sentry, but don't fail if not installed
// Using 'any' type since @sentry/react-native may not be installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sentry: any = null;

try {
  // Dynamic require to avoid build errors if Sentry isn't installed
  Sentry = require('@sentry/react-native');
} catch {
  // Sentry not installed - will use no-op functions
  if (__DEV__) {
    console.log('[Monitoring] Sentry not installed - crash reporting disabled');
  }
}

/**
 * Initialize Sentry crash reporting
 * Call this at app startup, before any other code
 */
export function initSentry(): void {
  if (!Sentry) {
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    if (__DEV__) {
      console.log('[Monitoring] No Sentry DSN configured - crash reporting disabled');
    }
    return;
  }

  try {
    Sentry.init({
      dsn,

      // Only send events in production
      enabled: !__DEV__,

      // Sample rate for performance monitoring (10% of transactions)
      tracesSampleRate: 0.1,

      // Don't send PII
      sendDefaultPii: false,

      // Add context before sending
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      beforeSend(event: any) {
        // Could add user ID, server URL (sanitized), etc.
        return event;
      },
    });

    console.log('[Monitoring] Sentry initialized');
  } catch (error) {
    console.error('[Monitoring] Failed to initialize Sentry:', error);
  }
}

/**
 * Capture an error with optional context
 */
export function captureError(
  error: Error,
  context?: {
    category?: string;
    code?: string;
    details?: Record<string, unknown>;
    level?: 'fatal' | 'error' | 'warning' | 'info';
  }
): void {
  // Always log to console in dev
  if (__DEV__) {
    console.error('[Monitoring] Error:', error.message, context);
  }

  if (!Sentry) {
    return;
  }

  try {
    Sentry.captureException(error, {
      level: context?.level || 'error',
      tags: {
        category: context?.category,
        code: context?.code,
      },
      extra: context?.details,
    });
  } catch (e) {
    // Don't let monitoring crash the app
    console.error('[Monitoring] Failed to capture error:', e);
  }
}

/**
 * Track a specific event (for breadcrumbs and analytics-like tracking)
 */
export function trackEvent(
  name: string,
  data?: Record<string, unknown>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): void {
  // Always log to console in dev
  if (__DEV__) {
    console.log(`[Monitoring] Event: ${name}`, data);
  }

  if (!Sentry) {
    return;
  }

  try {
    Sentry.addBreadcrumb({
      category: 'app.event',
      message: name,
      data,
      level,
    });
  } catch {
    // Don't let monitoring crash the app
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; username?: string } | null): void {
  if (!Sentry) {
    return;
  }

  try {
    if (user) {
      Sentry.setUser({
        id: user.id,
        username: user.username,
      });
    } else {
      Sentry.setUser(null);
    }
  } catch {
    // Don't let monitoring crash the app
  }
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (!Sentry) {
    return;
  }

  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  } catch {
    // Don't let monitoring crash the app
  }
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return Sentry !== null && !__DEV__ && !!process.env.EXPO_PUBLIC_SENTRY_DSN;
}
