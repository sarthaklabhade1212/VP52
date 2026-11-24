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

export async function logAdEvent(token, { ad_format = 'rewarded', event_type, ad_unit_id, metadata = {} }, fetchImpl = fetch) {
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
        ad_unit_id: ad_unit_id || ADMOB_CONFIG.REWARDED_AD_UNIT_ID,
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
 * Executes ONE complete sequential native Android rewarded ad with Server-Side Verification (SSV)
 * to unlock the customer's 6-hour earning session (3 verified ads required).
 *
 * Flow:
 * 1. Checks native platform and single-flight mutex (`inFlightRewardedAd`).
 * 2. Calls backend `POST /api/customer/reward-session/prepare-ad` to create/reuse a pending
 *    session and obtain a 15-minute one-time verification token.
 * 3. Calls `AdMob.prepareRewardVideoAd()` with adId `ca-app-pub-4004834464698326/8368553876`,
 *    configurable `isTesting`, and `ssv: { userId, customData }`.
 * 4. Calls `AdMob.showRewardVideoAd()`.
 * 5. On early dismissal / failure: cancels the pending record with 0 coins credited.
 * 6. On ad completion: polls backend SSV verification and checks session unlock progress.
 *    Completing 3/3 ads automatically activates the 6-hour session on the server.
 *    Zero wallet coins are credited for watching the ads themselves.
 */
export async function runSequentialRewardedAdFlow({
  token,
  sessionType = 'vp52_coin_session',
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
        error: 'Advertisement closed before completion. Watch the full ad to count toward unlocking your 6-hour session.'
      };
    }

    // Step 5: User completed ad — poll backend SSV verification
    // Zero coins credited for ad watch; completing 3/3 ads unlocks 6-hour session
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
            error: 'Server verification rejected or expired this ad slot.'
          };
        }
      }
    }

    // Step 6: Fetch updated coin session status to determine ads completed & auto-start state
    let coinSessionData = null;
    try {
      const sessRes = await fetchImpl('/api/customer/coin-session', {
        headers: { Authorization: `Bearer ${token}` }
      });
      coinSessionData = await sessRes.json().catch(() => null);
    } catch (_) {}

    if (!verifiedRecord) {
      // SSV callback may be slightly delayed; report pending without speculative crediting
      return {
        success: true,
        status: 'ssv_pending',
        adSlot: pendingVerification.ad_slot,
        verificationToken: pendingVerification.verification_token,
        coinsCredited: 0
      };
    }

    const adsCompleted = coinSessionData?.session?.ads_completed || pendingVerification.ad_slot;
    const sessionStarted = coinSessionData?.session_state === 'ACTIVE' || (adsCompleted >= 3);

    return {
      success: true,
      status: 'verified',
      adSlot: pendingVerification.ad_slot,
      adsCompleted,
      sessionStarted,
      coinsCredited: 0
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
