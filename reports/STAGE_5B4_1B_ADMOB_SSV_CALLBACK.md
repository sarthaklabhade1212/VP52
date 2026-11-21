# VP52 Stage 5B.4.1B — AdMob SSV Callback Preparation Report

**Project:** `/Users/sarthaklabhade/FREELANCING/5257`  
**Stage:** 5B.4.1B — AdMob Server-Side Verification (SSV) Callback Preparation  
**Database SHA-256 Baseline (Unchanged):** `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`  
**SSV Callback URL Status:** **NOT CONFIGURED** *(left unset pending review and deployment to a secure HTTPS staging endpoint)*  
**Final Verdict:** **`PASS WITH CONDITIONS`** *(local SSV backend, ECDSA public-key verifier, pending verification records, atomic 1-coin ledger integration, replay protection, and isolated test suites are complete and passing; live HTTPS `gstatic.com` key fetch, staging HTTPS deployment, native rewarded SDK `ServerSideVerificationOptions` wiring, and AdMob Console SSV URL configuration remain pending)*

---

## 1. Pre-Edit Backups & Safety Verification

Before editing any file, complete backups were captured in `backups/stage5b4-1b-backup-2026-11-12/`:
- [`backups/stage5b4-1b-backup-2026-11-12/server/db/database.js`](file:///Users/sarthaklabhade/FREELANCING/5257/backups/stage5b4-1b-backup-2026-11-12/server/db/database.js)
- [`backups/stage5b4-1b-backup-2026-11-12/server/index.js`](file:///Users/sarthaklabhade/FREELANCING/5257/backups/stage5b4-1b-backup-2026-11-12/server/index.js)
- [`backups/stage5b4-1b-backup-2026-11-12/server/routes/customer.js`](file:///Users/sarthaklabhade/FREELANCING/5257/backups/stage5b4-1b-backup-2026-11-12/server/routes/customer.js)
- [`backups/stage5b4-1b-backup-2026-11-12/server/routes/admin.js`](file:///Users/sarthaklabhade/FREELANCING/5257/backups/stage5b4-1b-backup-2026-11-12/server/routes/admin.js)
- [`backups/stage5b4-1b-backup-2026-11-12/server/.env.example`](file:///Users/sarthaklabhade/FREELANCING/5257/backups/stage5b4-1b-backup-2026-11-12/server/.env.example)

Safety invariants maintained:
- Zero VPS, SSH, SCP, or deployment commands executed.
- `server/.env` and client `.env*` files left untouched.
- [`server/db/rewards.db`](file:///Users/sarthaklabhade/FREELANCING/5257/server/db/rewards.db) never mutated (`shasum -a 256` verified `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a` before and after all work). All tests executed against an isolated scratch copy in `/tmp`.
- Existing **6-hour session** duration and **3 rewarded ads per session** cap preserved intact.

---

## 2. Customer Reward-Session Architecture Identified

Inspection of Stage 5B.4 and the local backend identified two session models in [`server/db/database.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/db/database.js) and [`server/routes/customer.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js):
1. **`reward_sessions` (`/api/customer/reward-session/*`):** Server-controlled 6-hour reward windows (`end_time = +6h`, `ads_watched` capped at `3`). Stage 5B.4 locked `POST /api/customer/reward-session/watch-ad` and `POST /api/customer/watch-ad` to fail closed (`403 REWARDED_AD_VERIFICATION_REQUIRED`).
2. **`vp52_coin_sessions` (`/api/customer/coin-session/*`):** Active CustomerHome 6-hour sessions (`duration_seconds = 21600`, `expires_at = +6h`).

Both 6-hour session models are now cleanly supported by SSV pending verification records without altering the 6-hour duration or 3-ad session cap.

---

## 3. Files Added & Modified

### New Files
1. **[`server/config/admob.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/config/admob.js):**
   - Configures App ID `ca-app-pub-4004834464698326~8764285486` and Rewarded Ad Unit ID `ca-app-pub-4004834464698326/8368553876` (with env override support via `ADMOB_APP_ID` / `ADMOB_REWARDED_AD_UNIT_ID`).
   - Enforces fixed constants: `SSV_REWARD_AMOUNT = 1`, `SSV_REWARD_ITEM = 'coin'`, `SESSION_DURATION_HOURS = 6`, `MAX_ADS_PER_SESSION = 3`, `COIN_EXPIRY_DAYS = 30`.
   - Provides [`isExpectedRewardedAdUnit`](file:///Users/sarthaklabhade/FREELANCING/5257/server/config/admob.js#L59-L71) accepting Google's numeric unit suffix (`8368553876`) or exact full ID (`ca-app-pub-4004834464698326/8368553876`) while rejecting sample test units, wrong publishers, and invalid IDs.
2. **[`server/utils/admobSsv.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/utils/admobSsv.js):**
   - Implements Google's official ECDSA (`SHA256withECDSA`, DER encoding) verifier against `https://www.gstatic.com/admob/reward/verifier-keys.json`.
   - Caches Google public keys per HTTP `Cache-Control: max-age` headers (supporting PEM and base64 SPKI DER formats) and forces refresh upon key rotation (`UNKNOWN_KEY_ID`).
   - [`parseSsvCallbackUrl`](file:///Users/sarthaklabhade/FREELANCING/5257/server/utils/admobSsv.js#L114-L237) parses the raw URL query string directly in wire order, reconstructs the canonical UTF-8 payload strictly preceding `&signature=`, rejects duplicate parameter smuggling, verifies parameter ordering, validates required fields and positive timestamps, and decodes standard base64 and URL-safe base64url signatures cleanly.
3. **[`server/routes/admob.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/admob.js):**
   - Exposes public unauthenticated Google-signed callback endpoints `GET /api/admob/ssv` and `GET /api/admob/ssv-callback`.
   - Enforces ECDSA verification, expected ad unit matching, fixed `1 coin` reward verification, replay protection, pending record expiry/ownership checks, 3-ad-per-6h session cap, and atomic ledger crediting (`db.transaction(...).immediate()`).
4. **[`server/test-stage5b4-1b-admob-ssv.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/test-stage5b4-1b-admob-ssv.js):**
   - Isolated 8-suite test harness covering all required edge cases and concurrency scenarios.

### Modified Files
1. **[`server/db/database.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/db/database.js):**
   - Added `db.pragma('busy_timeout = 5000')` for concurrent write safety.
   - Added `admob_ssv_verifications` table with unique indexes on `verification_token`, `transaction_id`, `(session_type, session_id, ad_slot) WHERE status = 'verified'`, and `(session_type, session_id, ad_slot) WHERE status = 'pending'`.
   - Added `admob_ssv_audit_logs` table for immutable security event logging.
2. **[`server/index.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/index.js):**
   - Mounted `/api/admob` via `admobRoutes`.
3. **[`server/routes/customer.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js):**
   - Updated [`GET /api/customer/reward-session/status`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js#L1712-L1774) to keep unexpired 3/3 completed 6-hour windows locked against reset, enforce `1 coin` per ad / `3 ads` / `6 hours`, and expose verification summary.
   - Added [`POST /api/customer/reward-session/prepare-ad`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js#L1778-L1943) creating one separate pending verification record per ad slot (`1`, `2`, `3`) per active 6-hour session without crediting any coins.
   - Added [`GET /api/customer/reward-session/verifications`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js#L1946-L1960) to inspect pending/verified records.
   - Preserved fail-closed `403 REWARDED_AD_VERIFICATION_REQUIRED` guards on [`POST /api/customer/watch-ad`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js#L314-L323) and [`POST /api/customer/reward-session/watch-ad`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/customer.js#L1963-L1972).
4. **[`server/routes/admin.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/admin.js):**
   - Updated [`GET /api/admin/advertisements/admob`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/admin.js#L3060-L3108) to report real `app_id`, `rewarded_ad_unit_id`, and `rewarded_ssv` counters/status (`LOCAL_READY_PENDING_CALLBACK_URL`).
5. **[`server/.env.example`](file:///Users/sarthaklabhade/FREELANCING/5257/server/.env.example):**
   - Documented `ADMOB_APP_ID`, `ADMOB_REWARDED_AD_UNIT_ID`, `ADMOB_SSV_PENDING_TTL_SECONDS`, and commented `ADMOB_SSV_CALLBACK_URL` guidance.

---

## 4. Security Architecture & Protections Implemented

1. **Cryptographic Public-Key Signature Verification:** Verifies `SHA256withECDSA` over Google's raw canonical query prefix before `&signature=` using keys fetched from `https://www.gstatic.com/admob/reward/verifier-keys.json` (both PEM and SPKI DER base64 supported), rejecting wrong keys, altered query values, malformed encodings, unknown `key_id`, and duplicate query parameters without mutating valid pending records.
2. **Transaction Uniqueness & Anti-Replay:** Enforces `transaction_id TEXT UNIQUE` at SQLite schema level plus explicit transaction lookup in `admob.js`:
   - Replaying an already-processed `transaction_id` with a different pending record or user returns `409 TRANSACTION_ID_ALREADY_USED` (`0` coins credited).
   - Submitting a new `transaction_id` against an already-verified pending token returns `409 VERIFICATION_ALREADY_USED` (`0` coins credited).
3. **Safe Idempotent Google Retry Handling:** Exact Google callback retries matching the already-verified `(transaction_id, verification_token, user_id, ad_unit)` return `HTTP 200` (`duplicate: true, coins_credited: 0`) cleanly without double-crediting.
4. **Separate Pending Verification Records & Limits:** Each of the 3 ads per 6-hour session requires its own single-use `VP52SSV_*` pending record (`ad_slot` 1, 2, 3), expired automatically once past `expires_at` or past the 6-hour session `end_time`. Both application logic and partial unique DB indexes prevent a 4th ad slot from ever crediting within a 6-hour session.
5. **Atomic 1-Coin Ledger Integration:** Valid callbacks credit **exactly 1 Bronze coin** inside `db.transaction(...).immediate()`, updating `wallets`, `coin_lots` (30-day expiry), `reward_transactions`, `point_ledger` (`source = 'admob_ssv'`), `reward_sessions`, and `ad_event_logs` atomically.
6. **Concurrency Safety:** `.immediate()` acquires SQLite's write lock upfront so simultaneous bursts cannot double-credit under race conditions.
7. **Zero Client Coin Minting:** Client-side endpoints (`prepare-ad`, `/watch-ad`, `/reward-session/watch-ad`, `/ad-event`) never mint coins.

---

## 5. Isolated Verification & Regression Results

All tests were executed in an isolated scratch copy under `/tmp/vp52_5b41b_test` against a copied snapshot of `rewards.db`. Production/local `server/db/rewards.db` remained unmodified.

### Stage 5B.4.1B SSV Suite (`test-stage5b4-1b-admob-ssv.js` — **8/8 PASS**)
- **Test 1:** Client-side callbacks (`/watch-ad`, `/reward-session/watch-ad`) fail closed with `403`, balance unchanged. — **PASS**
- **Test 2:** Prepare 3 separate pending records (`ad_slot` 1, 2, 3), block 4th slot, verify real ECDSA P-256 SSV callbacks (`+1` coin each -> total `3`), verify `coin_lots`, `point_ledger`, `reward_transactions`, `wallets`, and `reward_sessions`, block >3 ads in same 6-hour window. — **PASS**
- **Test 3:** Invalid signatures (wrong private key, tampered parameter, unknown `key_id`, missing signature, duplicate parameter pollution) rejected (`403`/`400`), `0` coins credited, valid pending record remains unpoisoned. — **PASS**
- **Test 4:** Duplicate Google callback retry returns `200` with `0` extra coins; cross-record `transaction_id` reuse and consumed-token reuse rejected (`409`). — **PASS**
- **Test 5:** Wrong ad units (sample `5224354917`, wrong publisher prefix with matching suffix, unknown unit) and tampered reward params (`reward_amount=2`, `reward_item=diamond`) rejected (`400`). — **PASS**
- **Test 6:** Expired pending records (`400 VERIFICATION_EXPIRED`) and expired 6-hour sessions (`400 SESSION_EXPIRED`) rejected with `0` coins credited; freed slot re-preparable only inside valid 6h session. — **PASS**
- **Test 7:** Simultaneous callback bursts (`Promise.all` x5 identical retries -> `1` coin total; `Promise.all` x3 competing transactions on slot 2 -> `1` winner + `2` `409` conflicts; slot 3 completes cleanly) + dynamic Google key rotation cache refresh. — **PASS**
- **Test 8:** `vp52_coin_session` SSV binding + mismatched `user_id` (`403 USER_MISMATCH`) rejection. — **PASS**

### Existing Regression Suites (Isolated `/tmp` Run — **10/10 PASS**)
- `test-admob-session-redemption.js`: **PASS (5/5 suites)**
- `test-permanent-merchant-qr.js`: **PASS (16/16)**
- `test-customer-google-auth.js`: **PASS (25/25)**
- `test-marketplace.js`: **PASS (12/12)**
- `test-centralized-admin.js`: **PASS (15/15)**
- `test-stage5b1-merchant-auth.js`: **PASS (6/6)**
- `test-stage5b2-security.js`: **PASS (5/5)**
- `test-cleanup-safety.js`: **PASS (6/6)**
- `test-coin-session.js`: **PASS (5/5)**
- `test-ad-reward-fix.js`: **PASS (4/4)**

*Condition noted on test environment:* Because sandboxed local test execution blocks outbound HTTPS network calls, Google's `https://www.gstatic.com/admob/reward/verifier-keys.json` endpoint was exercised via real ECDSA P-256 keypairs injected into `createSsvVerifier({ keyFetcher })` rather than a live outbound network request to Google.

---

## 6. Remaining Work Before Live AdMob Callback Configuration

Do **NOT** configure the SSV callback URL in Google AdMob Console until the following steps are completed:
1. Deploy this backend to a secure **HTTPS staging endpoint** (valid TLS certificate; no HTTP).
2. Verify live outbound connectivity from staging to `https://www.gstatic.com/admob/reward/verifier-keys.json` and trigger Google AdMob's **"Verify URL"** SSV test ping against `https://<staging-host>/api/admob/ssv`.
3. Update the Android client / Capacitor rewarded-ad bridge (`client/src/services/admobService.js` + native plugin wrapper) to call `POST /api/customer/reward-session/prepare-ad` before loading each rewarded ad and pass `customData = verification.custom_data` and `userId = verification.user_id` into `ServerSideVerificationOptions`, polling `/api/customer/reward-session/verifications` / `/api/customer/wallet` instead of relying on client-side reward callbacks.
4. Obtain explicit review & approval before setting `ADMOB_SSV_CALLBACK_URL` in production/staging AdMob Console.

---

## 7. Final Verdict

**VERDICT: `PASS WITH CONDITIONS`**

All Stage 5B.4.1B backend SSV callback preparation requirements—official ECDSA public-key verification logic, separate per-ad pending verification records for the 3-ad / 6-hour session policy, transaction ID uniqueness and replay protection, safe idempotent Google retry handling, exact 1-coin atomic ledger crediting, fail-closed client callback guards, and isolated unit/concurrency tests—are implemented and verified locally with zero mutation to `server/db/rewards.db` or `.env` files. Live outbound key fetching from `gstatic.com` and live AdMob Console callback URL configuration remain deferred until staging HTTPS deployment and review.
