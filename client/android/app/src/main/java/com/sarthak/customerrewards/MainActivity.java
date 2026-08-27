package com.sarthak.customerrewards;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity
        implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final WebView webView = getBridge().getWebView();

        if (webView != null) {
            WebSettings settings = webView.getSettings();

            // LOCAL DEVELOPMENT: the dev build serves the app from http://localhost
            // (see server.androidScheme in capacitor.config.json), so calls to the
            // local backend at http://10.0.2.2:5000 are http -> http and are NOT
            // mixed content. This override is kept only as a harmless safety net; it
            // is a no-op for the http origin, and inert in a production https build
            // (where the API is https).
            settings.setMixedContentMode(
                    WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            );
        }

        // TEMPORARY DIAGNOSTIC (safe to ship; remove once verified): log ONLY the
        // Capacitor scheme and the resolved WebView origin, so the INSTALLED APK can
        // be confirmed to serve from http://localhost. This NEVER logs access tokens,
        // ID tokens, JWTs, credential objects, or request/response bodies.
        Log.i("VIPSOrigin", "Capacitor androidScheme = " + getBridge().getScheme());
        if (webView != null) {
            webView.post(new Runnable() {
                @Override
                public void run() {
                    Log.i("VIPSOrigin", "WebView origin = " + webView.getUrl());
                }
            });
        }
    }

    // Required by @capgo/capacitor-social-login (v8.x): the Google authorization
    // flow (used when scopes are requested) returns through Activity results.
    // We forward those results into the SocialLogin plugin. Without this bridge
    // the plugin rejects with:
    //   "You CANNOT use scopes without modifying the main activity."
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle == null) {
                Log.i("MainActivity", "SocialLogin plugin handle is null");
                return;
            }
            Plugin plugin = pluginHandle.getInstance();
            if (!(plugin instanceof SocialLoginPlugin)) {
                Log.i("MainActivity", "Plugin instance is not SocialLoginPlugin");
                return;
            }
            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    // Marker method required by ModifiedMainActivityForSocialLoginPlugin.
    // Intentionally empty: its presence signals to the plugin that this
    // Activity has been correctly wired for Google authorization results.
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
