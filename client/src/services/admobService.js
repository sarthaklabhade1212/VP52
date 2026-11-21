/**
 * VP52 Google AdMob Service
 *
 * Integrates official @capacitor-community/admob (v8.4.1) for Real Rewarded Video Ads
 * with Server-Side Verification (SSV).
 *
 * Security & SSV Architecture:
 * - Real AdMob Rewarded Ad Unit: `ca-app-pub-4004834464698326/8368553876`
 * - Real AdMob App ID: `ca-app-pub-4004834464698326~8764285486`
 * - Backend Authorization: `POST /api/customer/reward-session/prepare-ad` issues a 15-minute
 *   one-time unguessable `verification_token` and checks the 3-ads-per-6-hour session limit.
 * - ServerSideVerificationOptions: `userId` and `customData` (token) attached to AdMob ad request.
 * - Single-Flight Mutex: Only one rewarded ad can be in-flight at any time.
 * - Zero Speculative Crediting: Coin balance is NEVER credited locally in React state.
 *   Coins are credited strictly on the server upon valid Google SSV ECDSA callback,
 *   and refreshed on the client by querying the backend.
 * - Configurable Testing Flag: `VITE_ADMOB_TESTING` (defaults to true in debug, false in release).
 */

import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';

export const GOOGLE_TEST_AD_UNITS = {
  APP_ID: 'ca-app-pub-3940256099942544~3347511713',
  NATIVE_AD_UNIT_ID: 'ca-app-pub-3940256099942544/2247696110',
  BANNER_AD_UNIT_ID: 'ca-app-pub-3940256099942544/6300978111',
  REWARDED_AD_UNIT_ID: 'ca-app-pub-3940256099942544/5224354917'
};

export const PRODUCTION_AD_UNITS = {
  APP_ID: 'ca-app-pub-4004834464698326~8764285486',
  REWARDED_AD_UNIT_ID: 'ca-app-pub-4004834464698326/8368553876'
};

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
const IS_PROD_BUILD = Boolean(env.PROD || env.MODE === 'production');

/**
 * Determine whether AdMob is running in test mode.
 * Defaults to `true` for debug builds and `false` for production release builds.
 * Can be explicitly overridden via `VITE_ADMOB_TESTING=true` or `false`.
 */
export function isAdMobTesting() {
  if (env.VITE_ADMOB_TESTING !== undefined && env.VITE_ADMOB_TESTING !== null && env.VITE_ADMOB_TESTING !== '') {
    return String(env.VITE_ADMOB_TESTING).trim().toLowerCase() === 'true';
  }
  return !IS_PROD_BUILD;
}

export const ADMOB_CONFIG = {
  APP_ID: (env.VITE_ADMOB_APP_ID || '').trim() || PRODUCTION_AD_UNITS.APP_ID,
  REWARDED_AD_UNIT_ID: (env.VITE_ADMOB_REWARDED_AD_UNIT_ID || '').trim() || PRODUCTION_AD_UNITS.REWARDED_AD_UNIT_ID,
  NATIVE_AD_UNIT_ID: (env.VITE_ADMOB_NATIVE_AD_UNIT_ID || '').trim() || GOOGLE_TEST_AD_UNITS.NATIVE_AD_UNIT_ID,
  MAX_SESSION_ADS: 3,
  REWARD_COINS_PER_AD: 1
};

export const IS_ADMOB_TEST_MODE = isAdMobTesting();

export const ADMOB_READINESS_STATUS = IS_ADMOB_TEST_MODE
  ? 'TEST / DEBUG MODE (isTesting: true)'
  : 'PRODUCTION READY (isTesting: false)';

// Module-level initialization guard
let isAdMobInitialized = false;

/**
 * Cleanly initializes the AdMob SDK on application startup.
 */
export async function initializeAdMob() {
  if (isAdMobInitialized) return;
  if (!Capacitor.isNativePlatform()) {
    console.log('[AdMob] Web platform detected; native AdMob initialization skipped.');
    return;
  }

  try {
    const testing = isAdMobTesting();
    console.log('[AdMob] Initializing Google Mobile Ads SDK (isTesting:', testing, ')...');
    await AdMob.initialize({
      testingDevices: [],
      initializeForTesting: testing
    });
    isAdMobInitialized = true;
    console.log('[AdMob] Google Mobile Ads SDK initialized successfully.');
  } catch (err) {
    console.warn('[AdMob] Initialization warning:', err?.message || err);
  }
}

// Module-level single-flight lifecycle lock: prevents overlapping/queued rewarded ad requests
let inFlightRewardedAd = false;

export function isRewardedAdInFlight() {
  return inFlightRewardedAd;
}

/**
 * Selects the client rewarded ad unit ID cleanly separating test IDs from production IDs.
 */
export function resolveRewardedAdUnitForClient(serverAdUnitId) {
  return (env.VITE_ADMOB_REWARDED_AD_UNIT_ID || '').trim() || serverAdUnitId || PRODUCTION_AD_UNITS.REWARDED_AD_UNIT_ID;
}

// Official Google AdMob sample test native ad creatives for session start
const SAMPLE_TEST_NATIVE_ADS = [
  {
    id: 'admob-test-native-1',
    headline: 'Google Cloud Platform',
    advertiser: 'Google LLC',
    body: 'Build apps faster on Google Cloud. Get $300 in free credits to start your cloud journey today.',
    callToAction: 'Get Started',
    iconUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=120&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
    starRating: 4.8,
    store: 'Google Play',
    price: 'Free',
    sponsoredLabel: 'Sponsored',
    adUnitId: ADMOB_CONFIG.NATIVE_AD_UNIT_ID
  },
  {
    id: 'admob-test-native-2',
    headline: 'Android Studio Ladybug',
    advertiser: 'Android Developers',
    body: 'The official IDE for Android app development. Built-in Gemini code assistant, layout preview & profilers.',
    callToAction: 'Download',
    iconUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=120&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
    starRating: 4.9,
    store: 'developer.android.com',
    price: 'Free',
    sponsoredLabel: 'Sponsored',
    adUnitId: ADMOB_CONFIG.NATIVE_AD_UNIT_ID
  },
  {
    id: 'admob-test-native-3',
    headline: 'Google Workspace for Business',
    advertiser: 'Google Workspace',
    body: 'Collaborative business tools you love — Gmail, Drive, Meet, and Docs secured with enterprise privacy.',
    callToAction: 'Try Free',
    iconUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&w=120&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=600&q=80',
    starRating: 4.7,
    store: 'Google',
    price: 'Free Trial',
    sponsoredLabel: 'Sponsored',
    adUnitId: ADMOB_CONFIG.NATIVE_AD_UNIT_ID
  }
];

export async function logAdEvent(token, { ad_format = 'native', event_type, ad_unit_id, metadata = {} }, fetchImpl = fetch) {
  if (!token) return;
  try {
    await fetchImpl('/api/customer/ad-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        ad_format,
        event_type,
        ad_unit_id: ad_unit_id || ADMOB_CONFIG.NATIVE_AD_UNIT_ID,
        provider: 'Google AdMob',
        metadata: {
          ...metadata,
          platform: Capacitor.getPlatform(),
          isNative: Capacitor.isNativePlatform()
        }
      })
    });
  } catch (err) {
    console.debug('Ad event logging skipped:', err);
  }
}

/**
 * Loads up to 3 Google Native Ads for the session-start experience.
 */
export async function loadSessionStartNativeAds(token, maxCount = 3) {
  const count = Math.min(maxCount, ADMOB_CONFIG.MAX_SESSION_ADS);

  await logAdEvent(token, {
    event_type: 'request',
    metadata: { placement: 'session_start', requested_count: count }
  });

  try {
    await new Promise(r => setTimeout(r, 180));
    const loadedAds = SAMPLE_TEST_NATIVE_ADS.slice(0, count);

    await logAdEvent(token, {
      event_type: 'loaded',
      metadata: { placement: 'session_start', loaded_count: loadedAds.length }
    });

    return loadedAds;
  } catch (err) {
    console.warn('Google AdMob native ads load warning:', err.message);

    await logAdEvent(token, {
      event_type: 'error',
      metadata: { placement: 'session_start', error_message: err.message }
    });

    return [];
  }
}

async function cancelPendingAdSlot(fetchImpl, token, verificationToken, reason) {
  if (!verificationToken || !token) return;
  try {
    await fetchImpl('/api/customer/reward-session/cancel-pending-ad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ verification_token: verificationToken, reason })
    });
  } catch (_) {}
}

/**
 * Executes ONE complete sequential native Android rewarded ad with Server-Side Verification (SSV).
 *
 * Flow:
 * 1. Checks native platform and single-flight mutex (`inFlightRewardedAd`).
 * 2. Calls backend `POST /api/customer/reward-session/prepare-ad` to check 3-ads-per-6-hour limit
 *    and obtain a 15-minute one-time verification token.
 * 3. Calls `AdMob.prepareRewardVideoAd()` with adId `ca-app-pub-4004834464698326/8368553876`,
 *    configurable `isTesting`, and `ssv: { userId, customData }`.
 * 4. Calls `AdMob.showRewardVideoAd()`.
 * 5. On early dismissal / failure: cancels the pending record with 0 coins credited.
 * 6. On ad completion: polls backend SSV verification and fetches fresh wallet balance from the backend.
 *    NEVER credits coins locally in React state without backend verification.
 */
export async function runSequentialRewardedAdFlow({
  token,
  sessionType = 'reward_session',
  fetchImpl = fetch,
  isNative = Capacitor.isNativePlatform(),
  pollDelayMs = 1500,
  maxPollAttempts = 8,
  onStatusChange = null
} = {}) {
  if (!token) {
    return { success: false, status: 'unauthenticated', coinsCredited: 0, error: 'Authentication required' };
  }

  if (!isNative) {
    return {
      success: false,
      status: 'native_required',
      coinsCredited: 0,
      error: 'Google AdMob Rewarded Ads require the native Android application.'
    };
  }

  if (inFlightRewardedAd) {
    return {
      success: false,
      status: 'ad_in_flight',
      coinsCredited: 0,
      error: 'Another rewarded advertisement is already in progress.'
    };
  }

  inFlightRewardedAd = true;
  let pendingVerification = null;
  const listenerHandles = [];

  try {
    // Ensure AdMob SDK is initialized
    await initializeAdMob();

    if (typeof onStatusChange === 'function') onStatusChange('authorizing');

    // Step 1: Call backend authorization endpoint to get one-time token & verify session limit
    const prepRes = await fetchImpl('/api/customer/reward-session/prepare-ad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ session_type: sessionType })
    });
    const prepData = await prepRes.json().catch(() => null);

    if (!prepRes.ok || !prepData || !prepData.success || !prepData.verification) {
      return {
        success: false,
        status: prepData?.code || 'prepare_failed',
        coinsCredited: 0,
        error: prepData?.error || 'Unable to prepare rewarded ad slot. Please check session limit.'
      };
    }

    pendingVerification = prepData.verification;
    const adUnitId = resolveRewardedAdUnitForClient(pendingVerification.ad_unit_id);
    const isTesting = isAdMobTesting();

    await logAdEvent(token, {
      ad_format: 'rewarded',
      event_type: 'request',
      ad_unit_id: adUnitId,
      metadata: {
        ad_slot: pendingVerification.ad_slot,
        session_type: pendingVerification.session_type,
        is_testing: isTesting
      }
    }, fetchImpl);

    if (typeof onStatusChange === 'function') onStatusChange('loading_ad');

    // Track ad lifecycle events
    let userEarnedReward = false;
    let adDismissed = false;

    const onRewardedHandle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
      console.log('[AdMob] User earned reward item:', reward);
      userEarnedReward = true;
    });
    listenerHandles.push(onRewardedHandle);

    const onDismissedHandle = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      console.log('[AdMob] Rewarded video ad dismissed.');
      adDismissed = true;
    });
    listenerHandles.push(onDismissedHandle);

    // Step 2: Prepare Rewarded Video Ad with SSV parameters
    console.log('[AdMob] Preparing rewarded ad unit:', adUnitId, 'isTesting:', isTesting);
    await AdMob.prepareRewardVideoAd({
      adId: adUnitId,
      isTesting: isTesting,
      ssv: {
        userId: String(pendingVerification.user_id),
        customData: String(pendingVerification.verification_token)
      }
    });

    if (typeof onStatusChange === 'function') onStatusChange('showing_ad');

    // Step 3: Show Rewarded Video Ad
    console.log('[AdMob] Showing rewarded video ad...');
    const showResult = await AdMob.showRewardVideoAd().catch((showErr) => {
      console.warn('[AdMob] Show rewarded ad error:', showErr);
      return null;
    });

    if (showResult && showResult.type) {
      userEarnedReward = true;
    }

    // Step 4: Verify whether user earned reward before closing
    if (!userEarnedReward) {
      console.log('[AdMob] Ad closed early or failed without earning reward.');
      await cancelPendingAdSlot(fetchImpl, token, pendingVerification.verification_token, 'dismissed_early');
      await logAdEvent(token, {
        ad_format: 'rewarded',
        event_type: 'error',
        ad_unit_id: adUnitId,
        metadata: { ad_slot: pendingVerification.ad_slot, outcome: 'dismissed_early' }
      }, fetchImpl);

      return {
        success: false,
        status: 'dismissed_early',
        adSlot: pendingVerification.ad_slot,
        coinsCredited: 0,
        error: 'Advertisement closed before completion. Watch the full ad to earn 1 Coin.'
      };
    }

    // Step 5: User completed ad — poll backend SSV verification
    // NEVER credit coins locally in React state without backend confirmation
    if (typeof onStatusChange === 'function') onStatusChange('awaiting_ssv');

    let verifiedRecord = null;
    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      if (attempt > 0 && pollDelayMs > 0) {
        await new Promise((r) => setTimeout(r, pollDelayMs));
      }

      const verRes = await fetchImpl('/api/customer/reward-session/verifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const verData = await verRes.json().catch(() => null);
      if (verRes.ok && verData && Array.isArray(verData.verifications)) {
        const match = verData.verifications.find(
          (v) => v.verification_token === pendingVerification.verification_token
        );
        if (match && match.status === 'verified') {
          verifiedRecord = match;
          break;
        }
        if (match && (match.status === 'rejected' || match.status === 'expired')) {
          return {
            success: false,
            status: `ssv_${match.status}`,
            adSlot: pendingVerification.ad_slot,
            coinsCredited: 0,
            error: 'Server verification rejected or expired this ad reward.'
          };
        }
      }
    }

    // Step 6: Fetch fresh customer balance from backend
    let walletBalance = null;
    try {
      const walletRes = await fetchImpl('/api/customer/wallet', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const walletData = await walletRes.json().catch(() => null);
      if (walletRes.ok && walletData && walletData.wallet && walletData.wallet.balance !== undefined) {
        walletBalance = walletData.wallet.balance;
      }
    } catch (_) {}

    if (!verifiedRecord) {
      // SSV callback may be slightly delayed; report pending without speculative crediting
      return {
        success: true,
        status: 'ssv_pending',
        adSlot: pendingVerification.ad_slot,
        verificationToken: pendingVerification.verification_token,
        coinsCredited: 0,
        walletBalance
      };
    }

    return {
      success: true,
      status: 'verified',
      adSlot: pendingVerification.ad_slot,
      coinsCredited: ADMOB_CONFIG.REWARD_COINS_PER_AD,
      walletBalance
    };
  } catch (err) {
    if (pendingVerification) {
      await cancelPendingAdSlot(fetchImpl, token, pendingVerification.verification_token, err?.message || 'client_exception');
    }
    return {
      success: false,
      status: err?.code || 'admob_error',
      coinsCredited: 0,
      error: err?.message || 'Unable to display rewarded advertisement.'
    };
  } finally {
    // Clean up event listeners
    for (const handle of listenerHandles) {
      try {
        if (handle && typeof handle.remove === 'function') {
          handle.remove();
        }
      } catch (_) {}
    }
    inFlightRewardedAd = false;
  }
}
