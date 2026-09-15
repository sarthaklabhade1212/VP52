// Native Google Sign-In helper — CUSTOMER login only.
//
// Design notes:
//  * The native implementation comes from @capgo/capacitor-social-login, which is
//    Capacitor-8 compatible (peerDependency @capacitor/core >=8.0.0). We bind to it
//    at RUNTIME through Capacitor's plugin bridge (`registerPlugin('SocialLogin')`)
//    and import ONLY from '@capacitor/core' (already installed). That keeps the web
//    bundle building even before `npm install @capgo/capacitor-social-login` +
//    `npx cap sync android` have added the native code. Once installed and synced,
//    these calls bind to the Android Credential Manager flow automatically.
//  * The flow returns a Google ID token that is verified SERVER-SIDE. Nothing here
//    trusts the email/name — the backend re-derives everything from the verified
//    token. We only ever read the PUBLIC web OAuth client id from the environment;
//    no client secret is present in the frontend.
import { Capacitor, registerPlugin } from '@capacitor/core';

const SocialLogin = registerPlugin('SocialLogin');

const WEB_CLIENT_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID) || '';
const IOS_CLIENT_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID) || '';

let initialized = false;

// Stable error codes the UI maps to translated messages.
//   'not_configured' -> VITE_GOOGLE_WEB_CLIENT_ID / VITE_GOOGLE_IOS_CLIENT_ID missing
//   'unavailable'    -> not the native app / plugin not installed
//   'cancelled'      -> user dismissed the Google sheet
//   'failed'         -> anything else
export class GoogleAuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

function describe(err) {
  return ((err && (err.message || err.code || err.errorMessage)) || '').toString().toLowerCase();
}

function looksCancelled(err) {
  const s = describe(err);
  return s.includes('cancel') || s.includes('canceled') || s.includes('closed') ||
         s.includes('dismiss') || s.includes('no credential') || s.includes('user_cancelled') ||
         s.includes('-5');
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
 * Returns false on web browsers.
 */
export function isNativeApp() {
  const platform = getAppPlatform();
  return platform === 'android' || platform === 'ios';
}

/**
 * Triggers the native Google sign-in and resolves with a Google ID token
 * (to be verified by the backend). Throws GoogleAuthError with a stable `.code`.
 */
export async function signInWithGoogle() {
  const platform = getAppPlatform();
  if (platform === 'ios' && !IOS_CLIENT_ID && !WEB_CLIENT_ID) {
    throw new GoogleAuthError('not_configured', 'Google client id is not configured');
  } else if (platform !== 'ios' && !WEB_CLIENT_ID) {
    throw new GoogleAuthError('not_configured', 'Google web client id is not configured');
  }
  if (!isNativeApp()) {
    // The native plugin backs this flow only in the mobile app build.
    throw new GoogleAuthError('unavailable', 'Google sign-in is only available in the mobile app');
  }
  try {
    await ensureInitialized();
    const res = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'] }
    });
    const idToken = res && res.result && res.result.idToken;
    if (!idToken) {
      throw new GoogleAuthError('failed', 'No ID token returned by Google');
    }
    // Safe, token-free diagnostic ONLY. NEVER log the ID token, access token,
    // profile, or the raw result object — those are credentials.
    console.log('[GoogleAuth] Google credential received');
    return idToken;
  } catch (err) {
    if (err instanceof GoogleAuthError) throw err;
    if (looksCancelled(err)) throw new GoogleAuthError('cancelled', 'Google sign-in cancelled');
    if (looksUnavailable(err)) throw new GoogleAuthError('unavailable', 'Google sign-in is not available');
    throw new GoogleAuthError('failed', (err && err.message) || 'Google sign-in failed');
  }
}
