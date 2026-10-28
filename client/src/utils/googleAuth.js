// Google Sign-In helper for VP52 Customer Login
//
// Integration details:
// - Uses @capgo/capacitor-social-login for Android native Credential Manager
//   and web fallback.
// - Obtains a cryptographically signed Google ID token.
// - Sends the ID token to POST /api/auth/customer/google for server-side verification
//   with google-auth-library.
// - Client-side credentials/tokens are never logged.
import { Capacitor, registerPlugin } from '@capacitor/core';

const SocialLogin = registerPlugin('SocialLogin', {
  web: () => import('@capgo/capacitor-social-login').then((m) => new m.SocialLoginWeb())
});

const WEB_CLIENT_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID) || '';
const IOS_CLIENT_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID) || '';

let initialized = false;

// Stable error codes mapped to user-facing messages in translations:
// 'not_configured' -> VITE_GOOGLE_WEB_CLIENT_ID missing or Google Console mismatch (SHA-1/package)
// 'unavailable'    -> native plugin or service unavailable
// 'cancelled'      -> user dismissed account chooser / pressed back
// 'network'        -> network failure
// 'failed'         -> generic or server failure
export class GoogleAuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

function describe(err) {
  return ((err && (err.message || err.code || err.errorMessage || String(err))) || '').toLowerCase();
}

function looksCancelled(err) {
  const s = describe(err);
  return (
    s.includes('cancel') ||
    s.includes('canceled') ||
    s.includes('closed') ||
    s.includes('dismiss') ||
    s.includes('user_cancelled') ||
    s.includes('no credential') ||
    s.includes('no_credential') ||
    s.includes('-5')
  );
}

function looksMisconfigured(err) {
  const s = describe(err);
  return (
    s.includes('developer console') ||
    s.includes('28444') ||
    s.includes('10:') ||
    s.includes('developer_error') ||
    s.includes('not configured for this installed build') ||
    s.includes('client id is not set') ||
    s.includes('not configured')
  );
}

function looksReauthFailed(err) {
  const s = describe(err);
  return s.includes('account reauth failed') || s.includes('[16]');
}

function looksNetwork(err) {
  const s = describe(err);
  return s.includes('network') || s.includes('timeout') || s.includes('offline') || s.includes('failed to fetch');
}

function looksUnavailable(err) {
  const s = describe(err);
  return s.includes('unimplemented') || s.includes('not implemented') || s.includes('unavailable');
}

async function ensureInitialized() {
  if (initialized) return;
  const effectiveIosClientId = IOS_CLIENT_ID || WEB_CLIENT_ID;
  await SocialLogin.initialize({
    google: {
      webClientId: WEB_CLIENT_ID,
      iOSClientId: effectiveIosClientId,
      iOSServerClientId: WEB_CLIENT_ID,
      mode: 'online'
    }
  });
  initialized = true;
}

/**
 * Authoritative platform detection distinguishing:
 * - 'android': Capacitor Android application
 * - 'ios': Capacitor iOS application
 * - 'web': Standard web browser
 */
export function getAppPlatform() {
  if (typeof window === 'undefined') return 'web';

  // 1. Primary check: official Capacitor runtime platform
  if (Capacitor && typeof Capacitor.getPlatform === 'function') {
    const p = Capacitor.getPlatform();
    if (p === 'android' || p === 'ios') return p;
  }

  // 2. Secondary check: window.Capacitor bridge object
  if (typeof window.Capacitor !== 'undefined' && typeof window.Capacitor.getPlatform === 'function') {
    const p = window.Capacitor.getPlatform();
    if (p === 'android' || p === 'ios') return p;
  }

  // 3. Fallback: native webview protocols
  if (window.location && (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:')) {
    return 'android';
  }

  return 'web';
}

/**
 * Returns true only when running inside a native mobile container (Android or iOS).
 * Returns false on standard web browsers.
 */
export function isNativeApp() {
  const platform = getAppPlatform();
  return platform === 'android' || platform === 'ios';
}

/**
 * Cleanly signs out of Google and wipes Credential Manager / plugin cached state.
 * Prevents stale credential tokens and [16] Account reauth failed errors on subsequent logins.
 */
export async function signOutWithGoogle() {
  try {
    await ensureInitialized();
    if (SocialLogin && typeof SocialLogin.logout === 'function') {
      await SocialLogin.logout({ provider: 'google' });
      console.log('[GoogleAuth] Native Google Credential Manager state cleared successfully');
    }
  } catch (err) {
    console.warn('[GoogleAuth] Native Google logout notice:', err && err.message);
  }
}

/**
 * Initiates the Google Sign-In flow:
 * - On Android/iOS: triggers the native Credential Manager account sheet
 * - On Web: triggers popup OAuth flow or signals mobile requirement
 * Returns the verified ID token string to pass to the backend.
 */
export async function signInWithGoogle() {
  const platform = getAppPlatform();

  if (platform === 'ios' && !IOS_CLIENT_ID && !WEB_CLIENT_ID) {
    throw new GoogleAuthError('not_configured', 'Google OAuth client ID is not configured (missing VITE_GOOGLE_IOS_CLIENT_ID or VITE_GOOGLE_WEB_CLIENT_ID)');
  } else if (!WEB_CLIENT_ID) {
    throw new GoogleAuthError('not_configured', 'Google Web Client ID is not configured (missing VITE_GOOGLE_WEB_CLIENT_ID)');
  }

  try {
    await ensureInitialized();

    const res = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile'],
        filterByAuthorizedAccounts: false
      }
    });

    const idToken = res && res.result && res.result.idToken;
    if (!idToken) {
      throw new GoogleAuthError('failed', 'No ID token returned by Google authentication');
    }

    console.log('[GoogleAuth] Google credential token received successfully');
    return idToken;
  } catch (err) {
    if (err instanceof GoogleAuthError) throw err;
    if (looksCancelled(err)) throw new GoogleAuthError('cancelled', 'Google sign-in was cancelled');
    if (looksMisconfigured(err)) {
      throw new GoogleAuthError(
        'not_configured',
        'Google Cloud Console OAuth is not configured for this build. Make sure an Android OAuth client with package com.sarthak.customerrewards and SHA-1 certificate is added.'
      );
    }
    if (looksReauthFailed(err)) {
      // Clear native Credential Manager state so subsequent attempts start fresh
      signOutWithGoogle().catch(() => {});
      throw new GoogleAuthError(
        'reauth_failed',
        'Google account authentication could not be completed. Please ensure your device has an active internet connection to Google services, and verify that your Google account is registered as an authorized test user in Google Cloud Console if the project is in Testing mode.'
      );
    }
    if (looksNetwork(err)) throw new GoogleAuthError('network', 'Network error connecting to Google servers');
    if (looksUnavailable(err)) throw new GoogleAuthError('unavailable', 'Google sign-in is not available on this platform/device');

    throw new GoogleAuthError('failed', (err && (err.message || err.errorMessage)) || 'Google sign-in failed');
  }
}
