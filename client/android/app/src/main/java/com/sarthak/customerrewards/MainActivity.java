package com.sarthak.customerrewards;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();

        if (webView != null) {
            WebSettings settings = webView.getSettings();

            // LOCAL DEVELOPMENT ONLY:
            // Allow https://localhost to call the local HTTP backend
            // at http://10.0.2.2:5000.
            settings.setMixedContentMode(
                    WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            );
        }
    }
}