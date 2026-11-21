# VP52 Stage 5B.1 — OTP Removal & Secure Merchant Password Authentication Report

**Date:** 2026-11-12  
**Project Root:** `/Users/sarthaklabhade/FREELANCING/5257`  
**Scope:** Local-only implementation and verification (zero production VPS access, zero deployment, zero `.env` modifications, zero database record/schema modifications, zero Android package ID or signing key changes).  
**Verdict:** **PASS WITH CONDITIONS**

---

## 1. Removed OTP Routes and Components

### Backend Routes (`server/routes/auth.js`)
The following insecure merchant OTP endpoints and handlers (including hardcoded demo OTP `123456`, unauthenticated `/send-otp` response leakage, and arbitrary 6-character acceptance) were permanently removed and replaced with `router.all(['/shop/login-mobile', '/send-otp', '/verify-otp'], ...)` returning **HTTP `410 Gone`**:
- `POST /api/auth/shop/login-mobile` (now returns `410 Gone` on any HTTP method)
- `POST /api/auth/send-otp` (now returns `410 Gone` on any HTTP method; never issues or echoes `otp_code`)
- `POST /api/auth/verify-otp` (now returns `410 Gone` on any HTTP method; never accepts arbitrary 6-character inputs)

### Frontend Components (`client/src/pages/shop/ShopLogin.jsx`)
- Removed `loginMethod` (`'password'` / `'otp'`) toggle, `mobile`, `otpSent`, `otpCode`, and `demoOtpHint` state.
- Removed `handleRequestOtp` (`/api/auth/send-otp` caller) and `handleVerifyOtpLogin` (`/api/auth/shop/login-mobile` caller).
- Removed `'123456'` prefill/placeholder and all OTP UI inputs, resend actions, and SMS notices.
- `ShopLogin.jsx` now presents **Password Login Only** (Email or Registered Mobile Number + Password), an admin-assisted recovery notice (`merchantAccountRecoveryNote`), a `/merchant/register` button (`registerAsMerchantBtn`), and Customer/Admin portal navigation links.

### Translations (`client/src/i18n/locales/en.js`, `hi.js`, `mr.js`)
- Removed 25 unused OTP-only locale keys (`enterOtp`, `verifyOtp`, `sendOtp`, `enterMobileForOtp`, `otpVerificationTitle`, `otpSentSubtitle`, `changeNumber`, `resendOtp`, `resendIn`, `verifyAndProceed`, `invalidOtpError`, `otpExpiredError`, `requestingOtp`, `verifyingOtp`, `otpMethodLabel`, `passwordMethodLabel`, `registeredMobile`, `resend`, `enter6DigitOtp`, `verifyingMerchantOtp`, `verifyOtpSignIn`, `enterMobileError`, `enterOtpError`, `mobileOtpLoginFailed`, `enterSampleOtpPlaceholder`).
- Added localized `merchantAccountRecoveryNote` and `registerAsMerchantBtn` keys across `en.js`, `hi.js`, and `mr.js`.

---

## 2. Remaining OTP References and Explanations

A full case-insensitive grep across `client/src/` and active `server/` modules confirmed **zero active OTP authentication flows, zero `123456` demo bypasses in runtime code, and zero OTP strings in `client/src/`**:

| File | Remaining Reference | Rationale / Status |
| :--- | :--- | :--- |
| `server/routes/auth.js` (`L43–L52`, `L765–L770`) | `/customer/request-otp`, `/customer/verify-otp`, `/shop/login-mobile`, `/send-otp`, `/verify-otp` | Explicit `router.all(..., 410 Gone)` stubs so stale clients receive deterministic deprecation errors and never hit SPA fallback HTML. |
| `server/utils/otp.js` | HMAC-SHA256 `generateOtp`, `hashOtp`, `verifyOtp` helpers | Dormant legacy utility module; not imported or mounted by any Express route or middleware. Preserved untouched to avoid breaking legacy unit imports (`test-customer-otp.js`). |
| `server/services/smsProvider.js` | Dormant SMS gateway helper | Dormant legacy SMS dispatch helper; not imported or executed by any active route. Requires env vars in production if ever invoked. |
| `server/.env.example` (`L27–L39`) | Commented SMS gateway example variables | Documentation comments only. `.env` files were not touched. |
| `server/db/database.js` (`L315–L327`) & `server/scripts/cleanup-test-data.js` (`L230`, `L412–L416`) | `customer_otp_challenges` table definition & cleanup reference | Legacy schema preserved untouched per safety rule (no schema mutations). |
| `server/test-stage5b1-merchant-auth.js`, `server/test-merchant-location.js` (`L335–L343`), `server/test-customer-google-auth.js` (`L154–L167`), `server/test-customer-otp.js` | Requests sending `'123456'` / `'abcdef'` / `'999999'` or testing `otp.js` directly | **Regression tests**: active server integration suites send those values specifically to **assert HTTP `410 Gone`** rejection; `test-customer-otp.js` tests the unmounted utility in isolation. |
| `client/src/` (`en.js`, `hi.js`, `mr.js`, `CustomerForgotPassword.jsx`, `AdminCustomers.jsx`, `AdminSecurity.jsx`) | Substring matches only (`forg**otp**assword`, `n**otp**rovidedLabel`, `creatingSnapsh**otp**rogress`) | False-positive substring matches unrelated to OTP. |

---

## 3. Merchant Password Authentication Changes

1. **Login Endpoint (`POST /api/auth/shop/login` in `server/routes/auth.js`):**
   - Accepts `email` or `identifier` or `mobile` (supporting merchant email or registered phone number normalized via `normalizePhoneNumber` and punctuation-stripped digit matching) plus `password`.
   - Protected by `merchantLoginLimiter` (`15` requests / 15 minutes per route + IP).
   - Performs bcrypt verification **before** inspecting `status` or `verification_status`. When no matching shop exists or `password_hash` is missing/null, executes a constant-time dummy `bcrypt.compareSync(password, DUMMY_PASSWORD_HASH)` check and returns a **generic `401 Invalid merchant login credentials`** message to prevent account enumeration and reject passwordless login.
   - Only after valid password proof checks `shop.status === 'active' && shop.verification_status === 'approved'`, returning explicit `403` error codes (`MERCHANT_PENDING`, `MERCHANT_REJECTED`, `MERCHANT_SUSPENDED`, `MERCHANT_INACTIVE`) if not approved.
2. **Existing Local Database Audit (Read-Only):**
   - Verified all `32` existing shops in `server/db/rewards.db` already have `password_hash` populated (`has_password = 1`, `0` passwordless shops, `0` non-active/unapproved shops). Zero existing merchant passwords or hashes were modified.
3. **Merchant Recovery Flow for Accounts Lacking Passwords:**
   - Any merchant without a valid password cannot log in via OTP or passwordless fallback (`401`).
   - Account recovery is admin-assisted via `PUT /api/admin/shops/:id/reset-credentials`, which generates a CSPRNG temporary password (`>= 16` chars), hashes it with `bcryptjs`, and sets `must_change_password = 1` (requiring mandatory password update on next login). `ShopLogin.jsx` displays `merchantAccountRecoveryNote` guiding merchants to contact VP52 support/admin.
4. **Password Change Endpoint (`POST /api/auth/shop/change-password`):**
   - Now protected by `authLimiter` and `requireApprovedMerchant` (in addition to existing current-password / policy validation).

---

## 4. Merchant Approval Enforcement Coverage

Added [`requireApprovedMerchant`](file:///Users/sarthaklabhade/FREELANCING/5257/server/middleware/auth.js) and [`requireMerchantOnboarding`](file:///Users/sarthaklabhade/FREELANCING/5257/server/middleware/auth.js) in `server/middleware/auth.js` and applied live DB enforcement across every merchant/session/upload surface:

- **Every protected request** validates the shop record live against SQLite (`status`, `verification_status`, `qr_status`, `permanent_qr_code`, `email`, `name`, `category`), immediately invalidating previously issued JWTs if an admin suspends, deactivates, or rejects the shop.
- **`server/routes/shop.js` (`/api/shop/*`):** `router.use(requireApprovedMerchant)` applied globally to the router.
- **`server/routes/merchant.js` (`/api/merchant/*`):**
  - Explicit pre-approval onboarding routes (`GET /api/merchant/onboarding/status`, `PUT /api/merchant/onboarding/photos`) are mounted **above** the router guard and guarded by `requireMerchantOnboarding`. `PUT /api/merchant/onboarding/photos` only updates `logo_url`/`photo_url` while `verification_status === 'pending'` and accepts only safe `/uploads/...` paths.
  - All other `/api/merchant/*` routes require `requireRole('shop')` + `requireApprovedMerchant` (confirmed 20 blocked active endpoints for pending/onboarding tokens in automated testing).
- **`server/routes/auth.js` (`GET /api/auth/me`, `POST /api/auth/shop/change-password`):** `role: 'shop'` enforces live `status === 'active' && verification_status === 'approved'`; `role: 'merchant_onboarding'` returns a minimal safe onboarding profile and blocks deactivated/suspended accounts.
- **`server/routes/upload.js` (`POST /api/upload/image`, `DELETE /api/upload/image/:filename`):** Added `uploadLimiter` (40 req / 15 min), live DB account checks (`merchant_onboarding` restricted solely to `shop_logo`/`shop_photo` while `pending`; `shop` requires `active`+`approved`; `customer`/`admin` require `active`), strict Data URI validation, and magic-byte image verification (`JPEG`, `PNG`, `WEBP`).
- **`server/routes/admin.js`:** `PUT /shops/:id/approve` ensures `permanent_qr_code` and `qr_status = 'active'`; `PUT /merchants/:id/verify` now syncs `shops.status` and `qr_status` alongside `verification_status`.

---

## 5. Google Merchant Onboarding & Registration Flow

- **Existing Merchant (`POST /api/auth/merchant/google`):** Enforces `status === 'active' && verification_status === 'approved'` before issuing a `role: 'shop'` JWT. Rejected, suspended, inactive, or pending merchants receive HTTP `403` with structured reason codes.
- **New Pending Self-Registered & Google Merchants (`POST /api/auth/merchant/register`, `POST /api/auth/merchant/google`):**
  - Created with `status = 'pending'`, `verification_status = 'pending'`, `qr_status = 'pending'`, `qr_generated_at = NULL`.
  - Receive a tightly scoped `2h` **`role: 'merchant_onboarding'`** (`scope: 'onboarding'`) JWT instead of a full 7-day `role: 'shop'` JWT.
  - Can check status via `GET /api/merchant/onboarding/status`, upload `shop_logo`/`shop_photo` via `/api/upload/image`, and attach them via `PUT /api/merchant/onboarding/photos`.
  - Updated `client/src/pages/shop/MerchantRegister.jsx` (`uploadPendingShopImages`) from `/api/merchant/my-shop` to `/api/merchant/onboarding/photos` so pending registration photo attachment continues functioning seamlessly after post-registration auth.
  - Pending/onboarding tokens are strictly blocked (`403`) from all active merchant, customer, and admin endpoints until approved by an admin.

---

## 6. Customer and Admin Authentication Regression Results

- **Customer Authentication & Google Sign-In:** Verified intact in isolation (`test-customer-google-auth.js`: **25/25 PASSED**; `test-stage5b1-merchant-auth.js` Section 5: **PASS**). Customer tokens cannot access `/api/shop/*`, `/api/merchant/*`, `/api/merchant/onboarding/*`, or `/api/admin/*`. Customer `/api/auth/customer/request-otp` and `/verify-otp` remain `410 Gone`.
- **Admin Authentication & RBAC Isolation:** Verified intact in isolation (`test-centralized-admin.js`: **15/15 modules PASSED**; `test-dual-auth.js`: **14/14 PASSED**). Merchant and `merchant_onboarding` tokens cannot access `/api/admin/*` routes (`403`).

---

## 7. Security Test & Build Results

All backend suites ran against isolated temp copies (`/tmp/vp52_stage5b1_test`) using an isolated database copy (never touching `server/db/rewards.db`). Zero errors:

| Suite / Build Check | Result | Notes |
| :--- | :--- | :--- |
| `node test-stage5b1-merchant-auth.js` | **PASS** (6/6 sections) | Tests 410 OTP removal, generic 401 & null-hash guard, self-reg `merchant_onboarding` scope + 20 blocked routes, approval -> email/mobile login -> password change -> stale JWT block on suspend/reject, Google onboarding & role isolation, and 429 login rate limiting. |
| `npm --prefix client run build` | **PASS** (2328 modules) | Production Vite build compiled cleanly in 1.85s (`exit 0`). |
| `node test-customer-google-auth.js` | **PASS** (25/25) | Customer Google Sign-In, legacy OTP 410, onboarding. |
| `node test-marketplace.js` | **PASS** (12/12) | Marketplace & QR/order flows. |
| `node test-centralized-admin.js` | **PASS** (15/15 modules) | Centralized admin portal & 24 GET endpoints. |
| `node test-dual-auth.js` | **PASS** (14/14) | Dual auth & role boundaries. |
| `node test-admob-session-redemption.js` | **PASS** (5/5 suites) | AdMob session & redemption flows. |
| `node test-permanent-merchant-qr.js` | **PASS** (16/16) | Permanent merchant QR & scan-pay flows. |
| `node test-cleanup-safety.js` | **PASS** (6/6) | Cleanup & production seed guard. |
| `node test-vp52-tier-system.js` | **PASS** (20/20) | Tier accounting & merchant redemption isolation. |
| `node test-coin-session.js` | **PASS** (5/5) | 6-hour session & FIFO claims. |
| `node test-ad-reward-fix.js` | **PASS** (4/4) | Ad watch duration calculations. |
| `node -c` syntax check (8 modified JS files) | **PASS** (`exit 0`) | `auth.js` middleware, `auth/merchant/shop/upload/admin` routes, both test files. |

---

## 8. Files Changed and Backup Location

**Exact Backup Location (all pre-edit copies saved cleanly):**  
`backups/stage5b1-backup-2026-11-12/`

**Modified Files:**
1. `server/middleware/auth.js`
2. `server/routes/auth.js`
3. `server/routes/merchant.js`
4. `server/routes/shop.js`
5. `server/routes/upload.js`
6. `server/routes/admin.js`
7. `server/test-merchant-location.js` (Test 16 updated from `123456` OTP expectation to `410 Gone` + mobile password `must_change_password === 1`)
8. `client/src/pages/shop/ShopLogin.jsx`
9. `client/src/pages/shop/MerchantRegister.jsx`
10. `client/src/i18n/locales/en.js`
11. `client/src/i18n/locales/hi.js`
12. `client/src/i18n/locales/mr.js`

**Added File:**
- `server/test-stage5b1-merchant-auth.js`

*(Zero changes made to `.env`, `server/db/rewards.db`, Android `applicationId`, or signing configuration.)*

---

## 9. Database Integrity and Hash Verification

- Local `server/db/rewards.db` was **never modified** during Stage 5B.1.
- Pre-edit SHA-256: `265a726b5e51bb630389b35c5ea2355108003a1bb7f4e8c9b65880c3be0f0370`
- Post-edit SHA-256: `265a726b5e51bb630389b35c5ea2355108003a1bb7f4e8c9b65880c3be0f0370`
- **Result:** Exact match (`0` bytes altered).

---

## 10. Remaining Security Risks (Out of Scope for Stage 5B.1 / Tracked for Stage 5B.2)

Per Stage 5B.1 safety boundaries (do not alter customer or admin login beyond merchant OTP/auth hardening), pre-existing Stage 5A.3 admin security findings remain tracked for **Stage 5B.2**:
1. Legacy admin route handlers in `server/routes/admin.js` (above centralized RBAC additions) still rely only on `requireRole('admin')` rather than fine-grained `requirePermission(...)`.
2. `/api/admin/login` in `server/routes/auth.js` lacks the dedicated rate limiter and `is_active` check applied to merchant login (centralized admin `/api/admin/auth/login` already has these).
3. Legacy dormant files (`server/utils/otp.js`, `server/services/smsProvider.js`, `customer_otp_challenges` table) remain on disk unmounted for backwards compatibility with legacy utilities.

---

## 11. Untested Functionality

1. **`server/test-chat.js` & `server/test-merchant-location.js` runtime execution:** Both scripts start live TCP HTTP listeners (`listen`), which are blocked by the local execution sandbox (`EPERM`), though `server/test-merchant-location.js` was updated for Test 16 (`410 Gone` + mobile password check) and passed `node -c` syntax validation.
2. **Interactive Browser DOM & Physical Android Device UI:** `ShopLogin.jsx` (`MerchantRegister.jsx` post-registration `/api/merchant/onboarding/photos`) compiled cleanly in the Vite bundle (`npm --prefix client run build`), but live visual rendering/navigation in Chromium or on Android emulator was not run in this terminal-only pass.

---

## 12. Stage 5B.1 Verdict

**`PASS WITH CONDITIONS`**

All Stage 5B.1 objectives are completely implemented and verified locally: insecure merchant OTP endpoints/UI/demo `123456` acceptance are permanently removed (`410 Gone`), password-based merchant authentication with rate limiting and constant-time anti-enumeration protections is active, `status === 'active' && verification_status === 'approved'` is enforced on every subsequent request across all merchant/shop/upload/session routes, pending merchants are isolated to a scoped `merchant_onboarding` JWT, database integrity (`265a726b5e51bb630389b35c5ea2355108003a1bb7f4e8c9b65880c3be0f0370`) is preserved untouched, and all 12 executable test suites + production client build pass. Release remains conditioned on Stage 5B.2 security/UI follow-ups and interactive socket/UI smoke runs outside the sandbox.
