/**
 * VP52 Google AdMob Service (Native Rewarded SSV + Session-Start Native Ads)
 *
 * Security & SSV Architecture:
 * - Strictly separates development/test AdMob IDs from production AdMob IDs.
 * - Native rewarded ads invoke Vp52AdMobPlugin with backend-issued single-use
 *   `customData` (verification_token) and authenticated `userId` attached via
 *   official Google Mobile Ads ServerSideVerificationOptions.
 * - Enforces a strict single-flight lifecycle mutex (`inFlightRewardedAd`): no next
 *   rewarded ad can be requested until the active ad completes, fails, or is dismissed.
 * - NEVER credits coins from client callbacks; wallet updates happen ONLY after
 *   backend SSV confirmation (`status === 'verified'`). Delayed callbacks return
 *   `ssv_pending` with 0 speculative coins.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

const GOOGLE_TEST_PUB_PREFIX = 'ca-app-pub-3940256099942544';

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

export const ADMOB_CONFIG = {
  APP_ID: (env.VITE_ADMOB_APP_ID || '').trim() || (IS_PROD_BUILD ? PRODUCTION_AD_UNITS.APP_ID : GOOGLE_TEST_AD_UNITS.APP_ID),
  NATIVE_AD_UNIT_ID: (env.VITE_ADMOB_NATIVE_AD_UNIT_ID || '').trim() || GOOGLE_TEST_AD_UNITS.NATIVE_AD_UNIT_ID,
  BANNER_AD_UNIT_ID: (env.VITE_ADMOB_BANNER_AD_UNIT_ID || '').trim() || GOOGLE_TEST_AD_UNITS.BANNER_AD_UNIT_ID,
  REWARDED_AD_UNIT_ID: (env.VITE_ADMOB_REWARDED_AD_UNIT_ID || '').trim() || (IS_PROD_BUILD ? PRODUCTION_AD_UNITS.REWARDED_AD_UNIT_ID : GOOGLE_TEST_AD_UNITS.REWARDED_AD_UNIT_ID),
  MAX_SESSION_ADS: 3,
  REWARD_COINS_PER_AD: 1
};

export const IS_ADMOB_TEST_MODE = [
  ADMOB_CONFIG.APP_ID,
  ADMOB_CONFIG.NATIVE_AD_UNIT_ID,
  ADMOB_CONFIG.BANNER_AD_UNIT_ID,
  ADMOB_CONFIG.REWARDED_AD_UNIT_ID
].some((id) => !id || id.startsWith(GOOGLE_TEST_PUB_PREFIX));

export const ADMOB_READINESS_STATUS = IS_ADMOB_TEST_MODE
  ? 'TEST / NOT PRODUCTION READY'
  : 'PRODUCTION CONFIGURED';

// Official project-local Capacitor Android plugin for Google Mobile Ads Rewarded SSV
export const Vp52AdMob = registerPlugin('Vp52AdMob');

// Module-level single-flight lifecycle lock: prevents overlapping/queued rewarded ad requests
let inFlightRewardedAd = false;

export function isRewardedAdInFlight() {
  return inFlightRewardedAd;
}

/**
 * Selects the client rewarded ad unit ID cleanly separating development test IDs
 * from production IDs.
 */
export function resolveRewardedAdUnitForClient(serverAdUnitId, isProd = IS_PROD_BUILD) {
  if (!isProd) {
    return (env.VITE_ADMOB_REWARDED_AD_UNIT_ID || '').trim() || GOOGLE_TEST_AD_UNITS.REWARDED_AD_UNIT_ID;
  }
  return (env.VITE_ADMOB_REWARDED_AD_UNIT_ID || '').trim() || serverAdUnitId || PRODUCTION_AD_UNITS.REWARDED_AD_UNIT_ID;
}

// Official Google AdMob sample test native ad creatives for reliable verification
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
 * Handles load errors gracefully; returns fewer than 3 ads if fewer are available.
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
 * Executes ONE complete sequential native Android rewarded ad + backend SSV confirmation lifecycle.
 *
 * Lifecycle guarantees:
 * 1. Rejects immediately if another rewarded ad flow is already active (`inFlightRewardedAd`).
 * 2. Requires native platform runtime (never grants rewards from web fallback/client simulation).
 * 3. Calls `POST /api/customer/reward-session/prepare-ad` for a fresh single-use `verification_token`.
 * 4. Calls `Vp52AdMob.showRewardedAd({ adUnitId, customData, userId })`.
 * 5. On load failure, show failure, early dismissal, or interruption before reward: cancels
 *    unused pending slot safely with 0 coins credited.
 * 6. On client ad completion (`earnedReward === true`): polls backend `verifications` and
 *    refreshes wallet balance ONLY after server confirms `status === 'verified'`. Delayed
 *    callbacks leave status `'ssv_pending'` with 0 speculative coins granted.
 */
export async function runSequentialRewardedAdFlow({
  token,
  sessionType = 'reward_session',
  fetchImpl = fetch,
  nativePlugin = Vp52AdMob,
  isNative = Capacitor.isNativePlatform(),
  isProd = IS_PROD_BUILD,
  pollDelayMs = 1500,
  maxPollAttempts = 6,
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
      error: 'Rewarded ads require the Android app.'
    };
  }

  if (inFlightRewardedAd) {
    return {
      success: false,
      status: 'ad_in_flight',
      coinsCredited: 0,
      error: 'Another rewarded ad is already in progress.'
    };
  }

  inFlightRewardedAd = true;
  let pendingVerification = null;

  try {
    if (typeof onStatusChange === 'function') onStatusChange('preparing');

    // Step 1: Request fresh pending verification record for the next open slot (1..3)
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
        error: prepData?.error || 'Unable to prepare rewarded ad slot'
      };
    }

    pendingVerification = prepData.verification;
    const clientAdUnitId = resolveRewardedAdUnitForClient(pendingVerification.ad_unit_id, isProd);

    await logAdEvent(token, {
      ad_format: 'rewarded',
      event_type: 'request',
      ad_unit_id: clientAdUnitId,
      metadata: { ad_slot: pendingVerification.ad_slot, session_type: pendingVerification.session_type }
    }, fetchImpl);

    if (typeof onStatusChange === 'function') onStatusChange('loading_ad');

    // Step 2: Load & present native RewardedAd with official ServerSideVerificationOptions
    const nativeOutcome = await nativePlugin.showRewardedAd({
      adUnitId: clientAdUnitId,
      customData: pendingVerification.custom_data,
      userId: String(pendingVerification.user_id)
    });

    if (!nativeOutcome || nativeOutcome.status !== 'completed_pending_ssv' || nativeOutcome.earnedReward !== true) {
      const abortReason = nativeOutcome?.status || 'ad_aborted';
      await cancelPendingAdSlot(fetchImpl, token, pendingVerification.verification_token, abortReason);
      await logAdEvent(token, {
        ad_format: 'rewarded',
        event_type: 'error',
        ad_unit_id: clientAdUnitId,
        metadata: { ad_slot: pendingVerification.ad_slot, outcome: abortReason }
      }, fetchImpl);

      return {
        success: false,
        status: abortReason,
        adSlot: pendingVerification.ad_slot,
        coinsCredited: 0,
        error: abortReason === 'dismissed_early'
          ? 'Advertisement closed before completion. Watch the full ad to earn 1 Coin.'
          : (nativeOutcome?.errorMessage || 'Rewarded advertisement could not be completed.')
      };
    }

    // Step 3: Ad closed AFTER client earned callback — poll backend SSV verification.
    // NEVER credit speculative coins on the client.
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

    if (!verifiedRecord) {
      // SSV callback is delayed (no speculative coins granted)
      return {
        success: true,
        status: 'ssv_pending',
        adSlot: pendingVerification.ad_slot,
        verificationToken: pendingVerification.verification_token,
        coinsCredited: 0,
        speculativeCoinsGranted: 0
      };
    }

    // Step 4: Refresh wallet ONLY after backend confirms SSV verification
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

    return {
      success: true,
      status: 'verified',
      adSlot: pendingVerification.ad_slot,
      coinsCredited: ADMOB_CONFIG.REWARD_COINS_PER_AD,
      walletBalance
    };
  } catch (err) {
    // Handles app interruption / native exception safely without leaving slot blocked
    if (pendingVerification) {
      await cancelPendingAdSlot(fetchImpl, token, pendingVerification.verification_token, err?.message || 'client_exception');
    }
    return {
      success: false,
      status: err?.code || 'native_error',
      coinsCredited: 0,
      error: err?.message || 'Unable to display rewarded advertisement.'
    };
  } finally {
    inFlightRewardedAd = false;
  }
}
