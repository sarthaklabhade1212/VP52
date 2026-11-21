# VP52 Stage 5B.2 — Admin RBAC & API Security Remediation Report

**Date:** 2026-11-12  
**Project Root:** `/Users/sarthaklabhade/FREELANCING/5257`  
**Scope:** Local-only implementation and verification (zero production VPS access, zero deployment commands, zero `.env` edits, zero `server/db/rewards.db` data/schema mutations, zero Android package ID or signing key changes).  
**Verdict:** **PASS WITH CONDITIONS**

---

## 1. Admin RBAC Audit Table & Route-Permission Enforcement

Implemented strict centralized RBAC constants and validators in [`server/middleware/auth.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/middleware/auth.js) (`ADMIN_ROLES`, `ADMIN_PERMISSIONS`, `DEFAULT_ADMIN_PERMISSIONS_BY_ROLE`, `validateAdminPermissions`, `sanitizeStoredAdminPermissions`, `requireActiveAdmin`, `requirePermission`):

- **Wildcard Escalation Eliminated:** Removed the `perms.includes('*')` bypass for non-`super_admin` roles in [`requirePermission`](file:///Users/sarthaklabhade/FREELANCING/5257/server/middleware/auth.js). Only database rows with `role === 'super_admin'` receive unrestricted access. Even malformed or manually edited stored JSON containing `'*'` is ignored by `sanitizeStoredAdminPermissions` for all other admin roles.
- **Global Live Admin Guard:** Added `router.use(requireActiveAdmin)` right after `requireRole('admin')` in [`server/routes/admin.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/admin.js), verifying live `status === 'active'` against SQLite on every `/api/admin/*` request.
- **Zero Unguarded Admin Endpoints:** Audited all 95 route handlers in `server/routes/admin.js`; all 44 previously unguarded legacy routes now enforce explicit `requirePermission(...)`:

| Endpoint Group (`server/routes/admin.js`) | Required Permission | Additional Guards |
| :--- | :--- | :--- |
| `GET /categories` | `categories:view` | `requireActiveAdmin` |
| `GET /analytics`, `GET /dashboard-stats`, `GET /global-search` | `dashboard:view` | `requireActiveAdmin` |
| `GET /audit-logs`, `GET /activity-logs`, `GET /fraud/alerts` | `security:view` | `requireActiveAdmin` |
| `GET /customers`, `GET /customers/:id` | `customers:view` | `requireActiveAdmin` |
| `PUT /customers/:id/status` | `customers:manage` | `requireActiveAdmin` |
| `GET /shops`, `GET /shops/:id/details`, `GET /shops/:id/photos`, `GET /reviews/moderation`, `GET /review-reports`, `GET /merchants/pending` | `merchants:view` | `requireActiveAdmin` |
| `POST /shops`, `PUT /shops/:id`, `/approve`, `/reject`, `/suspend`, `/reactivate`, `/status`, `DELETE /shops/:id`, `POST/DELETE /shops/:id/photos*`, `PUT/DELETE /reviews/*`, `PUT /review-reports/:id/dismiss`, `PUT /merchants/:id/verify`, `GET /merchants/qr`, `POST /merchants/:id/qr/*` | `merchants:manage` | `PUT /shops/:id/reset-credentials` adds `adminCredentialLimiter` |
| `GET /offers` | `offers:view` | `requireActiveAdmin` |
| `POST/PUT/DELETE /offers*`, `PUT /offers/:id/toggle` | `offers:manage` | `requireActiveAdmin` |
| `GET /reward-settings`, `GET /verify-qr/:code`, `GET /settings`, `GET /transactions/rewards`, `GET /transactions/redemptions`, `GET /levels`, `GET /coins/*` | `coins:view` | `requireActiveAdmin` |
| `PUT /reward-settings`, `POST /mark-used`, `PUT /settings`, `PUT /levels/:name`, `POST /customers/:id/coin-adjustment`, `POST /coins/reversal` | `coins:adjust` | `PUT /reward-settings`, `PUT /settings`, `PUT /levels/:name`, `coin-adjustment`, `coins/reversal` add `adminFinancialLimiter` |
| `GET /complaints`, `GET /complaints/:id` | `support:view` | `requireActiveAdmin` |
| `PUT /complaints/:id`, `PUT /complaints/:id/assign` | `support:manage` | `requireActiveAdmin` |
| `GET /admins`, `POST /admins`, `PUT /admins/:id`, `PUT /admins/:id/deactivate` | `admins:manage` | Mutations add `adminManageLimiter` + privilege-escalation guards |

---

## 2. Admin Account Security & Lifecycle Fixes

Hardened admin account management and authentication across [`server/routes/admin.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/admin.js), [`server/routes/auth.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/auth.js), and [`client/src/pages/admin/AdminSecurity.jsx`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/pages/admin/AdminSecurity.jsx):

1. **`POST /api/auth/admin/login` (`server/routes/auth.js`):**
   - Protected by `adminLoginLimiter` (`12` attempts / `15` min).
   - Performs timing-safe dummy bcrypt verification when the email does not exist, returns generic `401 Invalid admin credentials` on invalid credentials, and enforces `admin.status !== 'active'` (`403`) only after valid password verification (preventing account enumeration).
   - Never defaults non-`super_admin` roles or malformed JSON permissions to `['*']`.
2. **`GET /api/auth/me` (`server/routes/auth.js`):**
   - Rejects inactive/suspended admins (`admin.status !== 'active'` -> `403`) on JWT session checks.
   - Uses `sanitizeStoredAdminPermissions` (`operations_admin` safe fallback for missing role, never `super_admin` or `['*']`).
3. **`POST /api/auth/admin/change-password` (`server/routes/auth.js`):**
   - Added dedicated authenticated password change endpoint protected by `adminPasswordChangeLimiter` (`10` attempts / `15` min), verifying live active admin status, `current_password`, `validatePasswordStrength` (`>= 12` characters, uppercase, lowercase, digit), password non-reuse, and cost-`12` bcrypt hashing.
4. **`POST /api/admin/admins`, `PUT /api/admin/admins/:id`, `PUT /api/admin/admins/:id/deactivate` (`server/routes/admin.js`):**
   - Replaced wildcard `'["*"]'` default permissions on `POST /admins` with strict role-scoped least-privilege defaults (`DEFAULT_ADMIN_PERMISSIONS_BY_ROLE`).
   - Enforced `validatePasswordStrength` and bcrypt cost `12` on admin creation and optional password updates.
   - Enforced cross-table email uniqueness checks across `admins`, `users`, and `shops` (`409`).
   - Rejected invalid roles (`400`), invalid/empty permissions (`400`), and `'*'` on non-`super_admin` roles (`400`).
   - Prevented non-`super_admin` callers (even with `admins:manage`) from creating/promoting/modifying/deactivating `super_admin` accounts (`403`) or granting permissions outside their own held permission set (`403`).
   - Enforced self-deactivation and last-active-`super_admin` protections on both `PUT /admins/:id` and `PUT /admins/:id/deactivate` (`400`), stripped `'*'` automatically on role downgrade, and accepted `full_name || name`.
5. **Frontend Sync (`client/src/pages/admin/AdminSecurity.jsx`):**
   - Fixed admin creation payload to send `full_name` (from form `name`), synchronized `permissions` automatically with the selected role, hid `super_admin` creation option from non-`super_admin` sessions, and aligned password input (`minLength={12}`, `t('mrPasswordReqHint')`) with backend password strength enforcement.

---

## 3. Merchant Approval & Permanent QR State Synchronization

Eliminated status/verification/QR drift while preserving historical `permanent_qr_code`, `coin_transfers`, and `merchant_wallets` records:

- **`resolveSyncedShopState` helper & admin merchant routes (`server/routes/admin.js`):**
  - `POST /api/admin/shops`: Respects non-active initial statuses (`pending` -> `verification_status = 'pending'`, `qr_status = 'pending'`, `qr_generated_at = NULL`; `suspended`/`inactive` -> `qr_status = 'suspended'`).
  - `PUT /api/admin/shops/:id`: Fixed the `status || 'active'` regression that silently activated unapproved/pending merchants during profile/coordinate edits; omitted `status` now preserves existing `status`, `verification_status`, and `qr_status`, while explicit `status` updates synchronize all three atomically and preserve `'revoked'` QR states.
  - `PUT /shops/:id/reject`, `PUT /shops/:id/suspend`, `PUT /shops/:id/status`, `PUT /shops/:id/reactivate`, and `PUT /merchants/:id/verify`: Atomically synchronize `status`, `verification_status`, and `qr_status` while preserving `permanent_qr_code`, explicit `'revoked'` QR flags, and clearing `rejection_reason` upon reactivation/approval.
  - `POST /merchants/:id/qr/status` & `POST /merchants/:id/qr/regenerate`: Prevent unapproved/suspended merchants from obtaining an `'active'` `qr_status` even after QR regeneration.
- **Customer Permanent QR Enforcement (`server/routes/customer.js`):**
  - `POST /api/customer/merchant-qr/lookup` and `POST /api/customer/merchant-qr/pay` now require `shop.status === 'active' && shop.verification_status === 'approved' && shop.qr_status === 'active'`, returning `403` for pending, rejected, inactive, suspended, or revoked merchant QRs.

---

## 4. Rate Limiting & Abuse Controls

Verified existing `trust proxy` (`'loopback'`) + `getClientIp` isolation in [`server/middleware/rateLimiter.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/middleware/rateLimiter.js) (untrusted `X-Forwarded-For` headers from non-loopback peers cannot bypass limits) and replaced header-based IP extraction in `recordAdminActivity` (`server/routes/admin.js`) with `getClientIp(req)`.

Added fixed-prefix limiters (`keyGenerator` prevents `:id` path cycling bypasses and leaks zero internal store details):

| Endpoint | Limiter | Threshold |
| :--- | :--- | :--- |
| `POST /api/auth/admin/login` | `adminLoginLimiter` | `12` / `15` min |
| `POST /api/auth/admin/change-password` | `adminPasswordChangeLimiter` | `10` / `15` min |
| `POST /api/auth/request-account-deletion` | `deletionRequestLimiter` | `6` / `15` min |
| `DELETE /api/customer/account` | `customerAccountDeletionLimiter` | `5` / `15` min |
| `POST/PUT /api/admin/admins`, `PUT /api/admin/admins/:id/deactivate` | `adminManageLimiter` | `20` / `15` min |
| `PUT /api/admin/shops/:id/reset-credentials` | `adminCredentialLimiter` | `15` / `15` min |
| `POST /api/admin/customers/:id/coin-adjustment`, `POST /coins/reversal`, `POST /payments/refund`, `PUT /reward-settings`, `PUT /settings`, `PUT /levels/:name` | `adminFinancialLimiter` | `30` / `15` min |
| `POST /api/upload/image` | `uploadLimiter` (key hardened) | `40` / `15` min |

---

## 5. Upload Security Verification & Hardening

Hardened [`server/routes/upload.js`](file:///Users/sarthaklabhade/FREELANCING/5257/server/routes/upload.js) while preserving full compatibility with [`client/src/utils/imageCompression.js`](file:///Users/sarthaklabhade/FREELANCING/5257/client/src/utils/imageCompression.js) (`350 KB` profile avatar / `550 KB` general photo presets) and existing `{ image, folder }` & `{ image, type }` callers:

- Validated `type` (`ALLOWED_UPLOAD_TYPES`) and `folder` (`ALLOWED_FOLDERS`) strictly as safe strings (`400` on invalid/object types; eliminates `type.replace` `TypeError` `500` crash risk).
- Enforced pre-decode base64 length caps (`MAX_BASE64_CHARS`), strict base64 character validation, and post-decode `10 MB` cap (`MAX_FILE_SIZE_BYTES`).
- Enforced full binary magic-byte inspection (`PNG` full 8-byte header + min `24` bytes; `JPEG` `FF D8 FF` + valid marker `>= 0xC0`; `WebP` `RIFF....WEBP` + `VP8`/`VP8L`/`VP8X` chunk) and explicit dangerous-signature rejection (`<svg`, `<?xml`, `<html`, `<script`, `MZ`, `\x7fELF`, `%PDF`, `PK\x03\x04`) even when spoofed under `image/png`, `image/jpeg`, or `image/webp` Data URIs.
- Enforced role-scoped upload rules (`merchant_onboarding` restricted to `shop_logo`/`shop_photo` while `pending`; `shop` restricted to shop/product assets while `active`+`approved`; `customer` restricted to `customer_profile`/`review_photo` while `active`; `admin` requires `active`).

---

## 6. Automated Security & Regression Test Results

All tests ran in an isolated temporary directory (`/tmp/vp52_stage5b2_test`) against isolated copies of `server/db/rewards.db` (zero mutations to workspace database or production files):

| Suite / Build Verification | Result | Coverage |
| :--- | :--- | :--- |
| `NODE_ENV=test node test-stage5b2-security.js` | **PASS (5/5 sections)** | Admin login lifecycle, inactive JWT `/me` & `/api/admin/*` blocks, granular RBAC across legacy + module endpoints, stored `'*'` bypass prevention, non-superadmin escalation & self/last-superadmin guards, password strength + `change-password`, merchant `status`/`verification_status`/`qr_status` sync & revoked preservation, customer permanent QR blocking, 429 rate limits + anti-XFF spoofing + `:id` bucket sharing, PNG/JPEG/WEBP vs SVG/EXE/partial-header upload checks, audit log IP hygiene. |
| `node test-centralized-admin.js` | **PASS (15/15 modules)** | All 15 admin portal modules, CSV exports, backups, RBAC checks. |
| `node test-stage5b1-merchant-auth.js` | **PASS (6/6 sections)** | OTP 410 removal, merchant password login, onboarding scope, approval lifecycle. |
| `node test-customer-google-auth.js` | **PASS (25/25)** | Customer Google OAuth, OTP 410, wallet isolation, token revocation. |
| `node test-dual-auth.js` | **PASS (14/14)** | Multi-role boundaries across customer, merchant, and admin. |
| `node test-marketplace.js` | **PASS (12/12)** | Shop discovery, uploads, catalog, orders, review moderation. |
| `node test-permanent-merchant-qr.js` | **PASS (16/16)** | Permanent merchant QR lookup, idempotent scan-pay, suspend/revoke/regenerate. |
| `node test-admob-session-redemption.js` | **PASS (5/5 suites)** | AdMob reward session lifecycle and coin redemption. |
| `node test-vp52-tier-system.js` | **PASS (20/20)** | FIFO coin lots, Bronze/Silver/Gold tiers, merchant isolation. |
| `node test-coin-session.js` | **PASS (5/5)** | 6-hour coin session math and idempotent claims. |
| `node test-ad-reward-fix.js` | **PASS (4/4)** | Ad watch duration and reward calculations. |
| `node test-cleanup-safety.js` | **PASS (6/6)** | Production seed guard, SQLite backup verification, foreign-key integrity. |
| `npm --prefix client run build` | **PASS (2328 modules)** | Production Vite bundle built cleanly in `1.94s`. |
| `node -c` syntax validation (7 modified JS files) | **PASS (`exit 0`)** | `auth.js` middleware, `rateLimiter.js`, `auth.js`, `admin.js`, `customer.js`, `upload.js`, `test-stage5b2-security.js`. |

---

## 7. Files Changed and Backup Location

- **Backup Directory (all Stage 5B.2 pre-edit snapshots preserved):**  
  `backups/stage5b2-backup-2026-11-12/`  
  *(All Stage 1–5B.1 backups under `backups/` remain completely untouched.)*
- **Modified Files:**
  1. `server/middleware/auth.js`
  2. `server/routes/auth.js`
  3. `server/routes/admin.js`
  4. `server/routes/customer.js`
  5. `server/routes/upload.js`
  6. `client/src/pages/admin/AdminSecurity.jsx`
- **Added Test Suite:**
  - `server/test-stage5b2-security.js`
- **Unmodified Sensitive Areas:** `.env` files, `server/db/rewards.db`, Android `applicationId`, and Android signing configuration were never altered.

---

## 8. Database Integrity and Hash Verification

- Workspace `server/db/rewards.db` was **never modified** during Stage 5B.2 (read-only verification ran against a temporary copy in `/tmp`).
- Pre-edit `server/db/rewards.db` SHA-256 (`2026-11-12 19:10`): `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`
- Post-edit `server/db/rewards.db` SHA-256 (`2026-11-12 19:45`): `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`
- SQLite `PRAGMA integrity_check`: `ok` (`2` active `super_admin` accounts, `35` users, `32` shops, `35` wallets, `0` schema/data changes).

---

## 9. Remaining Security & Release Notes

- **Multi-process deployment note:** `server/middleware/rateLimiter.js` uses an in-memory per-process store (`Map`), which provides full brute-force protection for the single-node PM2/Node Express API process. Multi-instance horizontal scaling would require a shared Redis store later.
- **UI error handling for restricted sub-admins:** `AdminComplaints.jsx` calls `GET /api/admin/admins` to load optional assignee choices; users holding only `support:manage` without `admins:manage` receive `403` cleanly without crashing (assignment dropdown stays empty unless `admins:manage` is also granted).

---

## 10. Untested Functionality

1. **`server/test-admin-auth.js` Test 1:** Fails with `401` on the local workspace database copy because `test-admin-auth.js` sends an older historical test password against the updated `sanketshinde.vp52@gmail.com` hash stored in `server/db/rewards.db` (per safety rules, existing admin password hashes in `rewards.db` were not reset). Admin login, `/me`, `change-password`, and RBAC flows were verified independently in `test-stage5b2-security.js`, `test-centralized-admin.js`, and `test-dual-auth.js`.
2. **`server/test-chat.js` & `server/test-merchant-location.js` runtime execution:** Both bind TCP ports (`listen`), which are blocked by the local sandbox (`EPERM`).
3. **Interactive Browser / Android WebView UI Smoke:** `AdminSecurity.jsx` compiled cleanly in the production Vite build, but interactive browser DOM interaction with the role/permission modal was not exercised in a browser runner.

---

## 11. Stage 5B.2 Risks Mitigated Summary

- Prevented privilege escalation via stored `'*'` wildcard or `admins:manage` role/permission assignment.
- Closed all 44 unguarded legacy `/api/admin/*` endpoints behind granular `requirePermission(...)` + live `requireActiveAdmin`.
- Blocked deactivated/suspended admin login, `/me`, and unexpired JWT reuse immediately against live DB state.
- Fixed silent pending/suspended merchant auto-activation on `PUT /api/admin/shops/:id` and synchronized `status`, `verification_status`, and `qr_status` across all admin merchant lifecycle routes + customer permanent QR payment paths.
- Extended anti-spoofing rate limiters across admin auth, admin account management, credential resets, financial adjustments, account deletions, and uploads.
- Hardened Base64 image uploads against full PNG/JPEG/WebP header spoofing, embedded SVG/HTML/executable signatures, and non-string type crash payloads.

---

## 12. Stage 5B.2 Verdict

**`PASS WITH CONDITIONS`**

All Stage 5B.2 Admin RBAC, admin account security, merchant approval/QR synchronization, rate limiting, and upload security controls are implemented locally and verified against isolated database copies (`test-stage5b2-security.js` 5/5 + 11 regression suites + production Vite build), with database integrity verified intact (`5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`). Deployment remains conditioned on final browser/Android smoke verification and Stage 5B.3 work outside this stage's scope.
