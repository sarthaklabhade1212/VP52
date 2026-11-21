# VP52 Stage 5B.4 — Android Production Security & Google Play Readiness Report

**Project:** `/Users/sarthaklabhade/FREELANCING/5257`  
**Stage:** 5B.4 — Android Production Security & Google Play Readiness  
**Database SHA-256 Baseline (Unchanged):** `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`  
**Final Play Store Production Verdict:** **NOT READY FOR PRODUCTION RELEASE** *(blocked by active Google AdMob sample/test IDs and pending release signing credentials from the app owner; all local Android security, network, debug/release separation, and build checks pass)*

---

## 1. Pre-Edit State & Backups

Before modifying any project files, backups were created in:
- `backups/stage5b4-backup-2026-11-12/` (`12` backed-up files preserving relative paths).

Local SQLite database verification:
- [`server/db/rewards.db`](file:///Users/sarthaklabhade/FREELANCING/5257/server/db/rewards.db) SHA-256 verified before and after all work:
  `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a` (0 bytes modified).

---

## 2. Application Identity & Release Signing Verification

| Field | Status | Value / Evidence |
| :--- | :--- | :--- |
| **Application ID / Namespace** | **Preserved** | `com.sarthak.customerrewards` verified in [`build.gradle`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/build.gradle#L4-L8), merged release manifest, and [`capacitor.config.json`](file:///Users/sarthaklabhade/FREELANCING/5257/client/capacitor.config.json#L2). |
| **Upload Certificate SHA-1** | **Verified** | `53:EE:8E:71:E4:84:17:59:2D:12:ED:A1:ED:EB:3E:FB:DE:73:5B:2F` verified via `openssl x509` on [`vp52-upload-2026.pem`](file:///Users/sarthaklabhade/FREELANCING/5257/client/vp52-upload-2026.pem) (matching `client/vp52-upload-2026.jks`, which was preserved untouched). |
| **Signing Configuration** | **Preserved** | [`signingConfigs.release`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/build.gradle#L28-L41) reads `VP52_KEYSTORE_PATH`, `VP52_KEYSTORE_PASSWORD`, `VP52_KEY_ALIAS`, and `VP52_KEY_PASSWORD` strictly from environment variables. No passwords or keys were exposed or regenerated. |
| **Built AAB Signing State** | **Unsigned (Expected)** | `VP52_KEYSTORE_*` environment variables were unset in the local shell, so [`app-release.aab`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/build/outputs/bundle/release/app-release.aab) was built cleanly as an unsigned release bundle pending owner credentials at upload/signing time. |
| **Ignore Safeguards** | **Hardened** | Updated [`client/.gitignore`](file:///Users/sarthaklabhade/FREELANCING/5257/client/.gitignore) to ignore `*.jks`, `*.keystore`, `*.pem`, and `vp52-upload-certificate.pem`. |

---

## 3. Version Code & Version Name Update

Updated in [`client/android/app/build.gradle`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/build.gradle#L11-L12):
- `versionCode`: incremented from `2` $\rightarrow$ **`3`**
- `versionName`: updated from `"1.0.1"` $\rightarrow$ **`"1.0.2"`**

Verified in Gradle build outputs (`output-metadata.json` and merged `AndroidManifest.xml`).

---

## 4. Debug vs. Release Separation

Initial Part A audit identified a critical defect: although `client/dist/` was previously built with `https://api.vp52coin.com`, Android native assets in `client/android/app/src/main/assets/` still held an outdated **development** build (`http://10.0.2.2:5000`, `androidScheme: "http"`, `cleartext: true`), because [`package.json`](file:///Users/sarthaklabhade/FREELANCING/5257/client/package.json) mapped `"sync:android"` to `--mode development`.

Remediations applied:
1. **[`client/package.json`](file:///Users/sarthaklabhade/FREELANCING/5257/client/package.json#L6-L15):**
   - Added `"build:prod": "vite build --mode production"` and `"sync:android:prod": "vite build --mode production && npx cap sync android"`.
   - Switched default `"sync:android"` to production (`vite build --mode production && npx cap sync android`) and moved emulator sync to `"sync:android:dev"`.
2. **[`client/vite.config.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/vite.config.js#L16-L115):**
   - Retains `assertProductionApiUrl()` requiring HTTPS and rejecting `10.0.2.2`, `localhost`, `127.0.0.1`, `0.0.0.0`, and embedded credentials during `vite build --mode production`.
   - Explicitly sets `build.sourcemap: false` for production builds.
   - Tested failure guard: running `VITE_API_URL=http://10.0.2.2:5000 vite build --mode production` failed immediately with `[build] Production API must use HTTPS: http://10.0.2.2:5000`.
3. **[`client/src/utils/api.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/utils/api.js#L22-L47):**
   - Strengthened `resolveBaseUrl()` so production mode also enforces `parsed.protocol === 'https:'` at runtime alongside the `DEV_ONLY_HOSTS` check.
4. **Environment separation:**
   - [`client/.env.development`](file:///Users/sarthaklabhade/FREELANCING/5257/client/.env.development): `VITE_API_URL=http://10.0.2.2:5000` (debug/emulator only).
   - `client/.env.production`: `VITE_API_URL=https://api.vp52coin.com` (production only).

---

## 5. Android Network & WebView Security Hardening

Initial Part A audit found `android:usesCleartextTraffic="true"`, global cleartext overrides for `localhost`/`10.0.2.2`/`127.0.0.1` in `src/main/res/xml/network_security_config.xml`, and unconditional `WebSettings.MIXED_CONTENT_ALWAYS_ALLOW` in `MainActivity.java`.

Remediations applied:
1. **Release Manifest ([`client/android/app/src/main/AndroidManifest.xml`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/main/AndroidManifest.xml#L4-L13)):**
   - Set `android:usesCleartextTraffic="false"`.
   - Set `android:allowBackup="false"` to prevent ADB backup extraction of WebView storage/tokens.
2. **Release Network Security Config ([`client/android/app/src/main/res/xml/network_security_config.xml`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/main/res/xml/network_security_config.xml)):**
   - Removed all cleartext `<domain-config>` overrides from `src/main`. Enforces `<base-config cleartextTrafficPermitted="false">` with system CAs only.
3. **Debug-Only Overrides:**
   - Added [`client/android/app/src/debug/AndroidManifest.xml`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/debug/AndroidManifest.xml) (`usesCleartextTraffic="true"` via `tools:replace`) and [`client/android/app/src/debug/res/xml/network_security_config.xml`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/debug/res/xml/network_security_config.xml) (permits cleartext only for `localhost`, `10.0.2.2`, `127.0.0.1` in **debug** builds).
4. **WebView & Back Button Hardening ([`MainActivity.java`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/main/java/com/sarthak/customerrewards/MainActivity.java)):**
   - Enabled `buildFeatures { buildConfig = true }` in [`build.gradle`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/build.gradle#L24-L26).
   - Restricted `WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)` and `MIXED_CONTENT_ALWAYS_ALLOW` strictly to `BuildConfig.DEBUG`. Release builds enforce **`WebSettings.MIXED_CONTENT_NEVER_ALLOW`** and disable WebView remote debugging.
   - Confirmed zero permissive `TrustManager`, `HostnameVerifier`, or `onReceivedSslError` bypasses exist.
   - Added `OnBackPressedCallback` so hardware back navigates `webView.goBack()` when WebView history exists instead of abruptly exiting the app.

---

## 6. Capacitor Configuration Verification

Both [`client/capacitor.config.json`](file:///Users/sarthaklabhade/FREELANCING/5257/client/capacitor.config.json) and synced [`client/android/app/src/main/assets/capacitor.config.json`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/main/assets/capacitor.config.json) (as well as `base/assets/capacitor.config.json` inside `app-release.aab`) were verified after `npm --prefix client run sync:android:prod`:

```json
{
  "appId": "com.sarthak.customerrewards",
  "appName": "VP52",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "cleartext": false
  }
}
```

No dev server `url` is present.

---

## 7. AdMob Audit & Rewarded Ad Server-Side Guard

### 7.1 AdMob Configuration Status (`TEST / NOT PRODUCTION READY`)

All AdMob IDs currently active in the repository are **Google sample test IDs** (`ca-app-pub-3940256099942544~...` / `ca-app-pub-3940256099942544/...`). Per policy, **no production IDs were invented**:
- [`AndroidManifest.xml`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/main/AndroidManifest.xml#L40-L43) uses `${admobAppId}` from [`build.gradle`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/build.gradle#L15-L20), which reads `VP52_ADMOB_APP_ID` and falls back to test App ID `ca-app-pub-3940256099942544~3347511713` when unset.
- [`client/src/services/admobService.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/services/admobService.js#L13-L39) reads `VITE_ADMOB_*` env vars when provided, falls back to Google sample IDs when unset, and explicitly exports `IS_ADMOB_TEST_MODE = true` and `ADMOB_READINESS_STATUS = 'TEST / NOT PRODUCTION READY'` whenever any `ca-app-pub-3940256099942544` ID is active. Note also that `MainActivity.java` currently includes `play-services-ads:23.6.0` as a Gradle dependency, while [`admobService.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/services/admobService.js) uses sample native ad creatives and server diagnostic logging (`/api/customer/ad-event`).

**Required Production IDs from App Owner Before Play Store Release:**
1. `VP52_ADMOB_APP_ID` & `VITE_ADMOB_APP_ID` (and server `ADMOB_APP_ID`): real `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`
2. `VITE_ADMOB_NATIVE_AD_UNIT_ID` (and server `ADMOB_NATIVE_AD_UNIT_ID`): real `ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN`
3. `VITE_ADMOB_BANNER_AD_UNIT_ID` (and server `ADMOB_BANNER_AD_UNIT_ID`): real `ca-app-pub-XXXXXXXXXXXXXXXX/BBBBBBBBBB`
4. `VITE_ADMOB_REWARDED_AD_UNIT_ID` (and server `ADMOB_REWARDED_AD_UNIT_ID`): real `ca-app-pub-XXXXXXXXXXXXXXXX/RRRRRRRRRR`

### 7.2 Rewarded Ads Server-Side Validation Hardening

Part A audit detected two legacy endpoints in [`server/routes/customer.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js) (`POST /api/customer/watch-ad` and `POST /api/customer/reward-session/watch-ad`) that credited coins directly from a client POST request without server-side ad verification, as well as a fast-forward skip button in [`SimulatedAdModal.jsx`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/components/SimulatedAdModal.jsx).

Remediations applied (without altering 6-hour coin session rules or reward math):
- [`server/routes/customer.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js#L304-L315) (`POST /api/customer/watch-ad`) and [`server/routes/customer.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js#L1760-L1772) (`POST /api/customer/reward-session/watch-ad`) now **fail closed with HTTP `403 REWARDED_AD_VERIFICATION_REQUIRED`** unless a verified server-side AdMob SSV proof is present (`req.admobSsvVerified === true`). Client callbacks alone can no longer mint coins.
- Removed `handleFastForward` skip control from [`SimulatedAdModal.jsx`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/components/SimulatedAdModal.jsx).
- Active 6-hour earning sessions ([`POST /api/customer/coin-session/start`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js#L1190) and [`POST /api/customer/coin-session/complete`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js#L1345)) continue to enforce server-side wall-clock `expires_at` and atomic `reward_claimed = 0 -> 1` checks, while `/api/customer/ad-event` logs non-crediting diagnostics only.

---

## 8. Production Bundle, Gradle Build & AAB Scan Verification

1. **Client Production Build & Capacitor Sync (`npm --prefix client run sync:android:prod`):**
   - `vite v6.4.3` transformed `2,329` modules cleanly in `1.87s`; `npx cap sync android` synced `dist/` and production `capacitor.config.json` to `client/android`.
2. **Android Gradle Build (`./gradlew :app:processReleaseMainManifest :app:assembleDebug :app:bundleRelease --offline`):**
   - Built with JBR 21 (`jbr-21.0.11`) — **`BUILD SUCCESSFUL in 21s`**.
   - Produced `client/android/app/build/outputs/apk/debug/app-debug.apk` (`49M`, `versionCode 3`, `versionName 1.0.2`).
   - Produced `client/android/app/build/outputs/bundle/release/app-release.aab` (`35M`, `versionCode 3`, `versionName 1.0.2`).
3. **Bundle & AAB Content Scan:**
   - `grep -rn "10\.0\.2\.2:5000"` across `client/dist/`, `client/android/app/src/main/assets/`, and extracted `app-release.aab` `base/assets/public/`: **ZERO matches**.
   - `https://api.vp52coin.com` verified present in `client/dist/`, `client/android/app/src/main/assets/public/`, and `app-release.aab`.
   - Merged release manifest (`client/android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml`): verified `package="com.sarthak.customerrewards"`, `versionCode="3"`, `versionName="1.0.2"`, `android:usesCleartextTraffic="false"`, `android:allowBackup="false"`.
   - Merged debug manifest: verified `android:usesCleartextTraffic="true"` (debug only).
   - Packaged release `network_security_config.xml`: verified `<base-config cleartextTrafficPermitted="false">` with zero cleartext domains.

---

## 9. Verification Ledger (Executed vs. Static vs. Pending)

### A. Executed Automated Tests & Builds (Verified Fact)
- **`npm --prefix client run sync:android:prod`**: PASS (`1.87s` Vite production build + Capacitor Android sync).
- **Production URL Guard Negative Test (`VITE_API_URL=http://10.0.2.2:5000 vite build --mode production`)**: PASS (rejected build cleanly).
- **Android Gradle Build (`:app:processReleaseMainManifest`, `:app:assembleDebug`, `:app:bundleRelease`)**: PASS (`21s`, 363 tasks).
- **Isolated `/tmp` Backend Tests (run against scratch copy of DB, zero mutation to `server/db/rewards.db`):**
  - Stage 5B.4 Rewarded Ad Guard check (`/watch-ad` & `/reward-session/watch-ad` fail closed `403`, wallet balance unchanged): **PASS**.
  - [`test-admob-session-redemption.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-admob-session-redemption.js): **PASS (5/5 suites)**.
  - [`test-permanent-merchant-qr.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-permanent-merchant-qr.js): **PASS (16/16)**.
  - [`test-customer-google-auth.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-customer-google-auth.js): **PASS (25/25)**.
  - [`test-marketplace.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-marketplace.js): **PASS (12/12)**.
  - [`test-centralized-admin.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-centralized-admin.js): **PASS (15/15)**.
  - [`test-stage5b1-merchant-auth.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-stage5b1-merchant-auth.js): **PASS (6/6)**.
  - [`test-stage5b2-security.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-stage5b2-security.js): **PASS (5/5)**.
  - [`test-cleanup-safety.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-cleanup-safety.js): **PASS (6/6)**.
  - [`test-ad-reward-fix.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-ad-reward-fix.js): **PASS (4/4)**.
  - [`test-coin-session.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-coin-session.js): **PASS (5/5)**.
- **Client Utility Node Checks:** `admobService.js` test-mode flag (`TEST / NOT PRODUCTION READY`), `imageCompression.js` SVG rejection & dimension scaling (`4000x3000` $\rightarrow$ `1280x960`): **PASS**.

### B. Static / Code-Level Checks (Verified Fact via Inspection)
- `MainActivity.java`: `MIXED_CONTENT_NEVER_ALLOW` in release, `setWebContentsDebuggingEnabled(BuildConfig.DEBUG)`, `OnBackPressedCallback` history navigation, zero permissive `TrustManager` / SSL handlers.
- [`qrScanner.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/utils/qrScanner.js) & [`CameraQRScanner.jsx`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/components/CameraQRScanner.jsx): native ML Kit permission handling and live scanner fallback.
- [`googleAuth.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/utils/googleAuth.js): `@capgo/capacitor-social-login` ID-token retrieval verified statically against server `googleOAuth.js` verification.

### C. Pending Physical Device / Emulator Verification (`Not Executed`)
Running `adb devices -l` reported **no attached Android devices or booted emulators**. Therefore, the following runtime UI/device flows remain **pending on an Android device/emulator**:
- Cold launch, splash animation unmount, route transitions, and hardware back button behavior on Android WebView.
- Live debug (`10.0.2.2:5000`) vs HTTPS release (`https://api.vp52coin.com`) runtime connectivity from inside Android WebView.
- Live Android Customer Google Sign-In (`@capgo/capacitor-social-login` with Play App Signing SHA-1), Merchant login, and Admin login in the APK.
- Physical camera ML Kit QR scan-and-pay / scan-and-collect between two physical Android handsets.
- End-to-end camera/gallery photo capture & upload over HTTPS from Android WebView.

---

## 10. Remaining Google Play Store Release Requirements

Before generating the final uploadable AAB and submitting to Google Play Console:
1. **Replace Test AdMob IDs:** Supply real production AdMob App ID and Ad Unit IDs (`VP52_ADMOB_APP_ID`, `VITE_ADMOB_APP_ID`, `VITE_ADMOB_NATIVE_AD_UNIT_ID`, `VITE_ADMOB_BANNER_AD_UNIT_ID`, `VITE_ADMOB_REWARDED_AD_UNIT_ID`, plus server `ADMOB_*` variables), rebuild with `npm --prefix client run sync:android:prod`, and confirm `IS_ADMOB_TEST_MODE === false` (and implement live Google Mobile Ads native/rewarded SDK bridge + AdMob SSV callback if rewarded video ads are enabled).
2. **Sign Release `.aab`:** Export `VP52_KEYSTORE_PATH=client/vp52-upload-2026.jks`, `VP52_KEY_ALIAS`, `VP52_KEYSTORE_PASSWORD`, and `VP52_KEY_PASSWORD`, run `./gradlew :app:bundleRelease`, and verify `jarsigner` SHA-1 matches `53:EE:8E:71:E4:84:17:59:2D:12:ED:A1:ED:EB:3E:FB:DE:73:5B:2F`.
3. **Device / Two-Phone Physical QA:** Verify APK/AAB on an Android emulator and physical handset (including two-device QR scan, HTTPS API calls to `https://api.vp52coin.com` once deployed, Google Sign-In, and hardware back button).
4. **Google Play Console Declarations:** Complete Play Console Data Safety form, Advertising ID / AdMob declaration, target audience, privacy policy (`/privacy`), and account deletion URL (`/delete-account`).

---

## 11. Final Verdict

**VERDICT: `NOT READY FOR PRODUCTION RELEASE`**

Android configuration hardening, network security isolation, debug/release separation, WebView mixed-content protection, rewarded-ad server-side fail-closed validation, `versionCode 3` / `versionName 1.0.2` bump, production bundle sync, and unsigned release `.aab` generation are complete and verified. Production Play Store release remains blocked until real production AdMob IDs replace Google's sample `3940256099942544` IDs, the release `.aab` is signed with the upload keystore (`53:EE:8E:71:E4:84:17:59:2D:12:ED:A1:ED:EB:3E:FB:DE:73:5B:2F`), and live device/emulator runtime checks are executed.
