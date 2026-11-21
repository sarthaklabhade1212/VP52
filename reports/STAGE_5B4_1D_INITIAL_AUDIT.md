# VP52 Stage 5B.4.1D — Initial Read-Only Environment Audit

**Date:** 2026-11-13  
**Project:** VP52 — Customer Rewards Application  
**Audit Mode:** Strictly Read-Only  
**Local Workspace:** `/Users/sarthaklabhade/FREELANCING/5257`  
**Initial Canonical Database SHA-256:** `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a` (Verified Unchanged)

---

## 1. Audit Scope & Objectives

In accordance with Stage 5B.4.1D instructions, an initial read-only environment audit was performed across the backend, frontend, native Android codebase, database schema, and test architecture before initiating staging environment setup or configuration changes.

---

## 2. Findings on the 8 Key Architecture Dimensions

### 2.1 Current SSV Callback Routes
- **Primary Public SSV Endpoint:** `GET /api/admob/ssv` (implemented in [`server/routes/admob.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/admob.js)).
- **SSV Callback Alias:** `GET /api/admob/ssv-callback` (mirrors `/ssv` for AdMob console compatibility).
- **Customer Pre-Ad Slot Reservation:** `POST /api/customer/reward-session/prepare-ad` (in [`server/routes/customer.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js)) — creates an isolated pending record with an unguessable single-use `verification_token` (`VP52SSV_<base64url>`).
- **Customer Slot Release on Failure/Dismissal:** `POST /api/customer/reward-session/cancel-pending-ad` — marks un-earned pending records as `rejected` with 0 coins.
- **Customer Verification Status & History:** `GET /api/customer/reward-session/status` and `GET /api/customer/reward-session/verifications`.
- **Admin Configuration Diagnostics:** `GET /api/admin/advertisements/admob` (in [`server/routes/admin.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/admin.js)).
- **Client Fail-Closed Guards:** `POST /api/customer/watch-ad` and `POST /api/customer/reward-session/watch-ad` return HTTP 403 `REWARDED_AD_VERIFICATION_REQUIRED` (zero coins credited client-side).

### 2.2 Current Database Schema Requirements
The additive Stage 5B.4.1B/C schema requires two dedicated tables in SQLite:
1. `admob_ssv_verifications`:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `verification_token TEXT UNIQUE NOT NULL`
   - `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `session_type TEXT NOT NULL DEFAULT 'reward_session'` (`reward_session` | `vp52_coin_session`)
   - `session_id INTEGER NOT NULL`
   - `ad_slot INTEGER NOT NULL CHECK (ad_slot >= 1 AND ad_slot <= 3)`
   - `app_id TEXT NOT NULL`
   - `ad_unit_id TEXT NOT NULL`
   - `reward_item TEXT NOT NULL DEFAULT 'coin'`
   - `reward_amount INTEGER NOT NULL DEFAULT 1`
   - `status TEXT NOT NULL DEFAULT 'pending'` (`pending` | `verified` | `expired` | `rejected`)
   - `transaction_id TEXT UNIQUE`
   - `key_id TEXT`, `ssv_timestamp INTEGER`, `ad_network TEXT`, `signature_hash TEXT`, `payload_hash TEXT`, `ssv_raw_query TEXT`, `rejection_reason TEXT`
   - `expires_at DATETIME NOT NULL`, `verified_at DATETIME`, `created_at DATETIME`, `updated_at DATETIME`
   - **Indexes:**
     - `idx_admob_ssv_user_session` ON `(user_id, session_type, session_id, status)`
     - `idx_admob_ssv_token` ON `(verification_token)`
     - `idx_admob_ssv_expires` ON `(status, expires_at)`
     - `idx_admob_ssv_slot_verified` ON `(session_type, session_id, ad_slot) WHERE status = 'verified'` (partial unique index)
     - `idx_admob_ssv_slot_pending` ON `(session_type, session_id, ad_slot) WHERE status = 'pending'` (partial unique index)
2. `admob_ssv_audit_logs`:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `event_type TEXT NOT NULL`, `code TEXT NOT NULL`, `transaction_id TEXT`, `verification_token TEXT`, `user_id INTEGER`, `ad_unit_id TEXT`, `key_id TEXT`, `details TEXT`, `created_at DATETIME`
   - Index `idx_admob_ssv_audit_tx` ON `(transaction_id, created_at)`

### 2.3 Current Environment-Variable Names
- **Server:**
  - `PORT`: Listen port (default `5000`)
  - `NODE_ENV`: Runtime environment (`development`, `production`, `staging`)
  - `JWT_SECRET`: Mandatory cryptographic signing secret
  - `SEED_DEMO_DATA`: Auto-seed guard (`false` in production/staging)
  - `GOOGLE_WEB_CLIENT_ID`: Audience ID for Google Sign-In verification
  - `ADMOB_APP_ID`: Production AdMob App ID (`ca-app-pub-4004834464698326~8764285486`)
  - `ADMOB_REWARDED_AD_UNIT_ID`: Production Rewarded Ad Unit ID (`ca-app-pub-4004834464698326/8368553876`)
  - `ADMOB_SSV_PENDING_TTL_SECONDS`: Pending record expiration window (default `900` = 15 minutes)
  - `ADMOB_SSV_CALLBACK_URL`: Configured callback URL diagnostic setting
- **Client & Android:**
  - `VITE_API_URL`: Backend API origin (`http://10.0.2.2:5000` for Android emulator local dev, `https://...` for production/staging)
  - `VITE_ADMOB_APP_ID`, `VITE_ADMOB_REWARDED_AD_UNIT_ID`
  - `VP52_ADMOB_APP_ID`, `VP52_ADMOB_DEBUG_APP_ID`: Gradle manifest placeholders in `client/android/app/build.gradle`

### 2.4 Existing AdMob Production and Debug Configurations
- **Production Identifiers:**
  - App ID: `ca-app-pub-4004834464698326~8764285486`
  - Rewarded Ad Unit ID: `ca-app-pub-4004834464698326/8368553876` (numeric suffix: `8368553876`)
  - Unit Configuration: 1 coin reward, 6-hour session, 3 ads per session
- **Debug / Test Identifiers:**
  - Test App ID: `ca-app-pub-3940256099942544~3347511713`
  - Test Rewarded Ad Unit ID: `ca-app-pub-3940256099942544/5224354917` (Google sample rewarded ad unit)
- **Separation Mechanism:**
  - Android Gradle build enforces manifest placeholders: `debug` receives `debugAdmobAppId` (`3940256099942544~3347511713`), while `release` receives `releaseAdmobAppId` (`4004834464698326~8764285486`).
  - In `Vp52AdMobPlugin.java`, `!BuildConfig.DEBUG` strictly rejects sample test ad units (`ca-app-pub-3940256099942544*`).
  - In `admobService.js`, `resolveRewardedAdUnitForClient` forces the Google sample unit for non-production environments.

### 2.5 Existing Native SSV Custom-Data Implementation
- **Java Plugin:** [`client/android/app/src/main/java/com/sarthak/customerrewards/Vp52AdMobPlugin.java`](file:///Users/sarthaklabhade/FREELANCING/5257/client/android/app/src/main/java/com/sarthak/customerrewards/Vp52AdMobPlugin.java):
  - Wraps Google Mobile Ads SDK `com.google.android.gms:play-services-ads:23.6.0`.
  - Sets official `ServerSideVerificationOptions`:
    ```java
    ServerSideVerificationOptions ssvOptions = new ServerSideVerificationOptions.Builder()
            .setCustomData(customData)
            .setUserId(userId)
            .build();
    rewardedAd.setServerSideVerificationOptions(ssvOptions);
    ```
  - Enforces `AtomicBoolean adInFlight` single-flight lock.
  - Returns `completed_pending_ssv` on playback completion; does not credit coins locally.
- **Frontend Service:** [`client/src/services/admobService.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/services/admobService.js):
  - Enforces JavaScript mutex `inFlightRewardedAd`.
  - Coordinates `prepare-ad` -> native show -> `cancel-pending-ad` (on abort) -> SSV verification poll -> wallet refresh.

### 2.6 Existing Wallet & Coin-Ledger Transaction Logic
All crediting is executed atomically inside `db.transaction()`:
1. `admob_ssv_verifications`: Updated to `status = 'verified'`, recording Google's `transaction_id`, `key_id`, timestamps, and hashes.
2. `point_ledger`: Inserts atomic credit row (`source = 'admob_ssv'`, `points = 1`, `reference_id = verification.id`).
3. `coin_lots`: Inserts 1-coin Bronze batch (`source = 'AD_REWARD'`, `tier = 'Bronze'`, `coins_earned = 1`, `coins_remaining = 1`, `expires_at = datetime('now', '+30 days')`).
4. `wallets`: Updates `balance = balance + 1` and `total_earned = total_earned + 1`.
5. `reward_sessions` / `vp52_coin_sessions`: Increments `ads_watched += 1` and `coins_earned += 1`; sets `status = 'completed'` when `ads_watched >= 3`.
6. `admob_ssv_audit_logs`: Records `event_type = 'verified'`, `code = 'REWARD_CREDITED'`.
- Strict double-entry accounting guarantees zero coin inflation and zero client-side credit.

### 2.7 Current Session Creation & Three-Ad Enforcement
- Session duration is 6 hours (`SESSION_DURATION_HOURS = 6`).
- Max ads per session is 3 (`MAX_ADS_PER_SESSION = 3`).
- Reward per ad is exactly 1 coin (`SSV_REWARD_AMOUNT = 1`, `SSV_REWARD_ITEM = 'coin'`).
- `prepare-ad` checks existing records with `status IN ('pending', 'verified')`. If verified count or active slots reach 3, requests fail with `SESSION_AD_LIMIT_REACHED` or `ALL_SLOTS_ALLOCATED`.
- Partial indexes `idx_admob_ssv_slot_pending` and `idx_admob_ssv_slot_verified` prevent concurrent race conditions from allocating duplicate active slots.

### 2.8 Existing Backup and Test Database Mechanisms
- **Canonical Database:** `server/db/rewards.db` with SHA-256 `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`.
- **Test Database Isolation:** Test suites run against disposable scratch copies in `/tmp` using clean copies of `server/db/database.js`.
- **Online Backup API:** `db/backups/rewards_backup_*.db` created via better-sqlite3 `backup()` API.
- **Production Guard:** `server/db/seed.js` strictly refuses execution when `NODE_ENV=production`.

---

## 3. Audit Conclusion & Readiness for Staging

The local codebase is securely structured and fully prepared for isolated staging deployment:
- Production endpoints (`https://api.vp52coin.com`) and database (`/var/www/vp52/server/db/rewards.db`) remain untouched.
- Staging requires an isolated directory (`/Users/sarthaklabhade/FREELANCING/5257-staging`), an empty staging database with synthetic test accounts, staging environment templates, and fail-closed environment validation.
- Initial canonical database hash confirmed: `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`.
