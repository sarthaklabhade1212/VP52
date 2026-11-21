package com.sarthak.customerrewards;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;

import java.util.Collections;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Native Google Mobile Ads Rewarded Ad Plugin for VP52 with Server-Side Verification (SSV).
 *
 * Security invariants:
 * - Never grants or reports client-invented coin balances as authoritative rewards.
 * - Requires server-issued `customData` (verification_token) and `userId` on every show call.
 * - Attaches ServerSideVerificationOptions prior to presentation.
 * - Enforces a single-flight lock so no overlapping rewarded ad load/show can occur.
 * - Rejects test ad unit IDs in release builds (BuildConfig.DEBUG == false).
 */
@CapacitorPlugin(name = "Vp52AdMob")
public class Vp52AdMobPlugin extends Plugin {

    private static final String TAG = "Vp52AdMobPlugin";
    private static final String GOOGLE_TEST_PREFIX = "ca-app-pub-3940256099942544";

    private final AtomicBoolean sdkInitialized = new AtomicBoolean(false);
    private final AtomicBoolean adInFlight = new AtomicBoolean(false);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private RewardedAd activeRewardedAd = null;
    private PluginCall activeCall = null;
    private boolean activeEarnedReward = false;

    @PluginMethod
    public void initialize(PluginCall call) {
        mainHandler.post(() -> {
            try {
                if (sdkInitialized.compareAndSet(false, true)) {
                    if (BuildConfig.DEBUG) {
                        RequestConfiguration reqConfig = new RequestConfiguration.Builder()
                                .setTestDeviceIds(Collections.singletonList(AdRequest.DEVICE_ID_EMULATOR))
                                .build();
                        MobileAds.setRequestConfiguration(reqConfig);
                    }
                    MobileAds.initialize(getContext(), initializationStatus -> {
                        JSObject ret = new JSObject();
                        ret.put("initialized", true);
                        ret.put("isDebug", BuildConfig.DEBUG);
                        call.resolve(ret);
                    });
                } else {
                    JSObject ret = new JSObject();
                    ret.put("initialized", true);
                    ret.put("isDebug", BuildConfig.DEBUG);
                    call.resolve(ret);
                }
            } catch (Exception ex) {
                sdkInitialized.set(false);
                call.reject("Failed to initialize Google Mobile Ads SDK: " + ex.getMessage(), "INIT_FAILED");
            }
        });
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isNative", true);
        ret.put("sdkInitialized", sdkInitialized.get());
        ret.put("isAdInFlight", adInFlight.get());
        ret.put("isDebugBuild", BuildConfig.DEBUG);
        call.resolve(ret);
    }

    @PluginMethod
    public void showRewardedAd(PluginCall call) {
        final String adUnitId = call.getString("adUnitId", "").trim();
        final String customData = call.getString("customData", "").trim();
        final String userId = call.getString("userId", "").trim();

        if (adUnitId.isEmpty()) {
            call.reject("Missing rewarded adUnitId", "MISSING_AD_UNIT");
            return;
        }
        if (customData.isEmpty()) {
            call.reject("Missing server-issued SSV customData token", "MISSING_CUSTOM_DATA");
            return;
        }
        if (userId.isEmpty()) {
            call.reject("Missing authenticated userId for SSV binding", "MISSING_USER_ID");
            return;
        }
        if (!BuildConfig.DEBUG && adUnitId.startsWith(GOOGLE_TEST_PREFIX)) {
            call.reject("Test AdMob ad unit ID cannot be used in release builds", "TEST_ID_IN_RELEASE");
            return;
        }

        if (!adInFlight.compareAndSet(false, true)) {
            call.reject("Another rewarded ad is currently loading or showing", "AD_IN_FLIGHT");
            return;
        }

        mainHandler.post(() -> {
            Activity activity = getActivity();
            if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
                adInFlight.set(false);
                call.reject("Host Android activity unavailable", "ACTIVITY_UNAVAILABLE");
                return;
            }

            if (sdkInitialized.compareAndSet(false, true)) {
                if (BuildConfig.DEBUG) {
                    RequestConfiguration reqConfig = new RequestConfiguration.Builder()
                            .setTestDeviceIds(Collections.singletonList(AdRequest.DEVICE_ID_EMULATOR))
                            .build();
                    MobileAds.setRequestConfiguration(reqConfig);
                }
                MobileAds.initialize(getContext(), initializationStatus ->
                        loadAndShowRewardedAd(activity, call, adUnitId, customData, userId));
            } else {
                loadAndShowRewardedAd(activity, call, adUnitId, customData, userId);
            }
        });
    }

    private void loadAndShowRewardedAd(
            @NonNull Activity activity,
            @NonNull PluginCall call,
            @NonNull String adUnitId,
            @NonNull String customData,
            @NonNull String userId
    ) {
        activeCall = call;
        activeEarnedReward = false;
        activeRewardedAd = null;

        AdRequest adRequest = new AdRequest.Builder().build();
        RewardedAd.load(activity, adUnitId, adRequest, new RewardedAdLoadCallback() {
            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                Log.w(TAG, "Rewarded ad failed to load: code=" + loadAdError.getCode() + " msg=" + loadAdError.getMessage());
                JSObject result = new JSObject();
                result.put("status", "failed_to_load");
                result.put("earnedReward", false);
                result.put("errorCode", loadAdError.getCode());
                result.put("errorMessage", loadAdError.getMessage());
                settleActiveCall(result);
            }

            @Override
            public void onAdLoaded(@NonNull RewardedAd rewardedAd) {
                if (activity.isFinishing() || activity.isDestroyed()) {
                    JSObject result = new JSObject();
                    result.put("status", "interrupted");
                    result.put("earnedReward", false);
                    settleActiveCall(result);
                    return;
                }

                activeRewardedAd = rewardedAd;

                // Attach official Google AdMob SSV options (custom_data & user_id)
                ServerSideVerificationOptions ssvOptions = new ServerSideVerificationOptions.Builder()
                        .setCustomData(customData)
                        .setUserId(userId)
                        .build();
                rewardedAd.setServerSideVerificationOptions(ssvOptions);

                rewardedAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                    @Override
                    public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                        Log.w(TAG, "Rewarded ad failed to show: code=" + adError.getCode() + " msg=" + adError.getMessage());
                        JSObject result = new JSObject();
                        result.put("status", "failed_to_show");
                        result.put("earnedReward", false);
                        result.put("errorCode", adError.getCode());
                        result.put("errorMessage", adError.getMessage());
                        settleActiveCall(result);
                    }

                    @Override
                    public void onAdShowedFullScreenContent() {
                        Log.d(TAG, "Rewarded ad full-screen content shown");
                    }

                    @Override
                    public void onAdDismissedFullScreenContent() {
                        Log.d(TAG, "Rewarded ad dismissed; earnedReward=" + activeEarnedReward);
                        JSObject result = new JSObject();
                        result.put("status", activeEarnedReward ? "completed_pending_ssv" : "dismissed_early");
                        result.put("earnedReward", activeEarnedReward);
                        // Coins are NEVER credited on the client; backend waits for Google SSV callback.
                        settleActiveCall(result);
                    }
                });

                rewardedAd.show(activity, rewardItem -> {
                    // Track client-side completion strictly as a lifecycle signal to poll backend SSV.
                    // Never trust rewardItem.getAmount() or mint coins client-side.
                    activeEarnedReward = true;
                    Log.d(TAG, "Rewarded ad earned callback received; awaiting dismissal & backend SSV");
                });
            }
        });
    }

    private void settleActiveCall(@NonNull JSObject result) {
        PluginCall callToResolve = activeCall;
        activeRewardedAd = null;
        activeCall = null;
        adInFlight.set(false);
        if (callToResolve != null) {
            callToResolve.resolve(result);
        }
    }

    @Override
    protected void handleOnDestroy() {
        PluginCall dangling = activeCall;
        boolean earned = activeEarnedReward;
        activeRewardedAd = null;
        activeCall = null;
        activeEarnedReward = false;
        adInFlight.set(false);
        if (dangling != null) {
            JSObject result = new JSObject();
            result.put("status", "interrupted");
            result.put("earnedReward", earned);
            dangling.resolve(result);
        }
        super.handleOnDestroy();
    }
}
