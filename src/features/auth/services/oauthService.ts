/**
 * OAuth/SSO service for OIDC authentication flow.
 *
 * Flow:
 * 1. Open system browser to ABS OIDC endpoint
 * 2. User authenticates with IdP
 * 3. ABS redirects to secretlibrary://oauth-callback?token={jwt}
 * 4. App catches deep link, extracts token
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { logger } from '@/shared/utils/logger';

const OAUTH_CALLBACK_PATH = 'oauth-callback';

/** Whether we're actively waiting for an OAuth callback */
let waitingForCallback = false;

/**
 * Build the full OAuth callback URL the server should redirect to.
 * e.g. secretlibrary://oauth-callback
 */
function getCallbackUrl(): string {
  return Linking.createURL(OAUTH_CALLBACK_PATH);
}

/**
 * Start the OAuth/OIDC login flow.
 *
 * Opens the system browser to the ABS OIDC endpoint. The server will
 * redirect through the IdP and ultimately back to our app via deep link.
 *
 * @param serverUrl - The normalized ABS server URL (no trailing slash)
 * @returns Promise that resolves with the JWT token from the callback
 */
async function startOAuthFlow(serverUrl: string): Promise<string> {
  const callbackUrl = getCallbackUrl();
  const authUrl = `${serverUrl}/auth/openid?redirect=${encodeURIComponent(callbackUrl)}&isRest=true`;

  logger.info('[OAuth] Starting OIDC flow', { authUrl, callbackUrl });

  waitingForCallback = true;

  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);

    if (result.type === 'success' && result.url) {
      const token = extractTokenFromUrl(result.url);
      if (token) {
        logger.info('[OAuth] Token received from callback');
        return token;
      }
      throw new Error('No token found in OAuth callback URL');
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('SSO login was cancelled');
    }

    throw new Error('SSO login failed');
  } finally {
    waitingForCallback = false;
  }
}

/**
 * Extract the JWT token from an OAuth callback URL.
 * Expected format: secretlibrary://oauth-callback?token={jwt}
 */
function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const token = parsed.queryParams?.token;
    if (typeof token === 'string' && token.length > 0) {
      return token;
    }
    return null;
  } catch (err) {
    logger.error('[OAuth] Failed to parse callback URL:', err);
    return null;
  }
}

/**
 * Handle an incoming deep link URL. Returns the token if this is a valid
 * OAuth callback that we're expecting, null otherwise.
 */
function handleDeepLink(url: string): string | null {
  if (!waitingForCallback) {
    return null;
  }

  const parsed = Linking.parse(url);
  if (parsed.path !== OAUTH_CALLBACK_PATH) {
    return null;
  }

  return extractTokenFromUrl(url);
}

/**
 * Check if the app is currently waiting for an OAuth callback.
 */
function isWaitingForCallback(): boolean {
  return waitingForCallback;
}

export const oauthService = {
  startOAuthFlow,
  handleDeepLink,
  isWaitingForCallback,
  getCallbackUrl,
};
