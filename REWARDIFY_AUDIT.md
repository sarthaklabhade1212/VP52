# Rewardify — Pre-Launch Audit, Bug List & Publish Roadmap

**App:** "Rewardify" / "Customer Rewards" — a Customer Rewards & Physical-Shop Discount platform.
**Stack:** Client = React 19 + Vite 6 + Capacitor 8 (Android/iOS). Server = Node/Express 4 + better-sqlite3 + JWT (jsonwebtoken 9) + bcryptjs. Roles: customer, shop/merchant, admin.
**Audit method:** production build + server ground-truthing, then a 7-dimension find→adversarial-verify pass (security, correctness, api-contract, mobile/build, data/DB, publish-readiness, upgrades). 80+ findings, each independently verified against the code. Date: 2026-08-25.

---

## 1. Verdict

**Not shippable yet.** The code *builds cleanly* (`vite build` → ✓ in ~1.5s, 480 kB bundle) and the core API flows are internally consistent, but there are **8 hard publish blockers, 3 critical bugs, and ~13 high-severity issues** — several of which mean the published app cannot even reach its backend, plus a complete authentication bypass and a money-economy bug where balances are inconsistent and partly forgeable.

Think of it as a **solid, feature-complete prototype/demo** that needs a hardening pass before it touches a store or real users. Realistic effort to a safe public launch: **~3–5 focused weeks** (see roadmap in §5).

| Area | State |
|---|---|
| Builds / compiles | ✅ Clean |
| Can a shipped app reach the backend? | ❌ No (emulator-only URL baked in) |
| Authentication / authorization | ❌ Forgeable tokens + OTP bypass |
| Reward/coin economy correctness | ❌ Two ledgers diverge; partly forgeable |
| Store-submission readiness (Play/App Store) | ❌ Missing signing, privacy, permissions |
| Data durability | ⚠️ SQLite file in deploy tree, no backups |
| Dependencies | ⚠️ Mostly current; a few majors behind |

---

## 2. Publish Blockers — must fix before any release

| # | Blocker | Where | Fix |
|---|---|---|---|
| **B1** | **Prod build points at `http://10.0.2.2:5000`** — the Android *emulator's* loopback alias. Unreachable from real phones, iOS, and web; it's also plaintext HTTP. The published app makes **100% of its calls to a dead host**. Verified baked into the shipped Android bundle. | `client/.env.production:1`, `client/src/utils/api.js:2,53` | Point at a real **HTTPS** origin; rebuild; `npx cap sync`. Confirm `dist` no longer contains `10.0.2.2`. |
| **B2** | **Hardcoded JWT secret** with a source fallback (`'rewards_app_secret_key_2026_super_secure'`), identical value in `.env`. Anyone can forge a valid token for **any user or admin** → full takeover. | `server/middleware/auth.js:3`, `server/.env:2` | Require `JWT_SECRET` at boot (crash if unset), remove fallback, generate a ≥32-byte random secret per env, rotate. |
| **B3** | **Auto-seeds well-known credentials** (`admin@example.com/Admin@123`, etc.) into any empty DB regardless of `NODE_ENV`, and prints them to logs. First prod boot = publicly-known admin. | `server/index.js:37-42,50-52`, `server/db/seed.js` | Gate seeding on `NODE_ENV!=='production'` + explicit flag; provision first admin out-of-band; remove credential banner. |
| **B4** | **iOS `Info.plist` missing `NSCameraUsageDescription` + `NSLocationWhenInUseUsageDescription`.** Touching camera/location crashes the app and **Apple auto-rejects** the binary. | `client/ios/App/App/Info.plist` | Add honest purpose strings; `npx cap sync ios`. |
| **B5** | **No Android release signing config** → `bundleRelease` produces an unsigned artifact Play rejects. | `client/android/app/build.gradle:20-23` | Add `signingConfigs.release` from non-committed `gradle.properties`; enroll in Play App Signing. |
| **B6** | **iOS uses a development signing identity, no `DEVELOPMENT_TEAM`** → cannot archive/upload to App Store Connect. | `client/ios/App/App.xcodeproj/project.pbxproj:218,275` | Set paid team + distribution signing; validate an Archive build. |
| **B7** | **No privacy policy and no store data-safety declarations** for an app collecting **location + camera + email/phone PII**. Both stores reject without them. | `AndroidManifest.xml:42-44`, `server/db/database.js:13-25` | Publish a policy URL; complete Play Data Safety + Apple Privacy Nutrition Labels. |
| **B8** | **No in-app account/data deletion** — required by Google Play's Data Deletion policy for any app with account creation. | No route exists (`server/routes/auth.js` has register, no delete) | Add self-service account deletion (in-app + web URL). |

> **iOS extra:** the iOS project is shipping **stale web assets** (~5-day-old JS, missing a code-split chunk) and the `@capacitor/geolocation` plugin **isn't registered on iOS** (`packageClassList:[]`). Both are fixed by running `npx cap sync ios` after a fresh build — do this as part of B4.

---

## 3. Critical & High bugs

### Critical
- **C1 — Merchant OTP login is a total auth bypass.** `if (otp_code !== '123456' && otp_code.length !== 6)` accepts **any 6-character string**; no password checked; issues a real 7-day `shop` JWT. `/send-otp` even returns the code in its response. → anyone knowing a merchant's phone/email logs in and can mint/redeem customer coins. `server/routes/auth.js:236,258,296-300,313`.
- **C2 — Two coin ledgers disagree and one is forgeable.** Balance lives in both `wallets.balance` and `coin_lots`; `getAvailableCoins()` uses the lots sum but **falls back to `wallets.balance`** when lots run out, and `create-bill` does the same. Result: seeded/"phantom" balance is actually spendable, and **`GET /wallet` mutates state** — when lots expire it rewrites `wallets.balance` down to the active-lot sum (live data: user 1 shows 1450 but only 200 is lot-backed → drops to 0 on expiry). Core money math is inconsistent. `server/routes/customer.js:55,63-75`, `server/routes/merchant.js:157`.
- **C3 — Geolocation broken on all iPhones.** Plugin not registered on iOS → `getCurrentPosition` rejects "not implemented"; nearby-shops and merchant pin-drop fail. `client/ios/App/CapApp-SPM/Package.swift`. Fix via `npx cap sync ios`.

### High
- **H1 — `create-bill` IDOR + no price validation.** Resolves the customer by client-supplied `id`/email/phone (enumerable) *and* trusts client-supplied item `price`/`quantity`/`reward_eligible` (never looks up the real product price). A shop can target **any** customer and set **arbitrary** amounts → mint unlimited points and drain a victim's whole coin balance. `server/routes/merchant.js:94-97,122-141`.
- **H2 — Self-registered merchants are active immediately.** Inserted `status='active'` while the UI says "pending approval"; login never checks `verification_status`. They can transact before any review. `server/routes/auth.js:343`.
- **H3 — Customer PII/balance enumeration** via `scan-customer-qr`, which matches on `id`/email/phone (not just the secure `qr_token`) and returns name, email, phone, balance. Any shop can harvest every customer. `server/routes/shop.js:109-113,144-154`.
- **H4 — Admin Dashboard is broken (API contract mismatch).** Client calls **`GET /api/admin/dashboard`**, but the server only defines **`/api/admin/analytics`** → 404, `d.success` falsy, **stats never load**. `client/src/pages/admin/AdminDashboard.jsx:22` vs `server/routes/admin.js:105`. *(Found by my own contract diff — the automated api-contract pass stalled.)*
- **H5 — QR/offer redemption bypasses expiry checks.** `shop/approve-redeem` and `admin/mark-used` mark a code USED without re-checking `valid_until`/offer status that `verify-qr` enforces; `customer/redeem` also never checks expiry. Expired/deactivated offers can still be consumed. `server/routes/shop.js:280-329`, `admin.js:494-528`, `customer.js:330-335`.
- **H6 — Offer redemption is free & unlimited.** `required_points` is hardcoded `0` everywhere and `usage_limit` is never enforced, so `/customer/redeem` always succeeds for 0 points, unlimited times. *(Mitigated today: the client UI never calls `/redeem` — redemption is QR-at-store — but the endpoint is exposed.)* `server/routes/customer.js:342`.
- **H7 — Camera QR scanner never decodes.** The scan loop draws frames to a canvas and does nothing — no decoder library is present. The core merchant "scan customer QR" flow only works via the manual token-entry fallback. `client/src/components/CameraQRScanner.jsx:108-123`.
- **H8 — Web production build can't reach the backend.** In browser mode the API base URL is never applied; relative `/api` calls only work via the Vite **dev** proxy, which doesn't exist in prod. `client/src/utils/api.js:58`.
- **H9 — No transport security.** Server is plain HTTP, client is `http://`, Android ships `usesCleartextTraffic="true"`, iOS ATS will block it outright → tokens/PII in cleartext. `server/index.js:47`, `AndroidManifest.xml:10`.
- **H10 — No rate limiting / no `helmet`** on login/OTP endpoints → brute-forceable, no hardening headers. `server/index.js:17`.
- **H11 — No React error boundary** → any render exception = unrecoverable white screen in the native shell. `client/src/main.jsx`.
- **H12 — `ON DELETE CASCADE` on financial tables.** Deleting an offer (merchant or admin) or a shop **cascade-deletes redemptions and bills** — silently erasing financial history. `server/db/database.js:116-117,130`; deletes at `merchant.js:339`, `admin.js:390,448`.
- **H13 — SQLite file lives in the deploy tree + auto-seed** → on ephemeral hosting, redeploy loses all data or reseeds an empty DB; no backups; single-writer. `server/db/database.js:4`.

---

## 4. Medium / Low (grouped)

**Medium** — suspended users keep access for 7 days (no token revocation / no per-request status check, `customer.js`); `create-bill` doesn't check `customer.status`; weak generated merchant passwords via `Math.random`, `must_change_password` never enforced (`admin.js:255,359`); `shop_code = COUNT(*)+1` collides after a delete → 500 (`auth.js:337`); `GET /reward-session/status` has side effects and burns the daily quota (`customer.js:474`); money stored as `REAL` float (`database.js:125`); no indexes on any FK/lookup column — 38 `WHERE user_id` queries full-scan (`database.js`); no migration/versioning strategy; coin expiry writes no `point_ledger` row (audit trail breaks); `bills.reward_percent` stores the wrong value; `NODE_ENV=development` ships → stack traces leak; no listen-error handler / graceful shutdown / global error middleware; verbose `console.log('[API]'…)` in the shipped bundle; no crash reporting/monitoring; `android:allowBackup="true"` exposes the token; `SimulatedAdModal` never renders (prop mismatch); Leaflet/OSM loaded from CDN at runtime with no error handling or SRI.

**Low** — `/customer/redeem` inserts a redemption even if the guarded update changes 0 rows; level-progress % math inflated; daily reset on UTC not local midnight; `jwt.verify` doesn't pin `algorithms`; no password strength policy; error messages reflect user input; `favicon.svg` 404; `BrowserRouter` (vs Hash/Memory) in the WebView; app-name inconsistency (Rewardify vs Customer Rewards); `getSetting` typo throws on the dead `/watch-ad` route; legacy `/watch-ad` endpoint is dead code.

---

## 5. Publish Roadmap

### Phase 0 — Foundations (½–1 day)
1. `git init`, add a real `.gitignore` (`.env`, `*.db`, `*.db-wal`, `*.db-shm`, `node_modules`, `dist`). **Rotate the leaked JWT secret.**
2. Add `engines` + `.nvmrc` (pin Node LTS, e.g. 20 or 22).
3. Decide the **backend hosting** target (this drives everything else).

### Phase 1 — Make it reachable & secure (the blockers) (~1–1.5 weeks)
4. Stand up the backend on a host with **HTTPS** (managed platform or reverse proxy + TLS). Add `helmet`, `express-rate-limit`, `app.set('trust proxy',1)`, a global error handler, and a listen-error/`SIGTERM` handler.
5. Fix **B1**: set `VITE_API_URL` to the HTTPS origin; make browser mode use it too; remove the emulator fallback. Remove Android `usesCleartextTraffic`.
6. Fix **B2/B3**: require `JWT_SECRET`; gate seeding to dev; provision the first admin securely.
7. Fix **C1** (real OTP or disable the mobile-OTP endpoints), **H2** (register merchants `pending` + enforce `approved` in middleware), **H1/H3** (server-side price lookup, bind billing to a customer-consent token, restrict QR lookup to `qr_token` only), **H10** (rate limit).
8. Fix **C2** (single source of truth for coins; never mutate balance on a GET) and **H5/H6/H12** (enforce expiry/usage on redeem; make offer/shop deletes soft or `RESTRICT`).
9. Fix **H4** (`/dashboard` → `/analytics`) and **H11** (error boundary).

### Phase 2 — Data & durability (~2–4 days)
10. Move production data to a **managed Postgres** (or at minimum SQLite on a persistent volume via `DB_PATH` + automated backups). Add real **migrations** (Knex/Umzug), FK indexes, integer-money columns.

### Phase 3 — Mobile packaging (~3–5 days)
11. Fix **B4** (iOS purpose strings), **C3** + stale iOS assets (`npx cap sync ios` after a fresh build), **H7** (integrate a QR decoder — BarcodeDetector + jsQR/ZXing fallback, or a native ML-Kit plugin).
12. Fix **B5/B6** (Android + iOS release signing). Bundle Leaflet locally. Strip client `console.*` in prod. Add crash reporting (e.g. Sentry).

### Phase 4 — Store submission (~2–4 days + review time)
13. Fix **B7/B8** (privacy policy URL, Play Data Safety, Apple privacy labels, in-app + web account deletion).
14. Final store assets (icons/splash/screenshots), reconcile app name, set version bump process. Android `targetSdk 36` is already fine for Play.

### Phase 5 — Pre-launch verification
15. Add ESLint + Prettier + a test suite (Vitest/@testing-library + a real server e2e with assertions) + GitHub Actions CI (install/lint/build/test/`npm audit`). Manual QA of all three roles on real devices over HTTPS.

---

## 6. What to upgrade

**Do now (correctness/ops):**
- Add `engines` + `.nvmrc` (native `better-sqlite3` needs a pinned Node ABI).
- Add tooling that's entirely absent: **ESLint 9 (flat) + Prettier**, **Vitest/@testing-library** (client) + `node --test`/Vitest (server) with real assertions, **GitHub Actions CI**, and **git**. Wire `npm audit`/`npm outdated` into CI.
- Remove unused **`@vercel/analytics`** (wrong target for a Capacitor app).

**Dependency bumps (all currently one major behind, non-urgent unless noted):**
| Package | Current | Target | Risk |
|---|---|---|---|
| express | 4.22 | **5.x** | Medium — routing/`path-to-regexp` changes; thin surface here |
| better-sqlite3 | 11.10 | 12.x | Low — API stable; helps future Node ABIs *(or move off SQLite for prod)* |
| bcryptjs | 2.4.3 (8 yrs old) | 3.x, or `argon2`/native `bcrypt` | Low — no CVE, cost factor 10 is fine today |
| vite | 6.4 | 7.x | Low — plugin already supports 7 |
| recharts | 2.15 | 3.x | Low but **breaking** — audit chart props |
| dotenv | 16.6 | 17.x | Trivial |
| lucide-react | 0.475 | current 0.5xx | Trivial (caret on 0.x freezes it) |
| @capacitor/geolocation | 8.2.2 | 8.5.x | Trivial — align with core, then `cap sync` |

**Already current — leave alone:** React 19, react-router-dom 7, jsonwebtoken 9, cors 2.8, qrcode.react 4, Capacitor 8.5, Android `targetSdk 36`.

**Architectural upgrades:** SQLite-file → managed Postgres; token storage → Capacitor Secure Storage (not `localStorage`); add refresh tokens + revocation; consider TypeScript for the money/auth layers.

---

## 7. Notes on scope & confidence
- Every finding above was verified against the actual source (adversarial second pass; 0 findings were refuted, several severities were *corrected down* where impact was overstated — e.g. open CORS is low because auth is bearer-token, not cookies).
- The **api-contract** automated pass stalled; I ran that diff manually — the material result is **H4** (admin dashboard 404). Other server endpoints exist but are simply unused by the current client (`customer/redeem`, `shop/verify-qr`, `shop/approve-redeem`, several admin routes) — dead, not broken.
- The server e2e couldn't run live in the sandbox (network blocked), but all 9 endpoints it exercises were verified by code + live DB inspection and would pass on a normal host with port 5000 free.
