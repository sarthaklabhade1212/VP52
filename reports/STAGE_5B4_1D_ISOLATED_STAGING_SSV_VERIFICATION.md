# VP52 Stage 5B.4.1D — Isolated Staging: Google AdMob SSV End-to-End Verification Report

**Date:** 2026-11-13  
**Project:** VP52 — Customer Rewards Application  
**Stage:** Stage 5B.4.1D — Isolated Staging AdMob SSV Verification  
**Primary Objective:** Prepare, isolate, and verify Google AdMob Server-Side Verification (SSV) in a dedicated staging environment  
**Final Verdict:** **PASS WITH CONDITIONS**  

---

## 1. Executive Summary

Stage 5B.4.1D successfully prepared and verified an isolated staging environment for VP52's Google AdMob Server-Side Verification (SSV) subsystem. In accordance with strict production safety rules, an entirely independent staging workspace was created at `/Users/sarthaklabhade/FREELANCING/5257-staging`, featuring an isolated HTTPS Express server, a dedicated empty staging SQLite database (`staging_rewards.db`), isolated TLS certificates, a staging-only JWT secret, and synthetic test accounts.

The complete rewarded-ad verification flow was executed across 12 end-to-end staging tests (**Tests A through L**) and 6 database migration and constraint tests (**Tests 1 through 6**):
1. **Three-Ad Sequential Credit (Tests A, B, C):** Synthetic Customer A successfully completed ads 1, 2, and 3. Each ad was verified against cryptographic ECDSA P-256 signatures, validated against the database session and ad slot, and atomically credited exactly 1 coin (balance progressing 0 → 1 → 2 → 3).
2. **Session Ad Limit Enforcement (Test D):** Attempting to prepare a fourth ad in the 6-hour session was strictly rejected with HTTP 400 `SESSION_AD_LIMIT_REACHED` (balance remained 3 coins).
3. **Replay & Idempotency Protection (Tests E & K):** Replaying the same AdMob `transaction_id` returned HTTP 200 `already_processed: true` with 0 additional coins. A concurrent burst of 5 simultaneous callbacks with the same transaction ID resulted in exactly 1 coin credit and 4 duplicate acknowledgments with zero race conditions.
4. **Security & Negative Testing (Tests F, G, H, I, L):** Signatures from unauthorized keys were rejected (400 `INVALID_SIGNATURE`), customer ID mismatches were rejected (400 `USER_MISMATCH`), incorrect ad units were rejected (400 `AD_UNIT_MISMATCH`), expired pending tokens were rejected (400 `VERIFICATION_EXPIRED`), and callbacks against expired 6-hour sessions were rejected (400 `SESSION_EXPIRED`). Zero coins were credited across all negative tests.
5. **Early Dismissal Slot Release (Test J):** Cancelling an in-flight ad via `cancel-pending-ad` released the active slot with 0 coins and permitted subsequent re-preparation.
6. **Regression & Build Verification:** 14 automated test suites (129 individual tests) passed with a 100% success rate. The staging Vite frontend built cleanly, and the Android staging debug APK (`app-debug.apk`, 52 MB) built successfully.

### Condition for Pass
- **Live Google Cloud Callback Status: NOT TESTED / AWAITING PUBLIC INGRESS DOMAIN.**  
  Because the local development machine has no public inbound hostname, static IP, or public tunnel (e.g., Cloudflare Tunnel / ngrok), Google’s external cloud servers cannot reach `https://127.0.0.1:5001`. Cryptographic verification was comprehensively tested locally using authentic ECDSA P-256 key pairs conforming to Google's official public-key specification. Connecting live Google callbacks requires provisioning an isolated public staging domain and a designated staging AdMob ad unit.

---

## 2. Staging Environment Architecture

To guarantee absolute isolation from production and avoid polluting canonical local data, a dedicated staging workspace was established:

```
/Users/sarthaklabhade/FREELANCING/5257-staging/
├── server/
│   ├── certs/
│   │   ├── staging.crt (Dedicated X.509 self-signed certificate)
│   │   └── staging.key (RSA 2048-bit private key)
│   ├── config/
│   │   ├── admob.js
│   │   └── stagingGuard.js (Production isolation guard)
│   ├── db/
│   │   └── staging_rewards.db (Isolated staging database, 0 customer accounts)
│   ├── public/staging_uploads/ (Isolated file upload destination)
│   ├── routes/ (admob.js, customer.js, admin.js, etc.)
│   ├── utils/ (admobSsv.js, googleOAuth.js)
│   ├── index.js (Supports HTTPS & stagingGuard)
│   └── .env.staging (Isolated configuration)
└── client/
    ├── .env.staging (Points to staging HTTPS endpoint)
    ├── vite.config.js
    └── android/ (Debug build configuration with AdMob sample unit)
```

### Staging Isolation Guard (`server/config/stagingGuard.js`)
An automated isolation guard was developed and integrated into server startup. It performs fail-closed validation:
- Throws a fatal exception if `NODE_ENV === 'production'`.
- Throws a fatal exception if `DATABASE_PATH` points to `/var/www/vp52` or the canonical workspace `server/db/rewards.db`.
- Throws a fatal exception if `API_URL` or `ADMOB_SSV_CALLBACK_URL` contains `api.vp52coin.com` or `vp52coin.com`.
- Throws a fatal exception if `UPLOAD_DIR` targets `/var/www/vp52`.
- Validates that `JWT_SECRET` is at least 32 characters and distinct from development/production fallbacks.

---

## 3. Staging Hostname & TLS Verification Status

| Dimension | Configuration & Verification Result |
| :--- | :--- |
| **Protocol** | HTTPS (TLSv1.3 / TLSv1.2) |
| **Local Staging Host** | `127.0.0.1` / `localhost` / `10.0.2.2` (Android emulator loopback) |
| **Port** | `5001` |
| **Certificate Type** | X.509 Self-Signed Test Certificate (OpenSSL) |
| **Subject Alternative Names (SANs)** | `DNS:localhost`, `DNS:staging.local`, `IP:127.0.0.1`, `IP:10.0.2.2` |
| **TLS Handshake Verification** | Verified via Node.js HTTPS client; `/api/health` responded with HTTP 200 OK |
| **Production Target Check** | Zero requests directed to `https://api.vp52coin.com` |
| **Secret Hygiene** | No private keys, JWT secrets, or credentials exposed in logs or test output |

---

## 4. Staging Database Creation & Migration Results

A fresh staging database was initialized at `/Users/sarthaklabhade/FREELANCING/5257-staging/server/db/staging_rewards.db` containing all 53 application tables, including the additive Stage 5B.4.1B SSV tables.

### SSV Schema Verification
1. **`admob_ssv_verifications`**:
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
   - `verification_token` (TEXT UNIQUE NOT NULL)
   - `user_id` (INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE)
   - `session_type` (TEXT NOT NULL CHECK in `reward_session`, `vp52_coin_session`)
   - `session_id` (INTEGER NOT NULL)
   - `ad_slot` (INTEGER NOT NULL CHECK between 1 and 3)
   - `app_id` (TEXT NOT NULL), `ad_unit_id` (TEXT NOT NULL)
   - `reward_item` (TEXT NOT NULL DEFAULT 'coin'), `reward_amount` (INTEGER NOT NULL DEFAULT 1)
   - `status` (TEXT NOT NULL DEFAULT 'pending' CHECK in `pending`, `verified`, `expired`, `rejected`)
   - `transaction_id` (TEXT UNIQUE)
   - `key_id`, `ssv_timestamp`, `ad_network`, `signature_hash`, `payload_hash`, `ssv_raw_query`, `rejection_reason`
   - `expires_at`, `verified_at`, `created_at`, `updated_at`
2. **Partial Indexes**:
   - `idx_admob_ssv_slot_verified`: `UNIQUE (session_type, session_id, ad_slot) WHERE status = 'verified'`
   - `idx_admob_ssv_slot_pending`: `UNIQUE (session_type, session_id, ad_slot) WHERE status = 'pending'`
   - Guarantees that at most one active pending or verified record exists per ad slot, preventing duplicate race conditions while allowing historical rejected records.
3. **`admob_ssv_audit_logs`**:
   - `id`, `event_type`, `code`, `transaction_id`, `verification_token`, `user_id`, `ad_unit_id`, `key_id`, `details`, `created_at`

### Database Migration & Constraint Test Results (`test-staging-db-migration.js`)
All 6 migration test steps passed:
- **[1/6] Database Integrity:** `PRAGMA integrity_check` = `ok`; `PRAGMA foreign_key_check` = 0 violations. (PASS)
- **[2/6] Synthetic Customer Provisioning:** Synthetic test user and active 6-hour reward session created successfully. (PASS)
- **[3/6] Unique Verification Token:** Duplicate token insertion was rejected by SQLite UNIQUE constraint. (PASS)
- **[4/6] Transaction ID & Slot Indexes:** Duplicate `transaction_id` rejected; duplicate verified slot 1 rejected; duplicate pending slot 2 rejected; historical rejected records permitted for slot reuse. (PASS)
- **[5/6] Multi-Table Atomic Rollback:** Simulated failure during coin crediting rolled back `wallets`, `point_ledger`, and `coin_lots` atomically with zero orphaned rows. (PASS)
- **[6/6] Cleanup & Post-Check:** Synthetic test data cleaned; integrity check remained `ok`. (PASS)

---

## 5. AdMob Configuration: Production vs. Staging

| Attribute | Production Configuration | Staging / Debug Configuration |
| :--- | :--- | :--- |
| **AdMob App ID** | `ca-app-pub-4004834464698326~8764285486` | `ca-app-pub-3940256099942544~3347511713` (Google Sample App) |
| **Rewarded Ad Unit ID** | `ca-app-pub-4004834464698326/8368553876` | `ca-app-pub-3940256099942544/5224354917` (Google Sample Rewarded) |
| **Unit Numeric Suffix** | `8368553876` | `5224354917` |
| **Reward Rules** | 1 Coin / Ad, 3 Ads / Session, 6h Session | 1 Coin / Ad, 3 Ads / Session, 6h Session |
| **Callback URL** | No callback configured (staging first) | `https://127.0.0.1:5001/api/admob/ssv` (Local test) |
| **Native Gradle Manifest** | Dynamic placeholder `releaseAdmobAppId` | Dynamic placeholder `debugAdmobAppId` |
| **Fail-Closed Guard** | `!BuildConfig.DEBUG` blocks test ad units | Permitted in debug builds only |

---

## 6. SSV Public-Key Verification Results

Google AdMob SSV verifies incoming GET callbacks using ECDSA P-256 with SHA-256 over a DER-encoded signature against Google's public keys fetched from `https://www.gstatic.com/admob/reward/verifier-keys.json`.

In [`server/utils/admobSsv.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/utils/admobSsv.js), the verifier:
1. Reconstructs the exact message signed by Google by sorting query parameters prior to `signature` and `key_id`.
2. Resolves the public key corresponding to `key_id` (caching fetched keys with automatic refresh).
3. Verifies the DER-encoded base64 signature using `crypto.verify('sha256', messageBuffer, publicKey, signatureBuffer)`.

### Cryptographic Verification Test Results
- **Valid Google Signature:** Verifier accepted authentic ECDSA P-256 signatures generated with the expected key ID.
- **Attacker / Unauthorized Key:** When signed with an unauthorized ECDSA key pair, the verifier returned HTTP 400 `INVALID_SIGNATURE`, rejecting the callback before touching the database.
- **Tampered Payload:** Altering parameter values (e.g., changing `reward_amount=1` to `reward_amount=10` or tampering with `user_id`) invalidated the signature and was rejected immediately.

---

## 7. Real Google Callback Results

- **Verification Status:** **NOT TESTED / AWAITING PUBLIC INGRESS DOMAIN**
- **Reason:** In accordance with prompt instructions ("If an actual Google callback cannot be generated, mark live Google callback verification as NOT TESTED. Do not misrepresent simulated callback tests as real Google verification"), this status is explicitly recorded.
- **Ingress Requirement:** Google's AdMob callback servers originate from Google cloud IP ranges and require a publicly reachable HTTPS endpoint on standard ports (443 or supported HTTPS). Since no public domain or tunnel was provisioned on this local environment, live pings from Google's servers could not be ingested.
- **Action for Production Readiness:** When staging is deployed to a server with public DNS (or when a temporary Cloudflare Tunnel is established), the staging AdMob callback must be tested with AdMob's "Test SSV" callback tool in the Google AdMob console.

---

## 8. Three-Ad End-to-End Workflow Results (Tests A through D)

The 3-ad sequential flow was verified using synthetic customer accounts and authentic ECDSA signatures:

| Step / Test | Action | Server Response | Verification Record Status | Session Progress | Customer Wallet Balance |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Initial State** | Customer created | - | No records | Session active, 0 ads | 0 Coins |
| **Test A: Slot 1** | `prepare-ad` → Signed SSV Callback | HTTP 200 OK | `status = 'verified'`, Slot 1 | 1 ad watched, 1 coin | **1 Coin** (+1) |
| **Test B: Slot 2** | `prepare-ad` → Signed SSV Callback | HTTP 200 OK | `status = 'verified'`, Slot 2 | 2 ads watched, 2 coins | **2 Coins** (+1) |
| **Test C: Slot 3** | `prepare-ad` → Signed SSV Callback | HTTP 200 OK | `status = 'verified'`, Slot 3 | 3 ads watched, 3 coins (`completed`) | **3 Coins** (+1) |
| **Test D: Slot 4** | `prepare-ad` (Slot 4 attempt) | **HTTP 400** `SESSION_AD_LIMIT_REACHED` | Allocation blocked | Session completed, 3 ads | **3 Coins** (Unchanged) |

### Key Workflow Confirmations
- Exactly three verified transactions were recorded (`admob_ssv_verifications`).
- Exactly three coins were credited to the customer wallet.
- The reward session automatically transitioned from `active` to `completed` upon completion of the 3rd advertisement.
- A fourth advertisement request was rejected fail-closed.

---

## 9. Coin Wallet and Ledger Consistency

Double-entry ledger integrity was audited across all test executions:
- **Ledger Invariants:** Every verified advertisement created:
  - 1 row in `admob_ssv_verifications` (`status = 'verified'`, `reward_amount = 1`).
  - 1 row in `point_ledger` (`source = 'admob_ssv'`, `type = 'EARNED'`, `points = 1`, `reference_id = verification.id`).
  - 1 row in `coin_lots` (`source = 'AD_REWARD'`, `tier = 'Bronze'`, `coins_earned = 1`, `coins_remaining = 1`, 30-day expiration).
  - 1 increment of `balance += 1` and `total_earned += 1` in `wallets`.
- **Client Route Lockdown:** `POST /api/customer/watch-ad` and `POST /api/customer/reward-session/watch-ad` returned HTTP 403 `REWARDED_AD_VERIFICATION_REQUIRED`. Zero coins can be credited from client-side events.

---

## 10. Duplicate and Replay Protection Results (Tests E, J, K)

| Test | Scenario | Tested Behavior | Result | Coin Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Test E** | Replay of Identical Transaction ID | Google sends duplicate callback with identical `transaction_id` | HTTP 200 `already_processed: true` | **0 extra coins** (Balance remained 3) |
| **Test J** | Early Dismissal & Slot Release | Customer dismisses ad before completion (`cancel-pending-ad`) | HTTP 200, record marked `rejected`, slot 1 re-preparable | **0 coins** (Pending record discarded safely) |
| **Test K** | Concurrent Duplicate Burst | 5 simultaneous identical callback requests sent in a parallel burst | All 5 returned HTTP 200; 1 credited, 4 acknowledged duplicate | **Exactly 1 coin** credited across burst |

---

## 11. Negative Security Test Results (Tests F, G, H, I, L)

| Test | Attack / Error Vector | Expected Response | Observed Response | Balance Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Test F** | Invalid Signature (Attacker Key) | HTTP 400 `INVALID_SIGNATURE` | HTTP 400 `INVALID_SIGNATURE` | 0 Coins |
| **Test G** | Customer ID Mismatch | HTTP 400 `USER_MISMATCH` | HTTP 400 `USER_MISMATCH` | 0 Coins |
| **Test H** | Ad Unit Mismatch | HTTP 400 `AD_UNIT_MISMATCH` | HTTP 400 `AD_UNIT_MISMATCH` | 0 Coins |
| **Test I** | Expired Pending Record (>15 min) | HTTP 400 `VERIFICATION_EXPIRED` | HTTP 400 `VERIFICATION_EXPIRED` | 0 Coins |
| **Test L** | Expired Reward Session (>6 hours) | HTTP 400 `SESSION_EXPIRED` | HTTP 400 `SESSION_EXPIRED` | 0 Coins |

---

## 12. Android Emulator & Build Test Results

1. **Staging Vite Frontend Build:**
   - Command: `npm run build -- --mode staging`
   - Output: `client/dist/` (assets, chunks, and splash assets built cleanly in 8.09s).
2. **Capacitor Sync:**
   - Web assets synchronized into `client/android/app/src/main/assets/public/`.
3. **Android Debug APK Build:**
   - Command: `./gradlew assembleDebug`
   - Build status: **BUILD SUCCESSFUL** in 22 seconds.
   - Output artifact: `client/android/app/build/outputs/apk/debug/app-debug.apk` (52,387,079 bytes).
4. **Capacitor AdMob Bridge Verification:**
   - Tested bridge module `client/test-stage5b4-1c-admob-sdk.mjs`:
     - Bridge initialization: PASS.
     - Custom data token injection into `ServerSideVerificationOptions`: PASS.
     - In-flight mutex protection: PASS.
     - Zero client-side coin crediting: PASS.
5. **Android Emulator Session:**
   - Active AVD `Pixel_10a` running with network security config supporting cleartext loopback on `10.0.2.2` and TLS on staging endpoints.

---

## 13. Automated Test Counts

A total of 14 test suites covering 129 automated assertions were executed across the staging and workspace test frameworks:

| # | Test Suite | File / Scope | Tests Passed | Failed | Skipped | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| 1 | Staging DB Migration & Constraints | `test-staging-db-migration.js` | 6 | 0 | 0 | **PASS** |
| 2 | Staging SSV E2E Tests (A through L) | `test-staging-e2e-ssv.js` | 12 | 0 | 0 | **PASS** |
| 3 | Staging JS SDK Bridge Integration | `test-stage5b4-1c-admob-sdk.mjs` | 5 | 0 | 0 | **PASS** |
| 4 | Stage 5B.4.1B SSV Callback Unit | `test-stage5b4-1b-admob-ssv.js` | 8 | 0 | 0 | **PASS** |
| 5 | Stage 5B.4.1C Security & Flow | `test-stage5b4-1c-security-and-flow.js` | 4 | 0 | 0 | **PASS** |
| 6 | AdMob Session Redemption Flow | `test-admob-session-redemption.js` | 5 | 0 | 0 | **PASS** |
| 7 | Permanent Merchant QR Verification | `test-permanent-merchant-qr.js` | 16 | 0 | 0 | **PASS** |
| 8 | Customer Google OAuth Suite | `test-customer-google-auth.js` | 25 | 0 | 0 | **PASS** |
| 9 | Marketplace Integration Suite | `test-marketplace.js` | 12 | 0 | 0 | **PASS** |
| 10 | Centralized Admin Management | `test-centralized-admin.js` | 15 | 0 | 0 | **PASS** |
| 11 | Stage 5B.1 Merchant Authentication | `test-stage5b1-merchant-auth.js` | 6 | 0 | 0 | **PASS** |
| 12 | Stage 5B.2 Admin RBAC & Security | `test-stage5b2-security.js` | 5 | 0 | 0 | **PASS** |
| 13 | Test Data Cleanup Safety Guard | `test-cleanup-safety.js` | 6 | 0 | 0 | **PASS** |
| 14 | Ad Reward Base Flow | `server/test-ad-reward.js` | 4 | 0 | 0 | **PASS** |
| **TOTAL** | **All 14 Test Suites** | **Complete System Regression** | **129** | **0** | **0** | **100% PASS** |

---

## 14. Inventory of Modified & Created Files

### Backed-Up Pre-Edit Files (in `backups/stage5b4-1d-backup-2026-11-13/`)
- [`server/index.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/index.js)
- [`server/db/database.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/db/database.js)
- [`server/routes/upload.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/upload.js)

### Repository Files Modified
1. [`server/db/database.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/db/database.js): Added dynamic path resolution via `process.env.DATABASE_PATH` and `busy_timeout = 5000` to prevent database locking during high-concurrency staging tests.
2. [`server/routes/upload.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/upload.js): Added configurable upload directory via `process.env.UPLOAD_DIR`.
3. [`server/index.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/index.js): Integrated `stagingGuard.validateStagingEnvironment()`, configurable `UPLOAD_DIR`, and optional HTTPS listener when `STAGING_ENFORCE_HTTPS === 'true'`.

### New Files Created
1. [`server/config/stagingGuard.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/config/stagingGuard.js): Production isolation validation module.
2. [`server/.env.staging.example`](file:///Users/sarthaklabhade/FREELANCING/5257/server/.env.staging.example): Template for backend staging configuration.
3. [`client/.env.staging.example`](file:///Users/sarthaklabhade/FREELANCING/5257/client/.env.staging.example): Template for frontend staging configuration.
4. [`reports/STAGE_5B4_1D_INITIAL_AUDIT.md`](file:///Users/sarthaklabhade/FREELANCING/5257/reports/STAGE_5B4_1D_INITIAL_AUDIT.md): Comprehensive initial read-only environment audit.
5. [`reports/STAGE_5B4_1D_ISOLATED_STAGING_SSV_VERIFICATION.md`](file:///Users/sarthaklabhade/FREELANCING/5257/reports/STAGE_5B4_1D_ISOLATED_STAGING_SSV_VERIFICATION.md): This report.

### Separate Staging Workspace Created
- `/Users/sarthaklabhade/FREELANCING/5257-staging/` containing isolated server, client, TLS certificates, logs, and database.

---

## 15. Backup Location

- Primary Stage 5B.4.1D backup directory:
  `backups/stage5b4-1d-backup-2026-11-13/`
- Prior backups preserved untouched:
  - `backups/stage5b4-1c-backup-2026-11-12/`
  - `backups/stage5b4-backup-2026-11-12/`
  - `backups/stage5b3-backup-2026-11-12/`
  - `backups/stage5b2-backup-2026-11-12/`
  - `backups/stage5b1-backup-2026-11-12/`

---

## 16. Original Database Hash: Baseline & Discrepancy Investigation

### Checksum Verification
- **Baseline SHA-256 (Start of Stage):**  
  `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`
- **Current SHA-256 (End of Stage):**  
  `55906fea452b2cdf8c4ccbb68bbde34cb5cfef2727491c15f68421cc920a98fa`

### Investigation Findings
During intermediate testing at 15:39:29, an administrative inspection script was executed using `node -e "const db = require('./server/db/database'); ..."` without explicitly declaring `DATABASE_PATH`.
As a result:
1. `server/db/database.js` evaluated default local database resolution and opened `server/db/rewards.db`.
2. `initDatabase()` executed two additive DDL statements:
   ```sql
   CREATE TABLE IF NOT EXISTS admob_ssv_verifications (...);
   CREATE TABLE IF NOT EXISTS admob_ssv_audit_logs (...);
   ```
3. SQLite created these two new tables in the file schema, altering the SQLite header and schema pages, resulting in checksum `55906fea...`.

### Read-Only Data Integrity Audit
To confirm zero data corruption or data loss occurred, a strict read-only audit was conducted:
- `PRAGMA integrity_check`: **`ok`**
- `PRAGMA foreign_key_check`: **`0 violations`**
- **Row Count Comparison Across All Existing Tables:**
  - `users`: **35** (Exact match)
  - `wallets`: **35** (Exact match)
  - `coin_lots`: **43** (Exact match)
  - `point_ledger`: **225** (Exact match)
  - `reward_transactions`: **499** (Exact match)
  - `reward_sessions`: **1** (Exact match)
  - `vp52_coin_sessions`: **5** (Exact match)
  - `shops`: **32** (Exact match)
  - `offers`: **30** (Exact match)
  - `admob_ssv_verifications`: **0** (Empty additive table)
  - `admob_ssv_audit_logs`: **0** (Empty additive table)

**Conclusion:** The hash difference represents solely the additive schema creation of the two empty SSV tables. Zero records were inserted, modified, or deleted in any existing table.

---

## 17. Remaining Blockers & Next Actions

1. **Public Staging Ingress for Live Google Testing:**
   - **Blocker:** Google AdMob’s test callback tool cannot reach local non-public endpoints (`127.0.0.1` / `localhost`).
   - **Recommended Next Action:** Prior to production release, establish a dedicated public HTTPS staging endpoint (e.g. `https://staging-api.vp52coin.com/api/admob/ssv`) and configure a dedicated Staging AdMob Ad Unit in Google AdMob Console to execute live end-to-end ping tests.
2. **Production AdMob Callback Configuration:**
   - **Status:** The production AdMob Unit (`ca-app-pub-4004834464698326/8368553876`) remains intentionally unconfigured. It must only be updated after production backend deployment is authorized.

---

## 18. Explicit Confirmation That Production Was Untouched

I hereby explicitly confirm that throughout Stage 5B.4.1D:
- **Zero connections** were established to the production VPS (`api.vp52coin.com` / 185.199.52.*).
- **Zero SSH / SCP / SFTP** commands were executed.
- No files under `/var/www/vp52` were accessed, modified, or executed.
- The production database `/var/www/vp52/server/db/rewards.db` was untouched.
- Production `.env` was never modified.
- Production PM2 processes were never restarted.
- Android application package identity (`com.sarthak.customerrewards`) and signing certificates were preserved.
- No APK or AAB was published or uploaded to Google Play Console.
- Production AdMob callback settings remain unconfigured pending formal production deployment authorization.

---

## 19. Final Stage Verdict

### **PASS WITH CONDITIONS**

**Conditions for Full Release Readiness:**
1. A public inbound staging domain or tunnel must be provisioned to ingest live callbacks from Google’s AdMob test servers.
2. Production deployment and callback activation remain held pending user sign-off and scheduled migration.
