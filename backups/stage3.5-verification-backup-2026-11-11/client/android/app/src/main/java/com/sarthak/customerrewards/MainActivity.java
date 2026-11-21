
package com.sarthak.customerrewards;

import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity
        implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Install the native Android splash screen before creating the activity.
        SplashScreen.installSplashScreen(this);

        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();

        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setMixedContentMode(
                    WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            );
            settings.setMediaPlaybackRequiresUserGesture(false);

            webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                private Bitmap defaultPoster;

                @Override
                public Bitmap getDefaultVideoPoster() {
                    if (defaultPoster == null) {
                        defaultPoster = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
                    }
                    return defaultPoster;
                }
            });

            webView.post(new Runnable() {
                @Override
                public void run() {
                    Log.i(
                            "VIPSOrigin",
                            "WebView origin = " + webView.getUrl()
                    );
                }
            });
        }

        Log.i(
                "VIPSOrigin",
                "Capacitor androidScheme = " + getBridge().getScheme()
        );
    }

    @Override
    public void onStart() {
        super.onStart();

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebSettings settings =
                    getBridge().getWebView().getSettings();

            settings.setMixedContentMode(
                    WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            );
            settings.setMediaPlaybackRequiresUserGesture(false);
        }
    }

    @Override
    public void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data
    ) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {

            PluginHandle pluginHandle =
                    getBridge().getPlugin("SocialLogin");

            if (pluginHandle == null) {
                Log.i(
                        "MainActivity",
                        "SocialLogin plugin handle is null"
                );
                return;
            }

            Plugin plugin = pluginHandle.getInstance();

            if (!(plugin instanceof SocialLoginPlugin)) {
                Log.i(
                        "MainActivity",
                        "Plugin instance is not SocialLoginPlugin"
                );
                return;
            }

            ((SocialLoginPlugin) plugin)
                    .handleGoogleLoginIntent(requestCode, data);
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Required by the Social Login plugin.
    }
}
