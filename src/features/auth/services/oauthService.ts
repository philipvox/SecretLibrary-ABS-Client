/**
 * OAuth/SSO service for ABS OIDC authentication.
 *
 * Uses the same mobile OIDC flow as the official ABS Capacitor app:
 * 1. Generate PKCE challenge (code_verifier + code_challenge)
 * 2. Native HTTP GET to /auth/openid (no redirect follow) → captures 302 Location + session cookie
 * 3. Open the IdP URL in system browser (SFAuthenticationSession / Chrome Custom Tab)
 * 4. Browser follows: IdP → login → ABS /auth/openid/mobile-redirect → audiobookshelf://oauth
 * 5. Native HTTP GET to /auth/openid/callback (with session cookie) → JSON with accessToken
 *
 * The native HTTP module (NativeHttpModule) is needed because React Native's
 * fetch() returns an opaque response for redirect:'manual', preventing us from
 * reading the Location header. This is the same approach the official ABS app
 * uses via Capacitor's native HTTP.
 */

import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { NativeModules } from 'react-native';
import { logger } from '@/shared/utils/logger';

const { NativeHttpModule } = NativeModules;

const REDIRECT_URI = 'audiobookshelf://oauth';

/** Generate a random hex string for PKCE code_verifier and state */
function generateRandomHex(bytes: number): string {
  const array = Crypto.getRandomBytes(bytes);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hash a string and return base64url-encoded result */
async function sha256Base64url(value: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    value,
  );
  const bytes = hex.match(/.{2}/g)!.map((h) => parseInt(h, 16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

interface OAuthResult {
  user: {
    token: string;
    [key: string]: any;
  };
}

/**
 * Run the full OIDC flow: native HTTP for session, system browser for auth,
 * native HTTP for token exchange.
 */
async function startOAuthFlow(serverUrl: string): Promise<OAuthResult> {
  if (!NativeHttpModule) {
    throw new Error('NativeHttpModule not available — rebuild required after adding the plugin');
  }

  // 1. Generate PKCE params
  const codeVerifier = generateRandomHex(32);
  const codeChallenge = await sha256Base64url(codeVerifier);
  const state = generateRandomHex(16);

  // 2. Build the auth URL with mobile flow params
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  const authUrl = `${serverUrl}/auth/openid?${params.toString()}`;

  logger.info('[OAuth] Step 1: Native HTTP to /auth/openid (capturing redirect + session)');

  // 3. Native GET without following redirect — captures the 302 Location
  //    header (IdP URL) and the Set-Cookie session header.
  const initResponse: { status: number; location: string; cookies: string[] } =
    await NativeHttpModule.getWithoutRedirect(authUrl);

  if (!initResponse.location) {
    throw new Error(`Server returned ${initResponse.status} without a redirect to the IdP`);
  }

  const sessionCookies = initResponse.cookies;
  logger.info(`[OAuth] Got redirect to IdP, ${sessionCookies.length} session cookie(s)`);

  // 4. Open the IdP URL in system browser
  logger.info('[OAuth] Step 2: Opening system browser for IdP authentication');

  const browserResult = await WebBrowser.openAuthSessionAsync(
    initResponse.location,
    REDIRECT_URI,
  );

  if (browserResult.type !== 'success') {
    throw new Error('cancelled');
  }

  // 5. Parse the redirect URL for code + state
  const redirectUrl = new URL(browserResult.url);
  const code = redirectUrl.searchParams.get('code');
  const returnedState = redirectUrl.searchParams.get('state');

  if (!code) {
    throw new Error('No authorization code received from server');
  }

  if (returnedState !== state) {
    throw new Error('State mismatch — possible CSRF attack');
  }

  logger.info('[OAuth] Step 3: Exchanging code for token (native HTTP with session cookie)');

  // 6. Exchange code for token — native HTTP with session cookie
  const callbackParams = new URLSearchParams({
    code,
    state,
    code_verifier: codeVerifier,
  });
  const callbackUrl = `${serverUrl}/auth/openid/callback?${callbackParams.toString()}`;

  const tokenResponse: { status: number; body: string } =
    await NativeHttpModule.getWithCookies(callbackUrl, sessionCookies);

  if (tokenResponse.status < 200 || tokenResponse.status >= 300) {
    throw new Error(
      `Token exchange failed (${tokenResponse.status}): ${tokenResponse.body || 'Unknown error'}`,
    );
  }

  let data: any;
  try {
    data = JSON.parse(tokenResponse.body);
  } catch {
    throw new Error('Invalid JSON response from token exchange');
  }

  const token = data?.user?.accessToken || data?.user?.token;

  if (!token) {
    throw new Error('No token in server response');
  }

  logger.info('[OAuth] OIDC flow complete — token obtained');

  return { user: { ...data.user, token } };
}

export const oauthService = {
  startOAuthFlow,
};
