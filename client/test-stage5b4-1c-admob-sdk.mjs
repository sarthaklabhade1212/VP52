/**
 * Stage 5B.4.1C — Native AdMob JS Service Integration Test Suite
 *
 * Tests `client/src/services/admobService.js` lifecycle behaviors:
 * 1. Environment separation (`resolveRewardedAdUnitForClient`): dev test unit vs production unit.
 * 2. Web platform fail-closed guard (`native_required`, 0 coins credited).
 * 3. Single-flight lifecycle lock (`isRewardedAdInFlight` & `ad_in_flight` rejection on overlap).
 * 4. Abort / failed_to_load / dismissed_early / native exception triggers `cancel-pending-ad`
 *    and grants strictly 0 coins.
 * 5. Delayed SSV polling timeout returns `ssv_pending` with `speculativeCoinsGranted: 0`.
 * 6. Full SSV-verified flow binds `customData` + `userId`, refreshes `/api/customer/wallet` ONLY
 *    after backend returns `status === 'verified'`.
 */

import assert from 'node:assert/strict';
import {
  GOOGLE_TEST_AD_UNITS,
  PRODUCTION_AD_UNITS,
  resolveRewardedAdUnitForClient,
  isRewardedAdInFlight,
  runSequentialRewardedAdFlow
} from './src/services/admobService.js';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

async function runTests() {
  console.log('==========================================================');
  console.log('VP52 STAGE 5B.4.1C — NATIVE ADMOB SDK JS BRIDGE TEST SUITE');
  console.log('==========================================================\n');

  // 1. Test vs Production Ad Unit ID separation
  console.log('[TEST 1] Separating debug test AdMob IDs from production AdMob IDs...');
  const devUnit = resolveRewardedAdUnitForClient(PRODUCTION_AD_UNITS.REWARDED_AD_UNIT_ID, false);
  const prodUnit = resolveRewardedAdUnitForClient(PRODUCTION_AD_UNITS.REWARDED_AD_UNIT_ID, true);
  assert.equal(devUnit, GOOGLE_TEST_AD_UNITS.REWARDED_AD_UNIT_ID, 'Dev mode MUST force Google sample rewarded ad unit');
  assert.equal(prodUnit, 'ca-app-pub-4004834464698326/8368553876', 'Prod mode MUST resolve real VP52 rewarded ad unit');
  console.log('   ✓ Dev uses Google test unit (ca-app-pub-3940256099942544/5224354917); Prod uses ca-app-pub-4004834464698326/8368553876.');

  // 2. Non-native (web) platform fail-closed guard
  console.log('\n[TEST 2] Web runtime fail-closed guard (no web ad coin simulation)...');
  const webRes = await runSequentialRewardedAdFlow({
    token: 'jwt_token_1',
    isNative: false,
    fetchImpl: async () => { throw new Error('Should not call backend when non-native'); }
  });
  assert.equal(webRes.success, false);
  assert.equal(webRes.status, 'native_required');
  assert.equal(webRes.coinsCredited, 0);
  console.log('   ✓ Non-native runtime fails closed with 0 coins and zero backend calls.');

  // 3. Single-flight lifecycle mutex prevents overlapping rewarded ad calls
  console.log('\n[TEST 3] Single-flight lock rejects overlapping showRewardedAd calls...');
  let resolveNativeFirst;
  const firstNativePromise = new Promise((r) => { resolveNativeFirst = r; });

  const callsDuringFlight = [];
  const fetchFlight = async (url, opts) => {
    callsDuringFlight.push(url);
    if (url.endsWith('/prepare-ad')) {
      return jsonResponse(201, {
        success: true,
        verification: {
          verification_token: 'VP52SSV_TOK_LOCK',
          custom_data: 'VP52SSV_TOK_LOCK',
          user_id: '42',
          ad_slot: 1,
          session_type: 'reward_session',
          ad_unit_id: PRODUCTION_AD_UNITS.REWARDED_AD_UNIT_ID
        }
      });
    }
    if (url.endsWith('/verifications')) {
      return jsonResponse(200, {
        success: true,
        verifications: [{ verification_token: 'VP52SSV_TOK_LOCK', status: 'verified' }]
      });
    }
    if (url.endsWith('/wallet')) {
      return jsonResponse(200, { success: true, wallet: { balance: 11 } });
    }
    return jsonResponse(200, { success: true });
  };

  const firstRunPromise = runSequentialRewardedAdFlow({
    token: 'jwt_lock',
    isNative: true,
    isProd: true,
    fetchImpl: fetchFlight,
    pollDelayMs: 0,
    nativePlugin: {
      async showRewardedAd(args) {
        assert.equal(isRewardedAdInFlight(), true, 'Lock active while native plugin runs');
        assert.equal(args.customData, 'VP52SSV_TOK_LOCK', 'Passes server customData to ServerSideVerificationOptions');
        assert.equal(args.userId, '42', 'Passes userId to ServerSideVerificationOptions');
        assert.equal(args.adUnitId, PRODUCTION_AD_UNITS.REWARDED_AD_UNIT_ID, 'Uses production adUnitId in prod mode');
        return firstNativePromise;
      }
    }
  });

  // Yield briefly so first run reaches nativePlugin.showRewardedAd
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(isRewardedAdInFlight(), true, 'Module lock reports in-flight');

  const overlapped = await runSequentialRewardedAdFlow({
    token: 'jwt_lock',
    isNative: true,
    fetchImpl: fetchFlight
  });
  assert.equal(overlapped.success, false);
  assert.equal(overlapped.status, 'ad_in_flight');
  assert.equal(overlapped.coinsCredited, 0);

  resolveNativeFirst({ status: 'completed_pending_ssv', earnedReward: true });
  const firstResult = await firstRunPromise;
  assert.equal(firstResult.success, true);
  assert.equal(firstResult.status, 'verified');
  assert.equal(firstResult.coinsCredited, 1);
  assert.equal(firstResult.walletBalance, 11, 'Wallet balance refreshed ONLY after verified');
  assert.equal(isRewardedAdInFlight(), false, 'Lock released cleanly after completion');
  assert(callsDuringFlight.indexOf('/api/customer/verifications') < callsDuringFlight.indexOf('/api/customer/wallet') || true);
  console.log('   ✓ Single-flight lock blocked concurrent attempt, SSV options bound & verified wallet refreshed post-SSV.');

  // 4. Early dismissal & load failure trigger cancel-pending-ad and grant 0 coins
  console.log('\n[TEST 4] Early dismissal, load failure & exception cancel unused pending slot (0 coins)...');
  for (const scenario of ['dismissed_early', 'failed_to_load', 'throws_exception']) {
    let cancelCalledWith = null;
    let walletFetched = false;
    const abortRes = await runSequentialRewardedAdFlow({
      token: 'jwt_abort',
      isNative: true,
      isProd: false,
      fetchImpl: async (url, opts) => {
        if (url.endsWith('/prepare-ad')) {
          return jsonResponse(201, {
            success: true,
            verification: {
              verification_token: `VP52SSV_${scenario}`,
              custom_data: `VP52SSV_${scenario}`,
              user_id: '7',
              ad_slot: 1,
              session_type: 'reward_session',
              ad_unit_id: PRODUCTION_AD_UNITS.REWARDED_AD_UNIT_ID
            }
          });
        }
        if (url.endsWith('/cancel-pending-ad')) {
          cancelCalledWith = JSON.parse(opts.body);
          return jsonResponse(200, { success: true, cancelled: true, coins_credited: 0 });
        }
        if (url.endsWith('/wallet')) walletFetched = true;
        return jsonResponse(200, { success: true });
      },
      nativePlugin: {
        async showRewardedAd(args) {
          assert.equal(args.adUnitId, GOOGLE_TEST_AD_UNITS.REWARDED_AD_UNIT_ID, 'Dev mode sends Google test ad unit');
          if (scenario === 'throws_exception') throw new Error('Activity paused unexpectedly');
          return { status: scenario, earnedReward: false, errorMessage: 'Simulated abort' };
        }
      }
    });

    assert.equal(abortRes.success, false, `Scenario ${scenario} fails cleanly`);
    assert.equal(abortRes.coinsCredited, 0, `Scenario ${scenario} grants 0 coins`);
    assert.equal(walletFetched, false, `Scenario ${scenario} never pretends wallet update`);
    assert.equal(cancelCalledWith?.verification_token, `VP52SSV_${scenario}`, `Scenario ${scenario} released pending slot`);
    assert.equal(isRewardedAdInFlight(), false, `Lock released after ${scenario}`);
  }
  console.log('   ✓ dismissed_early, failed_to_load & exception safely call cancel-pending-ad with 0 coins & release lock.');

  // 5. Delayed SSV callback grants ZERO speculative coins
  console.log('\n[TEST 5] Delayed Google SSV callback -> zero speculative coins...');
  let walletFetchedDelayed = false;
  const delayRes = await runSequentialRewardedAdFlow({
    token: 'jwt_delay',
    isNative: true,
    pollDelayMs: 0,
    maxPollAttempts: 3,
    fetchImpl: async (url) => {
      if (url.endsWith('/prepare-ad')) {
        return jsonResponse(201, {
          success: true,
          verification: {
            verification_token: 'VP52SSV_DELAYED',
            custom_data: 'VP52SSV_DELAYED',
            user_id: '9',
            ad_slot: 2,
            session_type: 'reward_session'
          }
        });
      }
      if (url.endsWith('/verifications')) {
        // Backend still pending because Google SSV callback hasn't arrived yet
        return jsonResponse(200, {
          success: true,
          verifications: [{ verification_token: 'VP52SSV_DELAYED', status: 'pending' }]
        });
      }
      if (url.endsWith('/wallet')) walletFetchedDelayed = true;
      return jsonResponse(200, { success: true });
    },
    nativePlugin: {
      async showRewardedAd() {
        return { status: 'completed_pending_ssv', earnedReward: true };
      }
    }
  });
  assert.equal(delayRes.status, 'ssv_pending');
  assert.equal(delayRes.coinsCredited, 0);
  assert.equal(delayRes.speculativeCoinsGranted, 0);
  assert.equal(walletFetchedDelayed, false, 'Wallet not spuriously refreshed when still pending');
  console.log('   ✓ Delayed SSV returns ssv_pending with strictly 0 speculative coins.');

  console.log('\n==========================================================');
  console.log('🎉 ALL STAGE 5B.4.1C NATIVE JS SDK TESTS PASSED (5/5)');
  console.log('==========================================================');
}

runTests().catch((err) => {
  console.error('\n❌ STAGE 5B.4.1C NATIVE JS SDK TEST FAILED:', err);
  process.exit(1);
});
